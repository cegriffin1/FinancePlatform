import { randomUUID } from "crypto";
import {
  DEFAULT_OWNERSHIP_CONFIG,
  computeOwnershipExpiry,
  followUpBucket,
  isOwnershipExpired,
  type AgentCrmOutcome,
  type CrmContactAttempt,
  type CrmFollowUp,
  type CrmFollowUpType,
  type CrmNote,
  type LeadOwnership,
  type OwnershipConfig,
} from "@/domain/types/retirement-crm";
import type { PipelineStage } from "@/domain/types/lead-intelligence";
import type { SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { AltusCRMProvider } from "@/infrastructure/providers/AltusCRMProvider";
import { nextStageAfterOutcome } from "@/application/intelligence/lifecycle";

function nowIso() {
  return new Date().toISOString();
}

function appendEvent(lead: SimLead, eventType: string, payload: Record<string, unknown> = {}) {
  const store = getSimStore();
  store.events.push({
    id: randomUUID(),
    organization_id:
      lead.assigned_organization_id ??
      lead.organization_id ??
      store.organizations[0]!.id,
    lead_id: lead.id,
    event_type: eventType,
    occurred_at: nowIso(),
    actor_profile_id: null,
    payload,
    created_at: nowIso(),
  });
}

export function priorityScore(lead: SimLead): number {
  return (
    lead.qualification?.setter_priority ??
    lead.qualification?.opportunity.opportunity_score ??
    lead.intelligence?.overall_priority_score ??
    lead.score
  );
}

export function estimatePipelineValueCents(lead: SimLead): number {
  if (lead.opportunity_value_cents != null) return lead.opportunity_value_cents;
  const tier = lead.qualification?.asset.commercial_tier;
  if (tier === "BLACK") return 300_000_00;
  if (tier === "DIAMOND") return 150_000_00;
  if (tier === "GOLD") return 75_000_00;
  return 25_000_00;
}

export class LeadOwnershipService {
  assign(
    lead: SimLead,
    input: {
      organizationId: string;
      ownerId?: string | null;
      ownerLabel?: string | null;
      source: string;
      config?: OwnershipConfig;
      assignedAt?: string;
    },
  ): LeadOwnership {
    const config = input.config ?? getSimStore().ownership_config ?? DEFAULT_OWNERSHIP_CONFIG;
    const assignedAt = input.assignedAt ?? nowIso();
    const ownership: LeadOwnership = {
      owner_id: input.ownerId ?? null,
      owner_label: input.ownerLabel ?? null,
      organization_id: input.organizationId,
      assigned_at: assignedAt,
      ownership_started_at: assignedAt,
      ownership_expires_at: computeOwnershipExpiry(assignedAt, config),
      source: input.source,
      period_days: config.ownership_period_days,
    };
    lead.ownership = ownership;
    lead.assigned_organization_id = input.organizationId;
    if (input.ownerLabel) lead.assigned_agent_label = input.ownerLabel;
    if (input.ownerId) lead.assigned_agent_id = input.ownerId;
    lead.updated_at = nowIso();
    appendEvent(lead, "ownership_assigned", { ...ownership });
    if (
      !lead.inventory_status ||
      lead.inventory_status === "NEW" ||
      lead.inventory_status === "QUALIFIED" ||
      lead.inventory_status === "MARKETPLACE" ||
      lead.inventory_status === "REPURCHASED" ||
      lead.inventory_status === "PURCHASED_ASSIGNED"
    ) {
      lead.inventory_status = "ACTIVE_OWNERSHIP";
    }
    return ownership;
  }
}

export class RetirementCrmService {
  private readonly ownership = new LeadOwnershipService();
  private readonly crm = new AltusCRMProvider();

  setStage(lead: SimLead, stage: PipelineStage, reason?: string) {
    lead.pipeline_stage = stage;
    lead.stage_history = [
      ...(lead.stage_history ?? []),
      { stage, at: nowIso() },
    ];
    lead.updated_at = nowIso();
    appendEvent(lead, "pipeline_stage_changed", { stage, reason: reason ?? null });
    return lead;
  }

  addNote(lead: SimLead, body: string, createdBy?: string | null): CrmNote {
    const note: CrmNote = {
      id: randomUUID(),
      lead_id: lead.id,
      body,
      created_by: createdBy ?? null,
      created_at: nowIso(),
    };
    lead.crm_notes = [...(lead.crm_notes ?? []), note];
    // Notes are also follow-ups without due date
    this.createFollowUp(lead, {
      type: "Note",
      title: body.slice(0, 80),
      body,
      dueAt: null,
      createdBy,
    });
    appendEvent(lead, "note_added", { note_id: note.id });
    lead.updated_at = nowIso();
    return note;
  }

  createFollowUp(
    lead: SimLead,
    input: {
      type: CrmFollowUpType;
      title: string;
      body?: string | null;
      dueAt?: string | null;
      createdBy?: string | null;
    },
  ): CrmFollowUp {
    const item: CrmFollowUp = {
      id: randomUUID(),
      lead_id: lead.id,
      organization_id: lead.assigned_organization_id ?? lead.organization_id,
      type: input.type,
      title: input.title,
      due_at: input.dueAt ?? null,
      status: "open",
      body: input.body ?? null,
      created_by: input.createdBy ?? null,
      created_at: nowIso(),
      completed_at: null,
    };
    lead.follow_ups = [...(lead.follow_ups ?? []), item];
    const store = getSimStore();
    store.follow_ups.push(item);
    appendEvent(lead, "follow_up_created", {
      follow_up_id: item.id,
      type: item.type,
      due_at: item.due_at,
    });
    lead.updated_at = nowIso();
    return item;
  }

  completeFollowUp(lead: SimLead, followUpId: string) {
    const item = (lead.follow_ups ?? []).find((f) => f.id === followUpId);
    if (!item) throw new Error("Follow-up not found");
    item.status = "done";
    item.completed_at = nowIso();
    const store = getSimStore();
    const global = store.follow_ups.find((f) => f.id === followUpId);
    if (global) {
      global.status = "done";
      global.completed_at = item.completed_at;
    }
    appendEvent(lead, "follow_up_completed", { follow_up_id: followUpId });
    lead.updated_at = nowIso();
    return item;
  }

  recordContactAttempt(
    lead: SimLead,
    channel: CrmContactAttempt["channel"],
    result?: string | null,
    createdBy?: string | null,
  ): CrmContactAttempt {
    const attempt: CrmContactAttempt = {
      id: randomUUID(),
      lead_id: lead.id,
      channel,
      result: result ?? null,
      created_by: createdBy ?? null,
      created_at: nowIso(),
    };
    lead.contact_attempts = [...(lead.contact_attempts ?? []), attempt];
    if (!lead.pipeline_stage || lead.pipeline_stage === "NEW" || lead.pipeline_stage === "APPOINTMENT_SET" || lead.pipeline_stage === "VERIFIED") {
      this.setStage(lead, "CONTACTED", `Contact via ${channel}`);
    }
    appendEvent(lead, "contact_attempted", {
      channel,
      result: result ?? null,
    });
    lead.updated_at = nowIso();
    return attempt;
  }

  recordOutcome(lead: SimLead, outcome: AgentCrmOutcome, reason?: string | null) {
    lead.outcome = outcome;
    lead.outcome_reason = reason ?? null;
    const stage = nextStageAfterOutcome(outcome);
    this.setStage(lead, stage, outcome);
    if (outcome === "Won") {
      lead.status = "converted";
      lead.closed_at = nowIso();
      lead.closed_value_cents = lead.closed_value_cents ?? estimatePipelineValueCents(lead);
    }
    if (outcome === "Lost" || outcome === "Not Interested" || outcome === "Wrong Fit") {
      lead.status = "rejected";
      lead.closed_at = nowIso();
    }
    if (outcome === "Nurture") {
      lead.status = "nurture";
      lead.distribution_status = "nurture";
    }

    // Feed campaign quality analytics
    const store = getSimStore();
    const campaign = store.campaigns.find((c) => c.id === lead.campaign_id);
    if (campaign) {
      campaign.analytics.outcome_counts = {
        ...(campaign.analytics.outcome_counts ?? {}),
        [outcome]: (campaign.analytics.outcome_counts?.[outcome] ?? 0) + 1,
      };
      if (outcome === "Won") {
        campaign.analytics.won = (campaign.analytics.won ?? 0) + 1;
      }
      if (outcome === "Lost" || outcome === "Not Interested" || outcome === "Wrong Fit") {
        campaign.analytics.lost = (campaign.analytics.lost ?? 0) + 1;
      }
      if (outcome === "Qualified Opportunity") {
        campaign.analytics.qualified_opportunities =
          (campaign.analytics.qualified_opportunities ?? 0) + 1;
      }
    }

    appendEvent(lead, "crm_outcome_recorded", { outcome, reason: reason ?? null });
    void this.crm.syncSimLead(lead);
    lead.updated_at = nowIso();
    return lead;
  }

  ensureOwnershipOnAssign(lead: SimLead, source = "distribution") {
    if (lead.ownership) return lead.ownership;
    const orgId = lead.assigned_organization_id ?? lead.organization_id;
    if (!orgId) return null;
    return this.ownership.assign(lead, {
      organizationId: orgId,
      ownerId: lead.assigned_agent_id,
      ownerLabel: lead.assigned_agent_label,
      source,
    });
  }

  buildAgentHome(leads: SimLead[], agentLabel = "Advisor") {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const sorted = [...leads].sort((a, b) => priorityScore(b) - priorityScore(a));

    const appointmentsToday = sorted.filter((l) =>
      (l.appointments ?? []).some((a) => {
        const t = new Date(a.scheduled_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }),
    );

    const newOpportunities = sorted.filter(
      (l) =>
        l.pipeline_stage === "NEW" ||
        l.pipeline_stage === "VERIFIED" ||
        l.pipeline_stage === "APPOINTMENT_SET" ||
        (!l.sla?.first_viewed_at && l.qualification),
    );

    const readyNow = sorted.filter(
      (l) =>
        l.qualification?.temperature.temperature === "READY_NOW" ||
        l.temperature_key === "READY_NOW" ||
        l.temperature_key === "VERY_HOT",
    );

    const callbacks = sorted.filter((l) =>
      (l.follow_ups ?? []).some(
        (f) => f.type === "Callback" && f.status === "open",
      ),
    );

    const needsFollowUp = sorted.filter((l) =>
      (l.follow_ups ?? []).some(
        (f) =>
          f.status === "open" &&
          followUpBucket(f, now) !== "done" &&
          (followUpBucket(f, now) === "today" || followUpBucket(f, now) === "overdue"),
      ),
    );

    const nurture = sorted.filter(
      (l) => l.pipeline_stage === "NURTURE" || l.status === "nurture",
    );

    const agedLeads = sorted.filter(
      (l) => isOwnershipExpired(l.ownership, now) || this.isAged(l, now),
    );

    const openPipeline = sorted.filter(
      (l) => !["WON", "LOST", "NURTURE"].includes(l.pipeline_stage ?? ""),
    );
    const pipelineValue = openPipeline.reduce(
      (sum, l) => sum + estimatePipelineValueCents(l),
      0,
    );
    const hotLeads = sorted.filter((l) =>
      ["HOT", "VERY_HOT", "READY_NOW", "PRIORITY"].includes(
        l.qualification?.temperature.temperature ?? l.temperature_key,
      ),
    );
    const slaRisk = sorted.filter((l) => l.sla?.sla_status === "breached");

    const greetingHour = new Date().getHours();
    const greeting =
      greetingHour < 12 ? "GOOD MORNING" : greetingHour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";

    return {
      greeting: `${greeting}, ${agentLabel.toUpperCase()}`,
      metrics: {
        new_opportunities: newOpportunities.length,
        appointments_today: appointmentsToday.length,
        pipeline_value_cents: pipelineValue,
        hot_leads: hotLeads.length,
        follow_ups: needsFollowUp.length,
        sla_risk: slaRisk.length,
      },
      buckets: {
        new_opportunities: newOpportunities,
        appointments_today: appointmentsToday,
        ready_now: readyNow,
        needs_follow_up: needsFollowUp,
        callbacks,
        nurture,
        aged_leads: agedLeads,
      },
      priority_opportunities: sorted
        .filter((l) => !["WON", "LOST"].includes(l.pipeline_stage ?? ""))
        .slice(0, 12),
    };
  }

  private isAged(lead: SimLead, now: number) {
    const created = new Date(lead.created_at).getTime();
    const days = (now - created) / (24 * 60 * 60 * 1000);
    const period =
      lead.ownership?.period_days ??
      getSimStore().ownership_config.ownership_period_days;
    return days >= period * 0.75 && !["WON", "LOST"].includes(lead.pipeline_stage ?? "");
  }

  groupFollowUps(leads: SimLead[]) {
    const items = leads.flatMap((l) => l.follow_ups ?? []);
    const now = Date.now();
    return {
      today: items.filter((i) => followUpBucket(i, now) === "today"),
      overdue: items.filter((i) => followUpBucket(i, now) === "overdue"),
      upcoming: items.filter((i) => followUpBucket(i, now) === "upcoming"),
    };
  }
}
