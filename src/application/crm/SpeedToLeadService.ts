/**
 * Speed-to-lead SLA — configurable, separate from Opportunity Score.
 * Operational temperatures HOT / MEDIUM / COLD drive response windows.
 */

import type { SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { toOperationalTemperature } from "@/domain/types/lead-lifecycle";
import { getLifecycleConfig } from "@/application/lifecycle/LeadLifecycleService";
import { randomUUID } from "crypto";

export const SLA_STATES = [
  "ON_TRACK",
  "DUE_SOON",
  "BREACHED",
  "COMPLETED",
  "NOT_APPLICABLE",
] as const;
export type SlaState = (typeof SLA_STATES)[number];

export type SpeedToLeadConfig = {
  version: string;
  /** Minutes to first contact attempt by operational temperature */
  hot_minutes: number;
  medium_minutes: number;
  cold_minutes: number;
  /** Fraction of window remaining when DUE_SOON triggers (0–1) */
  due_soon_ratio: number;
};

export const DEFAULT_SPEED_TO_LEAD_CONFIG: SpeedToLeadConfig = {
  version: "speed-to-lead-v1",
  hot_minutes: 15,
  medium_minutes: 60,
  cold_minutes: 1440, // 1 business day approx
  due_soon_ratio: 0.3,
};

export type SpeedToLeadSnapshot = {
  qualified_at: string | null;
  assigned_at: string | null;
  first_contact_attempt_at: string | null;
  first_meaningful_contact_at: string | null;
  sla_minutes: number;
  sla_deadline_at: string | null;
  sla_state: SlaState;
  time_to_assignment_ms: number | null;
  time_to_first_attempt_ms: number | null;
  time_to_first_contact_ms: number | null;
  completed_at: string | null;
  history: Array<{
    id: string;
    state: SlaState;
    at: string;
    note: string;
  }>;
};

export type NextBestActionResult = {
  action: string;
  headline: string;
  reasons: string[];
};

export function getSpeedToLeadConfig(): SpeedToLeadConfig {
  const store = getSimStore();
  return store.speed_to_lead_config ?? DEFAULT_SPEED_TO_LEAD_CONFIG;
}

export function updateSpeedToLeadConfig(
  partial: Partial<SpeedToLeadConfig>,
): SpeedToLeadConfig {
  const store = getSimStore();
  store.speed_to_lead_config = { ...getSpeedToLeadConfig(), ...partial };
  return store.speed_to_lead_config;
}

function operationalTemp(lead: SimLead) {
  if (lead.operational_temperature) return lead.operational_temperature;
  return toOperationalTemperature(lead.temperature_key, getLifecycleConfig());
}

function slaMinutesFor(lead: SimLead, config = getSpeedToLeadConfig()) {
  const t = operationalTemp(lead);
  if (t === "HOT") return config.hot_minutes;
  if (t === "MEDIUM") return config.medium_minutes;
  return config.cold_minutes;
}

function msDiff(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return null;
  return new Date(to).getTime() - new Date(from).getTime();
}

export class SpeedToLeadService {
  ensure(lead: SimLead): SpeedToLeadSnapshot {
    if (!lead.speed_to_lead) {
      const qualifiedAt = lead.scored_at ?? lead.created_at;
      const assignedAt =
        lead.ownership?.assigned_at ??
        lead.sla?.assigned_at ??
        (lead.assigned_organization_id ? lead.updated_at : null);
      lead.speed_to_lead = {
        qualified_at: qualifiedAt,
        assigned_at: assignedAt,
        first_contact_attempt_at: lead.sla?.first_contact_attempt_at ?? null,
        first_meaningful_contact_at: lead.sla?.first_contact_at ?? null,
        sla_minutes: slaMinutesFor(lead),
        sla_deadline_at: null,
        sla_state: "ON_TRACK",
        time_to_assignment_ms: null,
        time_to_first_attempt_ms: null,
        time_to_first_contact_ms: null,
        completed_at: null,
        history: [],
      };
      this.refresh(lead);
    }
    return lead.speed_to_lead;
  }

  refresh(lead: SimLead, now = Date.now()): SpeedToLeadSnapshot {
    const snap = this.ensure(lead);
    const config = getSpeedToLeadConfig();
    snap.sla_minutes = slaMinutesFor(lead, config);

    const anchor = snap.qualified_at ?? lead.created_at;
    const deadline = new Date(
      new Date(anchor).getTime() + snap.sla_minutes * 60_000,
    ).toISOString();
    snap.sla_deadline_at = deadline;

    snap.time_to_assignment_ms = msDiff(anchor, snap.assigned_at);
    snap.time_to_first_attempt_ms = msDiff(
      anchor,
      snap.first_contact_attempt_at,
    );
    snap.time_to_first_contact_ms = msDiff(
      anchor,
      snap.first_meaningful_contact_at,
    );

    // Preserve completed history — do not destroy timing
    if (snap.completed_at || snap.first_meaningful_contact_at) {
      if (snap.sla_state !== "COMPLETED") {
        this.pushHistory(snap, "COMPLETED", "Meaningful contact recorded");
      }
      snap.sla_state = "COMPLETED";
      if (!snap.completed_at) {
        snap.completed_at = snap.first_meaningful_contact_at;
      }
      if (lead.sla) {
        lead.sla.sla_status = "ok";
        lead.sla.first_contact_at = snap.first_meaningful_contact_at;
        lead.sla.time_to_contact_ms = snap.time_to_first_contact_ms;
      }
      lead.updated_at = new Date(now).toISOString();
      return snap;
    }

    if (
      lead.distribution_status === "unassigned_pool" ||
      lead.status === "unassigned_pool"
    ) {
      // Still track SLA from qualification
    }

    const remainingMs = new Date(deadline).getTime() - now;
    const windowMs = snap.sla_minutes * 60_000;
    let next: SlaState = "ON_TRACK";
    if (remainingMs <= 0) next = "BREACHED";
    else if (remainingMs <= windowMs * config.due_soon_ratio) next = "DUE_SOON";

    if (next !== snap.sla_state) {
      this.pushHistory(snap, next, `SLA refreshed → ${next}`);
      snap.sla_state = next;
    }

    // Mirror into legacy sla timers for existing UI
    if (lead.sla) {
      lead.sla.sla_minutes = snap.sla_minutes;
      const state = snap.sla_state;
      lead.sla.sla_status =
        state === "BREACHED"
          ? "breached"
          : state === "DUE_SOON"
            ? "warning"
            : "pending";
      lead.sla.first_contact_attempt_at = snap.first_contact_attempt_at;
      lead.sla.first_contact_at = snap.first_meaningful_contact_at;
      lead.sla.assigned_at = snap.assigned_at;
      lead.sla.time_to_assignment_ms = snap.time_to_assignment_ms;
      lead.sla.time_to_first_attempt_ms = snap.time_to_first_attempt_ms;
      lead.sla.time_to_contact_ms = snap.time_to_first_contact_ms;
    }

    lead.updated_at = new Date(now).toISOString();
    return snap;
  }

  markAssigned(lead: SimLead, at = new Date().toISOString()) {
    const snap = this.ensure(lead);
    if (!snap.assigned_at) snap.assigned_at = at;
    return this.refresh(lead);
  }

  markContactAttempt(lead: SimLead, at = new Date().toISOString()) {
    const snap = this.ensure(lead);
    if (!snap.first_contact_attempt_at) snap.first_contact_attempt_at = at;
    return this.refresh(lead);
  }

  markMeaningfulContact(lead: SimLead, at = new Date().toISOString()) {
    const snap = this.ensure(lead);
    if (!snap.first_contact_attempt_at) snap.first_contact_attempt_at = at;
    if (!snap.first_meaningful_contact_at) {
      snap.first_meaningful_contact_at = at;
      snap.completed_at = at;
    }
    return this.refresh(lead);
  }

  remainingMs(lead: SimLead, now = Date.now()) {
    const snap = this.refresh(lead, now);
    if (snap.sla_state === "COMPLETED") return null;
    if (!snap.sla_deadline_at) return null;
    return new Date(snap.sla_deadline_at).getTime() - now;
  }

  formatCountdown(lead: SimLead, now = Date.now()): string {
    const snap = this.refresh(lead, now);
    if (snap.sla_state === "COMPLETED") {
      const ms = snap.time_to_first_contact_ms;
      if (ms == null) return "CONTACTED";
      const mins = Math.round(ms / 60_000);
      return `CONTACTED · ${mins} min after qualification`;
    }
    const rem = this.remainingMs(lead, now);
    if (rem == null) return "—";
    if (rem <= 0) {
      const ago = Math.round(Math.abs(rem) / 60_000);
      return `SLA BREACHED · ${ago} min ago`;
    }
    const totalSec = Math.floor(rem / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `CONTACT WITHIN · ${h}h ${mm}m`;
    }
    return `CONTACT WITHIN · ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  private pushHistory(
    snap: SpeedToLeadSnapshot,
    state: SlaState,
    note: string,
  ) {
    snap.history = [
      ...(snap.history ?? []),
      {
        id: randomUUID(),
        state,
        at: new Date().toISOString(),
        note,
      },
    ].slice(-40);
  }
}

/**
 * Deterministic next-best-action from lead facts — no fabricated reasoning.
 */
export class NextBestActionService {
  recommend(lead: SimLead): NextBestActionResult {
    const speed = new SpeedToLeadService();
    const snap = speed.refresh(lead);
    const temp = operationalTemp(lead);
    const a = lead.assessment_answers;
    const score =
      lead.aging?.original_score ??
      lead.qualification?.opportunity.opportunity_score ??
      lead.score;
    const reasons: string[] = [];

    if (score >= 80) reasons.push(`High Opportunity Score (${score})`);
    if (a.repositionable_assets) {
      reasons.push(`${a.repositionable_assets} Potentially Repositionable`);
    }
    if (a.retirement_timing) {
      reasons.push(`Retiring ${a.retirement_timing}`);
    }
    if (a.decision_timeline) {
      reasons.push(`Decision Timeline ${a.decision_timeline}`);
    }
    if (
      lead.created_at &&
      Date.now() - new Date(lead.created_at).getTime() < 24 * 60 * 60 * 1000
    ) {
      reasons.push("Assessment Completed Today");
    }
    if (temp === "HOT") reasons.push("Temperature HOT");
    if (snap.sla_state === "BREACHED") reasons.push("SLA breached");
    if (snap.sla_state === "DUE_SOON") reasons.push("SLA due soon");

    if (lead.pipeline_stage === "APPOINTMENT_SET") {
      return {
        action: "PREPARE_APPOINTMENT",
        headline: "Prepare for scheduled appointment",
        reasons: reasons.length ? reasons : ["Appointment already set"],
      };
    }

    if (snap.sla_state === "COMPLETED" && !lead.appointments?.length) {
      return {
        action: "SCHEDULE_OR_FOLLOW_UP",
        headline: "Schedule conversation or set follow-up",
        reasons,
      };
    }

    if (temp === "HOT") {
      return {
        action: "CALL_NOW",
        headline: `Call within ${getSpeedToLeadConfig().hot_minutes} minutes`,
        reasons,
      };
    }
    if (temp === "MEDIUM") {
      return {
        action: "CONTACT_SOON",
        headline: `Contact within ${getSpeedToLeadConfig().medium_minutes} minutes`,
        reasons,
      };
    }
    return {
      action: "RE_ENGAGE",
      headline: "Re-engage with a consent-aware touchpoint",
      reasons: reasons.length ? reasons : ["Temperature COLD"],
    };
  }
}

export function issueHotLeadAlert(lead: SimLead) {
  const temp = operationalTemp(lead);
  if (temp !== "HOT") return null;
  const store = getSimStore();
  const orgId =
    lead.assigned_organization_id ??
    lead.organization_id ??
    store.organizations[0]!.id;
  const a = lead.assessment_answers;
  const score =
    lead.aging?.original_score ??
    lead.qualification?.opportunity.opportunity_score ??
    lead.score;
  const notification = {
    id: randomUUID(),
    organization_id: orgId,
    lead_id: lead.id,
    title: "NEW HOT OPPORTUNITY",
    body: [
      a.repositionable_assets
        ? `${a.repositionable_assets} Potentially Repositionable`
        : null,
      `Opportunity Score ${score}`,
      a.retirement_timing ? `Retiring ${a.retirement_timing}` : null,
      a.decision_timeline ? `Decision ${a.decision_timeline}` : null,
      `Source ${lead.attribution.ad_provider ?? lead.attribution.source ?? "Campaign"}`,
    ]
      .filter(Boolean)
      .join(" · "),
    created_at: new Date().toISOString(),
    read: false,
    kind: "NEW_HOT_OPPORTUNITY",
    metadata: { temperature: "HOT", score },
  };
  store.notifications.unshift(notification);
  return notification;
}
