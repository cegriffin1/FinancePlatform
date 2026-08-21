import { randomUUID } from "crypto";

export type JobType =
  | "publish_campaign"
  | "sync_campaign_status"
  | "sync_metrics"
  | "process_lead_webhook"
  | "refresh_credentials"
  | "retry_failed_sync";

export type JobRecord = {
  id: string;
  type: JobType;
  organization_id: string | null;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
  idempotency_key: string | null;
};

type JobHandler = (job: JobRecord) => Promise<void>;

const globalKey = "__altus_job_queue__";

type QueueState = {
  jobs: JobRecord[];
  handlers: Map<JobType, JobHandler>;
};

function state(): QueueState {
  const g = globalThis as typeof globalThis & { [globalKey]?: QueueState };
  if (!g[globalKey]) {
    g[globalKey] = { jobs: [], handlers: new Map() };
  }
  return g[globalKey];
}

export function registerJobHandler(type: JobType, handler: JobHandler) {
  state().handlers.set(type, handler);
}

export function enqueueJob(input: {
  type: JobType;
  organization_id?: string | null;
  payload: Record<string, unknown>;
  idempotency_key?: string | null;
  max_attempts?: number;
}): JobRecord {
  const s = state();
  if (input.idempotency_key) {
    const existing = s.jobs.find(
      (j) =>
        j.idempotency_key === input.idempotency_key &&
        (j.status === "queued" || j.status === "running" || j.status === "completed"),
    );
    if (existing) return existing;
  }

  const now = new Date().toISOString();
  const job: JobRecord = {
    id: randomUUID(),
    type: input.type,
    organization_id: input.organization_id ?? null,
    payload: input.payload,
    status: "queued",
    attempts: 0,
    max_attempts: input.max_attempts ?? 5,
    next_run_at: now,
    last_error: null,
    created_at: now,
    completed_at: null,
    idempotency_key: input.idempotency_key ?? null,
  };
  s.jobs.push(job);
  return job;
}

/** Dev-safe processor with exponential backoff metadata. */
export async function processNextJob(): Promise<JobRecord | null> {
  const s = state();
  const now = Date.now();
  const job = s.jobs.find(
    (j) => j.status === "queued" && new Date(j.next_run_at).getTime() <= now,
  );
  if (!job) return null;

  const handler = s.handlers.get(job.type);
  job.status = "running";
  job.attempts += 1;
  try {
    if (!handler) throw new Error(`No handler for ${job.type}`);
    await handler(job);
    job.status = "completed";
    job.completed_at = new Date().toISOString();
  } catch (error) {
    job.last_error = error instanceof Error ? error.message : "Job failed";
    if (job.attempts >= job.max_attempts) {
      job.status = "failed";
    } else {
      job.status = "queued";
      const delayMs = Math.min(60_000, 1000 * 2 ** job.attempts);
      job.next_run_at = new Date(Date.now() + delayMs).toISOString();
    }
  }
  return job;
}

export async function drainJobs(limit = 20) {
  const results: JobRecord[] = [];
  for (let i = 0; i < limit; i += 1) {
    const job = await processNextJob();
    if (!job) break;
    results.push(job);
  }
  return results;
}

export function listJobs() {
  return [...state().jobs];
}

export function resetJobQueue() {
  const s = state();
  s.jobs = [];
}
