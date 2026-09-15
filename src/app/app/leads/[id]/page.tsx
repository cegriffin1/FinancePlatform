"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type { LeadEvent } from "@/domain/types";
import { actionLabel } from "@/application/intelligence/lifecycle";
import { PIPELINE_STAGES, type PipelineStage } from "@/domain/types/lead-intelligence";
import { AGENT_CRM_OUTCOMES } from "@/domain/types/retirement-crm";
import { buildPreCallBrief } from "@/application/crm/preCallBrief";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [lead, setLead] = useState<SimLead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { id } = await params;
    const res = await fetch("/api/leads/" + id);
    if (!res.ok) return;
    const detail = await res.json();
    setLead(detail.lead);
    setEvents(detail.events ?? []);
    setCampaignName(detail.campaignName ?? "");
    setOrgName(detail.organizationName ?? "");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (lead && !lead.sla?.first_viewed_at) {
      void fetch(`/api/leads/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "viewed" }),
      }).then(() => load());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  async function crm(action: string, extra: Record<string, unknown> = {}) {
    if (!lead) return;
    setBusy(true);
    try {
      await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lead_id: lead.id, ...extra }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!lead) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading lead…</p>;
  }

  const q = lead.qualification;
  const intel = lead.intelligence;
  const brief = buildPreCallBrief(lead);

  return (
    <div className="space-y-5 pb-24 sm:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app" className="text-sm font-semibold text-[var(--altus-blue)]">
            ← Agent Home
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{q?.temperature.temperature ?? lead.temperature_key}</Badge>
            <Badge>{lead.pipeline_stage ?? "NEW"}</Badge>
            {q?.asset.commercial_tier ? <Badge>{q.asset.commercial_tier}</Badge> : null}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="text-sm text-[var(--altus-text-secondary)]">
            {lead.state} · {lead.phone} · {lead.email}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-[var(--altus-blue)]">
            {q?.opportunity.opportunity_score ?? lead.score}
          </div>
          <div className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
            Opportunity Score
          </div>
          <div className="mt-1 text-sm font-semibold">
            {q?.temperature.temperature_score ?? "—"}°
          </div>
        </div>
      </div>

      {/* Mobile sticky quick actions */}
      <div className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-[var(--altus-border)] bg-[var(--altus-bg,#f6f8fb)] px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Action
          disabled={busy}
          href={`tel:${lead.phone}`}
          onClick={() => void crm("contact_attempt", { channel: "call" })}
          label="Call"
        />
        <Action
          disabled={busy}
          href={`mailto:${lead.email}`}
          onClick={() => void crm("contact_attempt", { channel: "email" })}
          label="Email"
        />
        <Action
          disabled={busy}
          href={`sms:${lead.phone}`}
          onClick={() => void crm("contact_attempt", { channel: "sms" })}
          label="Text"
        />
        <button
          type="button"
          disabled={busy}
          className="shrink-0 rounded-md border border-[var(--altus-border)] bg-white px-3 py-2 text-xs font-semibold"
          onClick={() => {
            const due = callbackAt || new Date(Date.now() + 3600000).toISOString();
            void crm("create_follow_up", {
              type: "Callback",
              title: `Callback ${lead.first_name}`,
              due_at: due,
            });
          }}
        >
          Set callback
        </button>
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-[linear-gradient(145deg,#004C91,#0074C8)] p-4 text-white">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-white/80">
          PRE-CALL BRIEF
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{brief}</pre>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Opportunity">
          <Row label="Score" value={`${q?.opportunity.opportunity_score ?? lead.score}`} />
          <Row label="Grade" value={q?.lead_grade ?? intel?.quality_grade ?? "—"} />
          <Row label="Temperature" value={`${q?.temperature.temperature ?? lead.temperature_key}`} />
          <Row label="Asset tier" value={q?.asset.commercial_tier ?? "—"} />
          <Row label="Assets" value={q?.asset.repositionable_asset_band ?? "—"} />
          <Row
            label="Asset status"
            value={
              q?.asset.verification_status === "SETTER_CONFIRMED"
                ? "Setter Confirmed"
                : "Self Reported"
            }
          />
        </Card>
        <Card title="Ownership">
          <Row label="Owner" value={lead.ownership?.owner_label ?? lead.assigned_agent_label ?? "—"} />
          <Row label="Organization" value={orgName || lead.ownership?.organization_id?.slice(0, 8) || "—"} />
          <Row
            label="Assigned"
            value={
              lead.ownership?.assigned_at
                ? new Date(lead.ownership.assigned_at).toLocaleDateString()
                : "—"
            }
          />
          <Row
            label="Expires"
            value={
              lead.ownership?.ownership_expires_at
                ? new Date(lead.ownership.ownership_expires_at).toLocaleDateString()
                : "—"
            }
          />
          <Row
            label="Period"
            value={lead.ownership ? `${lead.ownership.period_days} days` : "—"}
          />
          <Row
            label="Days remaining"
            value={
              lead.ownership?.ownership_expires_at
                ? `${Math.ceil(
                    (new Date(lead.ownership.ownership_expires_at).getTime() -
                      Date.now()) /
                      (24 * 60 * 60 * 1000),
                  )} Days Remaining`
                : "—"
            }
          />
          <Row label="Source" value={lead.ownership?.source ?? lead.attribution.source ?? "—"} />
          {lead.aging ? (
            <>
              <Row
                label="Original score"
                value={String(lead.aging.original_score)}
              />
              <Row
                label="Current score"
                value={String(lead.aging.current_score)}
              />
              <Row
                label="Original temp"
                value={lead.aging.original_temperature}
              />
              <Row
                label="Current temp"
                value={lead.aging.current_temperature}
              />
            </>
          ) : null}
          <div className="pt-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--altus-border)] px-2 py-1 text-xs font-semibold"
              onClick={() =>
                void fetch("/api/marketplace", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "extend",
                    lead_id: lead.id,
                    days: 7,
                    reason: "Agent-requested eligible extension",
                  }),
                }).then(() => load())
              }
            >
              Request 7-day extension
            </button>
          </div>
        </Card>
        <Card title="Campaign">
          <Row label="Campaign" value={campaignName || "—"} />
          <Row
            label="Source"
            value={lead.attribution.ad_provider ?? lead.attribution.source ?? "—"}
          />
          <Row label="UTM" value={lead.attribution.utm_source ?? "—"} />
          <Row label="External" value={lead.attribution.external_campaign_id ?? "—"} />
        </Card>
        <Card title="Status">
          <label className="block text-xs text-[var(--altus-text-secondary)]">
            Pipeline stage
            <select
              className="mt-1 w-full rounded-md border border-[var(--altus-border)] px-2 py-2 text-sm text-[var(--altus-text)]"
              value={lead.pipeline_stage ?? "NEW"}
              disabled={busy}
              onChange={(e) =>
                void crm("set_stage", { stage: e.target.value as PipelineStage })
              }
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Row label="Outcome" value={lead.outcome ?? "—"} />
          <Row label="SLA" value={lead.sla?.sla_status ?? "—"} />
          <Row
            label="Setter"
            value={lead.setter_verification?.disposition ?? "—"}
          />
        </Card>
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Quick actions</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm"
              placeholder="Add note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              className="mt-2 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
              onClick={() => {
                void crm("add_note", { body: note }).then(() => setNote(""));
              }}
            >
              Add Note
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm"
              value={callbackAt}
              onChange={(e) => setCallbackAt(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
              onClick={() =>
                void crm("create_follow_up", {
                  type: "Task",
                  title: `Follow up ${lead.first_name}`,
                  due_at: callbackAt
                    ? new Date(callbackAt).toISOString()
                    : new Date(Date.now() + 86400000).toISOString(),
                })
              }
            >
              Create Task
            </button>
            <button
              type="button"
              disabled={busy}
              className="ml-2 rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
              onClick={() =>
                void crm("create_follow_up", {
                  type: "Appointment",
                  title: `Appointment ${lead.first_name}`,
                  due_at: callbackAt
                    ? new Date(callbackAt).toISOString()
                    : new Date(Date.now() + 86400000).toISOString(),
                })
              }
            >
              Schedule
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Outcome</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGENT_CRM_OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              disabled={busy}
              onClick={() => void crm("outcome", { outcome })}
              className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
            >
              {outcome}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">24-point profile</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(lead.assessment_answers).map(([k, v]) => (
            <div key={k} className="text-sm">
              <span className="font-semibold">{k.replaceAll("_", " ")}:</span> {v}
            </div>
          ))}
        </div>
        {q ? (
          <p className="mt-3 text-xs text-[var(--altus-text-secondary)]">
            Profile {q.completeness.answered_core_questions}/
            {q.completeness.applicable_questions} applicable (
            {q.completeness.profile_completion_percentage}%)
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Notes">
          {(lead.crm_notes ?? []).length === 0 ? (
            <p className="text-sm text-[var(--altus-text-secondary)]">No notes yet</p>
          ) : (
            (lead.crm_notes ?? []).map((n) => (
              <div key={n.id} className="border-b border-[var(--altus-border)] py-2 text-sm">
                {n.body}
                <div className="text-[10px] text-[var(--altus-text-secondary)]">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </Card>
        <Card title="Tasks / Follow-ups">
          {(lead.follow_ups ?? []).filter((f) => f.type !== "Note").length === 0 ? (
            <p className="text-sm text-[var(--altus-text-secondary)]">None</p>
          ) : (
            (lead.follow_ups ?? [])
              .filter((f) => f.type !== "Note")
              .map((f) => (
                <div key={f.id} className="border-b border-[var(--altus-border)] py-2 text-sm">
                  <div className="font-semibold">
                    {f.type}: {f.title}
                  </div>
                  <div className="text-[10px] text-[var(--altus-text-secondary)]">
                    {f.status} · {f.due_at ? new Date(f.due_at).toLocaleString() : "—"}
                  </div>
                </div>
              ))
          )}
        </Card>
        <Card title="Contact attempts">
          {(lead.contact_attempts ?? []).length === 0 ? (
            <p className="text-sm text-[var(--altus-text-secondary)]">None</p>
          ) : (
            (lead.contact_attempts ?? []).map((c) => (
              <div key={c.id} className="border-b border-[var(--altus-border)] py-2 text-sm">
                {c.channel}
                <div className="text-[10px] text-[var(--altus-text-secondary)]">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {(lead.appointments ?? []).length > 0 ? (
        <Card title="Appointment">
          {lead.appointments!.map((a) => (
            <div key={a.id} className="text-sm">
              {new Date(a.scheduled_at).toLocaleString()} · {a.agent_name} ·{" "}
              {a.preferred_contact_method} · {a.status}
            </div>
          ))}
        </Card>
      ) : null}

      {intel?.explanation ? (
        <Card title="Why this lead matters">
          <p className="text-sm text-[var(--altus-text-secondary)]">{intel.explanation}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--altus-blue)]">
            Recommended: {actionLabel(intel.recommended_action)}
          </p>
        </Card>
      ) : null}

      <Card title="Timeline">
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-[var(--altus-border)] pb-2">
              <span className="w-40 shrink-0 text-xs text-[var(--altus-text-secondary)]">
                {new Date(e.occurred_at).toLocaleString()}
              </span>
              <span className="font-semibold">{e.event_type}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-[var(--altus-text-secondary)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Action({
  label,
  href,
  onClick,
  disabled,
}: {
  label: string;
  href: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`shrink-0 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white ${disabled ? "opacity-60" : ""}`}
    >
      {label}
    </a>
  );
}
