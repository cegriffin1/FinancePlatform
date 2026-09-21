import { randomUUID } from "crypto";
import {
  DEFAULT_LIFECYCLE_CONFIG,
  type LeadEngagementEvent,
  type LeadTemperatureSnapshot,
  type LifecycleConfig,
  type MeaningfulEngagementType,
  type OperationalTemperature,
  type RecyclingEligibilityResult,
  operationalFromScore,
  toOperationalTemperature,
} from "@/domain/types/lead-lifecycle";
import type { SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { LeadComplianceService } from "@/application/inventory/LeadComplianceService";

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function daysBetween(fromIso: string | null | undefined, to = Date.now()) {
  if (!fromIso) return 9999;
  return Math.floor((to - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000));
}

function appendDomainEvent(
  lead: SimLead,
  type: string,
  payload: Record<string, unknown> = {},
) {
  const store = getSimStore();
  store.events.push({
    id: randomUUID(),
    organization_id:
      lead.assigned_organization_id ??
      lead.organization_id ??
      store.organizations[0]!.id,
    lead_id: lead.id,
    event_type: type,
    occurred_at: nowIso(),
    actor_profile_id: null,
    payload,
    created_at: nowIso(),
  });
}

function maybeNotify(
  lead: SimLead,
  kind: string,
  title: string,
  body: string,
) {
  const store = getSimStore();
  const orgId =
    lead.assigned_organization_id ??
    lead.organization_id ??
    store.organizations[0]!.id;
  const prefs = store.notification_preferences[orgId] ?? {
    recycling_warnings: true,
    temperature_changes: true,
    marketplace: true,
  };
  const temperatureKinds = [
    "Lead Became Medium",
    "Lead Became Cold",
    "Lead Reengaged",
  ];
  const recyclingKinds = [
    "Lead Recycling in 14 Days",
    "Lead Recycling in 7 Days",
    "Lead Recycling in 3 Days",
    "Lead Released",
  ];
  const marketplaceKinds = [
    "Lead Marketplace Eligible",
    "Lead Sold",
  ];
  if (temperatureKinds.includes(kind) && !prefs.temperature_changes) return;
  if (recyclingKinds.includes(kind) && !prefs.recycling_warnings) return;
  if (marketplaceKinds.includes(kind) && !prefs.marketplace) return;

  // Deduplicate same kind within 24h for this lead
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = store.notifications.find(
    (n) =>
      n.lead_id === lead.id &&
      n.kind === kind &&
      new Date(n.created_at).getTime() > dayAgo,
  );
  if (recent) return;

  store.notifications.push({
    id: randomUUID(),
    organization_id: orgId,
    lead_id: lead.id,
    title,
    body,
    created_at: nowIso(),
    read: false,
    kind,
  });
}

export function getLifecycleConfig(): LifecycleConfig {
  const store = getSimStore();
  return store.lifecycle_config ?? DEFAULT_LIFECYCLE_CONFIG;
}

export function updateLifecycleConfig(
  partial: Partial<LifecycleConfig>,
): LifecycleConfig {
  const store = getSimStore();
  store.lifecycle_config = { ...getLifecycleConfig(), ...partial };
  return store.lifecycle_config;
}

/**
 * Meaningful prospect engagement only — opening a lead does NOT count.
 */
export class LeadEngagementService {
  record(
    lead: SimLead,
    type: MeaningfulEngagementType | string,
    opts: {
      meaningful?: boolean;
      note?: string;
      actor?: string;
      at?: number;
    } = {},
  ): LeadEngagementEvent {
    const meaningful = opts.meaningful ?? true;
    const event: LeadEngagementEvent = {
      id: randomUUID(),
      lead_id: lead.id,
      type,
      meaningful,
      note: opts.note ?? null,
      actor: opts.actor ?? null,
      occurred_at: nowIso(opts.at),
    };
    lead.engagement_events = [...(lead.engagement_events ?? []), event];
    lead.last_activity_at = event.occurred_at;
    if (meaningful) {
      lead.last_meaningful_interaction_at = event.occurred_at;
      appendDomainEvent(lead, "LeadReengaged", {
        type,
        occurred_at: event.occurred_at,
      });
    }
    lead.updated_at = event.occurred_at;
    return event;
  }

  /** Explicit non-meaningful activity (agent open, auto email, etc.) */
  recordSystemActivity(
    lead: SimLead,
    type: string,
    opts: { note?: string; at?: number } = {},
  ) {
    return this.record(lead, type, {
      meaningful: false,
      note: opts.note,
      at: opts.at,
    });
  }

  daysSinceMeaningful(lead: SimLead, now = Date.now()) {
    const anchor =
      lead.last_meaningful_interaction_at ?? lead.created_at;
    return daysBetween(anchor, now);
  }
}

/**
 * Temperature transitions with immutable history.
 * Never overwrites Opportunity Score.
 */
export class LeadTemperatureTransitionService {
  currentOperational(
    lead: SimLead,
    config = getLifecycleConfig(),
  ): OperationalTemperature {
    if (lead.operational_temperature) return lead.operational_temperature;
    return toOperationalTemperature(lead.temperature_key, config);
  }

  transition(
    lead: SimLead,
    next: OperationalTemperature,
    reason: string,
    trigger: string,
    opts: { temperature_score?: number | null; at?: number } = {},
  ): LeadTemperatureSnapshot {
    const previous = this.currentOperational(lead);
    if (previous === next && (lead.temperature_snapshots?.length ?? 0) > 0) {
      return lead.temperature_snapshots![lead.temperature_snapshots!.length - 1]!;
    }
    const snap: LeadTemperatureSnapshot = {
      id: randomUUID(),
      lead_id: lead.id,
      temperature: next,
      temperature_score: opts.temperature_score ?? null,
      reason,
      trigger,
      version: getLifecycleConfig().version,
      previous_temperature: previous,
      calculated_at: nowIso(opts.at),
    };
    lead.temperature_snapshots = [...(lead.temperature_snapshots ?? []), snap];
    lead.operational_temperature = next;

    // Keep fine-grained key aligned for legacy consumers without destroying originals
    if (next === "HOT") {
      lead.temperature_key =
        lead.temperature_key === "READY_NOW" ||
        lead.temperature_key === "VERY_HOT" ||
        lead.temperature_key === "PRIORITY"
          ? lead.temperature_key
          : "HOT";
    } else if (next === "MEDIUM") {
      lead.temperature_key = "WARM";
    } else {
      lead.temperature_key = "COLD";
    }

    if (lead.aging) {
      lead.aging.current_temperature = next;
    }

    appendDomainEvent(lead, "LeadTemperatureChanged", {
      previous,
      next,
      reason,
      trigger,
    });
    if (next === "MEDIUM" && previous !== "MEDIUM") {
      maybeNotify(
        lead,
        "Lead Became Medium",
        "Lead Became Medium",
        reason,
      );
    }
    if (next === "COLD") {
      appendDomainEvent(lead, "LeadBecameCold", { reason, trigger });
      maybeNotify(lead, "Lead Became Cold", "Lead Became Cold", reason);
    }
    lead.updated_at = snap.calculated_at;
    return snap;
  }

  seedInitial(
    lead: SimLead,
    temperatureScore: number,
    fineGrained: string,
    reason: string,
  ) {
    const config = getLifecycleConfig();
    const operational =
      toOperationalTemperature(fineGrained, config) ||
      operationalFromScore(temperatureScore, config);
    lead.operational_temperature = operational;
    if (!lead.last_meaningful_interaction_at) {
      lead.last_meaningful_interaction_at = lead.created_at;
    }
    if (!lead.temperature_snapshots?.length) {
      this.transition(lead, operational, reason, "initial_assessment", {
        temperature_score: temperatureScore,
      });
    }
    return operational;
  }
}

/**
 * Aging uses meaningful interaction clock.
 * Opportunity Score (original) is NEVER reduced by time.
 */
export class LeadLifecycleAgingService {
  private readonly engagement = new LeadEngagementService();
  private readonly transitions = new LeadTemperatureTransitionService();

  run(lead: SimLead, now = Date.now()) {
    const config = getLifecycleConfig();
    const days = this.engagement.daysSinceMeaningful(lead, now);
    lead.days_since_meaningful_interaction = days;

    if (!lead.aging) {
      lead.aging = {
        original_score: lead.score,
        current_score: lead.score,
        original_temperature: lead.temperature_key,
        current_temperature: this.transitions.currentOperational(lead),
        last_decayed_at: null,
      };
    }
    // CRITICAL: do not decay opportunity score
    lead.aging.current_score = lead.aging.original_score;
    lead.score = lead.aging.original_score;

    const current = this.transitions.currentOperational(lead);
    const daysToRecycle = config.recycle_after_days - days;

    if (days >= config.recycle_after_days) {
      if (current !== "COLD") {
        this.transitions.transition(
          lead,
          "COLD",
          `No meaningful interaction for ${days} days (≥ recycle ${config.recycle_after_days})`,
          "aging_recycle_window",
          { at: now },
        );
      }
      if (
        lead.inventory_status === "ACTIVE_OWNERSHIP" ||
        lead.inventory_status === "EXPIRING" ||
        lead.inventory_status === "AGING" ||
        lead.inventory_status === "PURCHASED_ASSIGNED" ||
        !lead.inventory_status
      ) {
        lead.inventory_status = "RECYCLING_REVIEW";
        appendDomainEvent(lead, "LeadRecyclingReviewStarted", { days });
      }
    } else if (days >= config.cold_after_days) {
      if (current !== "COLD") {
        this.transitions.transition(
          lead,
          "COLD",
          `No meaningful interaction for ${days} days (≥ cold ${config.cold_after_days})`,
          "aging_cold",
          { at: now },
        );
      }
      if (
        lead.inventory_status === "ACTIVE_OWNERSHIP" ||
        lead.inventory_status === "PURCHASED_ASSIGNED"
      ) {
        lead.inventory_status = "AGING";
      }
      for (const w of config.recycling_warning_days) {
        if (daysToRecycle === w) {
          maybeNotify(
            lead,
            `Lead Recycling in ${w} Days`,
            `Lead Recycling in ${w} Days`,
            `No prospect interaction for ${days} days. ${w} days remaining before recycling review.`,
          );
          appendDomainEvent(lead, "LeadRecyclingWarningIssued", {
            days,
            days_remaining: w,
          });
        }
      }
    } else if (days >= 15 && current === "HOT") {
      this.transitions.transition(
        lead,
        "MEDIUM",
        `No meaningful interaction for ${days} days (watch window)`,
        "aging_watch",
        { at: now },
      );
    }

    lead.aging.last_decayed_at = nowIso(now);
    lead.updated_at = nowIso(now);
    return { days, temperature: this.transitions.currentOperational(lead) };
  }

  /** Re-heat after meaningful engagement */
  reheat(
    lead: SimLead,
    engagementType: MeaningfulEngagementType,
    at = Date.now(),
  ) {
    this.engagement.record(lead, engagementType, { at });
    const hasAppointment =
      (lead.appointments ?? []).some((a) => a.status === "scheduled" || a.status === "confirmed") ||
      engagementType.includes("appointment");
    const next: OperationalTemperature = hasAppointment ? "HOT" : "MEDIUM";
    this.transitions.transition(
      lead,
      next,
      `Re-engagement: ${engagementType}`,
      "reengagement",
      { at },
    );
    if (
      lead.inventory_status === "RECYCLING_REVIEW" ||
      lead.inventory_status === "MARKETPLACE_ELIGIBLE" ||
      lead.inventory_status === "MARKETPLACE" ||
      lead.inventory_status === "AGING"
    ) {
      lead.inventory_status = "ACTIVE_OWNERSHIP";
      lead.marketplace_listed = false;
      appendDomainEvent(lead, "recycling_cancelled_reengagement", {
        engagementType,
      });
    }
    maybeNotify(
      lead,
      "Lead Reengaged",
      "Lead Reengaged",
      `Prospect activity restored temperature to ${next}`,
    );
    return next;
  }
}

/**
 * Consent-aware recycling eligibility — COLD alone is not enough.
 */
export class LeadRecyclingEligibilityService {
  private readonly compliance = new LeadComplianceService();
  private readonly engagement = new LeadEngagementService();

  evaluate(lead: SimLead, now = Date.now()): RecyclingEligibilityResult {
    const config = getLifecycleConfig();
    const days = this.engagement.daysSinceMeaningful(lead, now);
    const protectReasons: string[] = [];

    if (lead.compliance?.suppressed) {
      return {
        status: "SUPPRESSED",
        reasons: [
          `Suppressed: ${lead.compliance.suppression_reason ?? "policy"}`,
        ],
        days_since_meaningful_interaction: days,
        cold_after_days: config.cold_after_days,
        recycle_after_days: config.recycle_after_days,
      };
    }

    const gate = this.compliance.evaluateMarketplaceEligibility(lead);
    if (!gate.eligible) {
      return {
        status: "NOT_ELIGIBLE",
        reasons: gate.reasons,
        days_since_meaningful_interaction: days,
        cold_after_days: config.cold_after_days,
        recycle_after_days: config.recycle_after_days,
      };
    }

    const hasFutureAppt = (lead.appointments ?? []).some((a) => {
      if (a.status === "cancelled" || a.status === "completed") return false;
      const t = new Date(a.scheduled_at).getTime();
      return t >= now - 60_000;
    });
    if (hasFutureAppt) protectReasons.push("Active/scheduled appointment");

    if (
      lead.pipeline_stage === "OPPORTUNITY" ||
      lead.outcome === "Qualified Opportunity" ||
      lead.pipeline_stage === "APPOINTMENT_SET"
    ) {
      protectReasons.push("Active opportunity / appointment pipeline");
    }

    if (lead.pipeline_stage === "SETTER_REVIEW") {
      protectReasons.push("Active setter verification");
    }

    if (
      lead.active_reservation_id ||
      lead.reservation_status === "RESERVED"
    ) {
      protectReasons.push("Lead currently reserved");
    }

    if (
      (lead.follow_ups ?? []).some(
        (f) => f.status === "open" && !f.completed_at,
      )
    ) {
      protectReasons.push("Pending follow-up");
    }

    if (days < config.recycle_after_days) {
      const reasons = [
        ...protectReasons,
        `Only ${days} days inactive; recycle requires ${config.recycle_after_days}`,
      ];
      return {
        status: days >= config.cold_after_days ? "PENDING" : "NOT_ELIGIBLE",
        reasons,
        days_since_meaningful_interaction: days,
        cold_after_days: config.cold_after_days,
        recycle_after_days: config.recycle_after_days,
      };
    }

    if (protectReasons.length) {
      return {
        status: "NOT_ELIGIBLE",
        reasons: protectReasons,
        days_since_meaningful_interaction: days,
        cold_after_days: config.cold_after_days,
        recycle_after_days: config.recycle_after_days,
      };
    }

    if (lead.inventory_status === "RECYCLING_REVIEW") {
      return {
        status: "REQUIRES_REVIEW",
        reasons: ["In recycling review queue"],
        days_since_meaningful_interaction: days,
        cold_after_days: config.cold_after_days,
        recycle_after_days: config.recycle_after_days,
      };
    }

    return {
      status: "ELIGIBLE",
      reasons: [`Inactive ${days} days with consent/sharing permitted`],
      days_since_meaningful_interaction: days,
      cold_after_days: config.cold_after_days,
      recycle_after_days: config.recycle_after_days,
    };
  }
}

export class LeadOwnershipReleaseService {
  private readonly eligibility = new LeadRecyclingEligibilityService();

  releaseIfEligible(lead: SimLead, reason: string, now = Date.now()) {
    const elig = this.eligibility.evaluate(lead, now);
    if (
      elig.status !== "ELIGIBLE" &&
      elig.status !== "REQUIRES_REVIEW"
    ) {
      return { released: false as const, eligibility: elig };
    }

    const previous = lead.ownership;
    if (previous) {
      const daysOwned = Math.floor(
        (now - new Date(previous.ownership_started_at).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      lead.ownership_history = [
        ...(lead.ownership_history ?? []),
        {
          ...previous,
        },
      ];
      appendDomainEvent(lead, "ownership_release_detail", {
        previous_agent: previous.owner_label,
        previous_organization: previous.organization_id,
        ownership_started_at: previous.ownership_started_at,
        ownership_ended_at: nowIso(now),
        release_reason: reason,
        days_owned: daysOwned,
        interaction_count: (lead.engagement_events ?? []).filter((e) => e.meaningful)
          .length,
        appointment_count: lead.appointments?.length ?? 0,
        outcome: lead.outcome ?? null,
      });
      lead.ownership = null;
    }

    lead.inventory_status = "RELEASED";
    appendDomainEvent(lead, "LeadOwnershipReleased", { reason });
    maybeNotify(lead, "Lead Released", "Lead Released", reason);

    const gate = new LeadComplianceService().evaluateMarketplaceEligibility(lead);
    if (!gate.eligible) {
      lead.inventory_status = "NOT_ELIGIBLE_FOR_RESALE";
      lead.updated_at = nowIso(now);
      return { released: true as const, eligibility: elig, marketplace: false };
    }

    lead.inventory_status = "MARKETPLACE_ELIGIBLE";
    appendDomainEvent(lead, "LeadMarketplaceEligible", {});
    maybeNotify(
      lead,
      "Lead Marketplace Eligible",
      "Lead Marketplace Eligible",
      "Released lead is eligible for recycled marketplace inventory",
    );
    lead.updated_at = nowIso(now);
    return { released: true as const, eligibility: elig, marketplace: true };
  }
}

/** Batch job for lifecycle aging across inventory */
export class LeadLifecycleJob {
  private readonly aging = new LeadLifecycleAgingService();
  private readonly eligibility = new LeadRecyclingEligibilityService();
  private readonly release = new LeadOwnershipReleaseService();

  runAll(now = Date.now()) {
    const store = getSimStore();
    const results = [];
    for (const lead of store.leads) {
      const aged = this.aging.run(lead, now);
      const elig = this.eligibility.evaluate(lead, now);
      if (
        lead.inventory_status === "RECYCLING_REVIEW" &&
        elig.status === "REQUIRES_REVIEW"
      ) {
        // Auto-advance review → release when protections clear
        const cleared = {
          ...elig,
          status: "ELIGIBLE" as const,
          reasons: elig.reasons.filter((r) => r !== "In recycling review queue"),
        };
        if (cleared.reasons.length === 0 || cleared.reasons.every((r) => r.includes("Inactive"))) {
          this.release.releaseIfEligible(lead, "auto_recycling_review", now);
        }
      }
      results.push({ lead_id: lead.id, ...aged, eligibility: elig });
    }
    return results;
  }
}
