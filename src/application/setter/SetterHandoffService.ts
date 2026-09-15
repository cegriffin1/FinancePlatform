import type {
  EligibleAgent,
  AgentIntroductionProfile,
  LeadAppointment,
  NotificationChannel,
  OutboundNotificationPayload,
  SetterDisposition,
  SetterFieldVerification,
  SetterVerificationFieldKey,
  SetterVerificationRecord,
  FieldVerificationStatus,
} from "@/domain/types/setter-handoff";
import {
  DISPOSITIONS_REQUIRING_REASON,
  SETTER_VERIFICATION_FIELDS,
} from "@/domain/types/setter-handoff";
import type { SimLead, SimNotification } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { randomUUID } from "crypto";
import { LeadOwnershipService } from "@/application/crm/RetirementCrmService";
import { buildPreCallBrief } from "@/application/crm/preCallBrief";

function nowIso() {
  return new Date().toISOString();
}

function appendEvent(
  lead: SimLead,
  eventType: string,
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
    event_type: eventType,
    occurred_at: nowIso(),
    actor_profile_id: null,
    payload,
    created_at: nowIso(),
  });
}

export function emptyVerification(leadId: string): SetterVerificationRecord {
  return {
    lead_id: leadId,
    fields: SETTER_VERIFICATION_FIELDS.map((field) => ({
      field,
      status: "SELF_REPORTED" as FieldVerificationStatus,
      updated_value: null,
      note: null,
      verified_at: null,
      verified_by: null,
    })),
    asset_verification_status: "SELF_REPORTED",
    disposition: null,
    disposition_reason: null,
    call_attempted_at: null,
    opened_at: null,
    verified_at: null,
    setter_user_id: null,
    notes: null,
    updated_at: nowIso(),
  };
}

/** In-app channel — primary MVP delivery. */
export class InAppNotificationChannel implements NotificationChannel {
  readonly channel = "in_app" as const;

  async send(payload: OutboundNotificationPayload) {
    const store = getSimStore();
    const notification: SimNotification = {
      id: randomUUID(),
      organization_id: payload.organization_id,
      lead_id: payload.lead_id,
      title: payload.title,
      body: payload.body,
      created_at: nowIso(),
      read: false,
      channel: "in_app",
      kind: payload.kind,
      recipient_agent_id: payload.recipient_agent_id ?? null,
      metadata: payload.metadata ?? {},
    };
    store.notifications.unshift(notification);
    return { delivered: true };
  }
}

/** Stubs keep interfaces ready for Email / SMS / D365 / Teams / contact center. */
export class DeferredExternalNotificationChannel implements NotificationChannel {
  constructor(readonly channel: NotificationChannel["channel"]) {}

  async send(_payload: OutboundNotificationPayload) {
    void _payload;
    return { delivered: false, deferred: true };
  }
}

export class NotificationDispatcher {
  constructor(private readonly channels: NotificationChannel[] = [
    new InAppNotificationChannel(),
    new DeferredExternalNotificationChannel("email"),
    new DeferredExternalNotificationChannel("sms"),
    new DeferredExternalNotificationChannel("d365"),
    new DeferredExternalNotificationChannel("teams"),
    new DeferredExternalNotificationChannel("contact_center"),
  ]) {}

  async notify(
    payload: OutboundNotificationPayload,
    prefer: NotificationChannel["channel"][] = ["in_app"],
  ) {
    const results = [];
    for (const channel of this.channels) {
      if (!prefer.includes(channel.channel) && channel.channel !== "in_app") {
        // Keep deferred channels warm without forcing delivery
        continue;
      }
      if (prefer.includes(channel.channel) || channel.channel === "in_app") {
        results.push({ channel: channel.channel, ...(await channel.send(payload)) });
      }
    }
    return results;
  }
}

export class SetterVerificationService {
  ensure(lead: SimLead): SetterVerificationRecord {
    if (!lead.setter_verification) {
      lead.setter_verification = emptyVerification(lead.id);
    }
    return lead.setter_verification;
  }

  open(lead: SimLead, setterUserId?: string | null) {
    const record = this.ensure(lead);
    if (!record.opened_at) {
      record.opened_at = nowIso();
      record.setter_user_id = setterUserId ?? record.setter_user_id;
      record.updated_at = nowIso();
      appendEvent(lead, "setter_opened", { setter_user_id: setterUserId ?? null });
    }
    lead.updated_at = nowIso();
    return record;
  }

  markCallAttempted(lead: SimLead) {
    const record = this.ensure(lead);
    record.call_attempted_at = nowIso();
    record.updated_at = nowIso();
    appendEvent(lead, "call_attempted", {});
    lead.updated_at = nowIso();
    return record;
  }

  /**
   * Updates setter verification only — never mutates assessment_answers.
   */
  verifyField(
    lead: SimLead,
    field: SetterVerificationFieldKey,
    status: FieldVerificationStatus,
    opts?: { updated_value?: string | null; note?: string | null; setterUserId?: string | null },
  ) {
    const original = lead.assessment_answers;
    const snapshot = { ...original };
    const record = this.ensure(lead);
    const row = record.fields.find((f) => f.field === field);
    if (!row) throw new Error(`Unknown verification field: ${field}`);

    row.status = status;
    row.updated_value = status === "UPDATED" ? (opts?.updated_value ?? null) : null;
    row.note = opts?.note ?? null;
    row.verified_at = nowIso();
    row.verified_by = opts?.setterUserId ?? null;
    record.updated_at = nowIso();

    if (field === "repositionable_assets" && status === "CONFIRMED") {
      this.confirmAssets(lead, opts?.setterUserId);
    }

    appendEvent(lead, "field_verified", {
      field,
      status,
      updated_value: row.updated_value,
    });

    // Guard: assessment answers must remain identical
    if (JSON.stringify(lead.assessment_answers) !== JSON.stringify(snapshot)) {
      lead.assessment_answers = snapshot;
      throw new Error("Setter verification must not mutate assessment answers");
    }

    lead.updated_at = nowIso();
    return record;
  }

  /**
   * SELF_REPORTED → SETTER_CONFIRMED only when setter confirms prospect restated assets.
   * Not third-party financial verification.
   */
  confirmAssets(lead: SimLead, setterUserId?: string | null) {
    const record = this.ensure(lead);
    record.asset_verification_status = "SETTER_CONFIRMED";
    record.updated_at = nowIso();
    if (lead.qualification) {
      lead.qualification = {
        ...lead.qualification,
        asset: {
          ...lead.qualification.asset,
          verification_status: "SETTER_CONFIRMED",
        },
      };
    }
    appendEvent(lead, "assets_confirmed", {
      note: "Setter confirmed prospect restated self-reported assets",
      setter_user_id: setterUserId ?? null,
    });
    lead.updated_at = nowIso();
    return record;
  }

  setDisposition(
    lead: SimLead,
    disposition: SetterDisposition,
    reason?: string | null,
    setterUserId?: string | null,
  ) {
    if (DISPOSITIONS_REQUIRING_REASON.includes(disposition) && !reason?.trim()) {
      throw new Error(`Disposition ${disposition} requires a reason`);
    }
    const record = this.ensure(lead);
    record.disposition = disposition;
    record.disposition_reason = reason?.trim() || null;
    record.setter_user_id = setterUserId ?? record.setter_user_id;
    record.updated_at = nowIso();

    if (disposition === "VERIFIED" || disposition === "APPOINTMENT_SET") {
      record.verified_at = nowIso();
      if (lead.qualification) {
        lead.qualification = {
          ...lead.qualification,
          commercial_status:
            disposition === "APPOINTMENT_SET"
              ? "APPOINTMENT_READY"
              : "SETTER_VERIFIED",
          recommended_next_step:
            disposition === "APPOINTMENT_SET"
              ? "Confirm appointment"
              : "Schedule advisor conversation",
        };
      }
      lead.pipeline_stage =
        disposition === "APPOINTMENT_SET" ? "APPOINTMENT_SET" : "VERIFIED";
      lead.stage_history = [
        ...(lead.stage_history ?? []),
        { stage: lead.pipeline_stage, at: nowIso() },
      ];
    }

    if (disposition === "NURTURE" || disposition === "ASSET_THRESHOLD_NOT_MET") {
      lead.status = "nurture";
      lead.distribution_status = "nurture";
      if (lead.qualification) {
        lead.qualification = {
          ...lead.qualification,
          commercial_status: "NURTURE",
          agent_eligible: false,
        };
      }
    }

    if (disposition === "DISQUALIFIED" || disposition === "DUPLICATE") {
      lead.status = "rejected";
      if (lead.qualification) {
        lead.qualification = {
          ...lead.qualification,
          commercial_status: "DISQUALIFIED",
          agent_eligible: false,
        };
      }
    }

    appendEvent(lead, "setter_disposition", {
      disposition,
      reason: record.disposition_reason,
    });
    lead.updated_at = nowIso();
    return record;
  }
}

export class AppointmentHandoffService {
  private readonly verification = new SetterVerificationService();
  private readonly notifications = new NotificationDispatcher();

  listEligibleAgents(organizationId: string, state?: string): EligibleAgent[] {
    const store = getSimStore();
    return store.agents.filter(
      (a) =>
        a.organization_id === organizationId &&
        a.active &&
        (!state || a.states.includes(state) || a.states.includes("US")),
    );
  }

  getIntroduction(agentId: string): AgentIntroductionProfile | null {
    return getSimStore().agent_introductions.find((p) => p.agent_id === agentId && p.active) ?? null;
  }

  scheduleAppointment(input: {
    lead: SimLead;
    agentId: string;
    scheduledAt: string;
    preferredContactMethod: string;
    notes?: string | null;
    createdBy?: string | null;
  }): LeadAppointment {
    const store = getSimStore();
    const agent = store.agents.find((a) => a.id === input.agentId);
    if (!agent) throw new Error("Agent not found");
    if (!agent.active) throw new Error("Agent is not active");

    const orgId =
      input.lead.assigned_organization_id ??
      input.lead.organization_id ??
      agent.organization_id;

    const appointment: LeadAppointment = {
      id: randomUUID(),
      lead_id: input.lead.id,
      organization_id: orgId,
      agent_id: agent.id,
      agent_name: agent.name,
      scheduled_at: input.scheduledAt,
      preferred_contact_method: input.preferredContactMethod,
      notes: input.notes ?? null,
      status: "confirmed",
      created_by: input.createdBy ?? null,
      created_at: nowIso(),
    };

    store.appointments.push(appointment);
    input.lead.appointments = [...(input.lead.appointments ?? []), appointment];
    input.lead.preferred_contact = input.preferredContactMethod;

    this.verification.ensure(input.lead);
    this.verification.setDisposition(
      input.lead,
      "APPOINTMENT_SET",
      null,
      input.createdBy,
    );

    if (input.lead.qualification) {
      input.lead.qualification = {
        ...input.lead.qualification,
        commercial_status: "APPOINTMENT_READY",
        recommended_next_step: "Confirm appointment",
        agent_eligible: true,
      };
    }

    appendEvent(input.lead, "appointment_created", {
      appointment_id: appointment.id,
      agent_id: agent.id,
      scheduled_at: appointment.scheduled_at,
    });

    return appointment;
  }

  async assignAgentAndHandoff(input: {
    lead: SimLead;
    agentId: string;
    appointmentId?: string | null;
  }) {
    const store = getSimStore();
    const agent = store.agents.find((a) => a.id === input.agentId);
    if (!agent) throw new Error("Agent not found");

    const orgId =
      input.lead.assigned_organization_id ??
      input.lead.organization_id ??
      agent.organization_id;

    input.lead.assigned_organization_id = orgId;
    input.lead.assigned_agent_id = agent.id;
    input.lead.assigned_agent_label = agent.name;
    input.lead.distribution_status = "assigned";
    input.lead.status = "working";
    input.lead.pipeline_stage = "APPOINTMENT_SET";
    input.lead.stage_history = [
      ...(input.lead.stage_history ?? []),
      { stage: "APPOINTMENT_SET", at: nowIso() },
    ];

    if (input.lead.qualification) {
      input.lead.qualification = {
        ...input.lead.qualification,
        commercial_status: "ASSIGNED",
        recommended_next_step: "Advisor follow-up",
        agent_eligible: true,
      };
    }

    // Establish configurable ownership window on agent handoff
    new LeadOwnershipService().assign(input.lead, {
      organizationId: orgId,
      ownerId: agent.id,
      ownerLabel: agent.name,
      source: "setter_handoff",
    });

    appendEvent(input.lead, "agent_assigned", {
      agent_id: agent.id,
      agent_name: agent.name,
      appointment_id: input.appointmentId ?? null,
    });

    const q = input.lead.qualification;
    const verification = input.lead.setter_verification;
    const appointment =
      input.lead.appointments?.find((a) => a.id === input.appointmentId) ??
      input.lead.appointments?.[input.lead.appointments.length - 1] ??
      null;

    const brief = buildPreCallBrief(input.lead);
    const body = [
      `Opportunity Score: ${q?.opportunity.opportunity_score ?? input.lead.score}`,
      `Temperature: ${q?.temperature.temperature ?? input.lead.temperature_key} (${q?.temperature.temperature_score ?? "—"}°)`,
      `Asset tier: ${q?.asset.commercial_tier ?? "—"}`,
      `Assets: ${q?.asset.repositionable_asset_band ?? "—"} (${verification?.asset_verification_status ?? "SELF_REPORTED"})`,
      `Appointment: ${appointment?.scheduled_at ?? "—"}`,
      `Pre-call: ${brief}`,
      `Campaign: ${input.lead.attribution.ad_provider ?? input.lead.attribution.source ?? "—"}`,
    ].join(" · ");

    await this.notifications.notify({
      organization_id: orgId,
      lead_id: input.lead.id,
      recipient_agent_id: agent.id,
      title: "NEW VERIFIED RETIREMENT OPPORTUNITY",
      body,
      kind: "verified_opportunity",
      metadata: {
        opportunity_score: q?.opportunity.opportunity_score,
        temperature: q?.temperature.temperature,
        asset_tier: q?.asset.commercial_tier,
        setter_verification: verification,
        appointment,
        pre_call_brief: brief,
        assessment_answers: input.lead.assessment_answers,
        campaign_source: input.lead.attribution,
      },
    });

    appendEvent(input.lead, "agent_notified", {
      agent_id: agent.id,
      title: "NEW VERIFIED RETIREMENT OPPORTUNITY",
    });

    input.lead.updated_at = nowIso();
    return { lead: input.lead, agent };
  }
}

export function selfReportedValue(
  lead: SimLead,
  field: SetterVerificationFieldKey,
): string {
  const a = lead.assessment_answers;
  switch (field) {
    case "identity":
      return `${lead.first_name} ${lead.last_name}`;
    case "state":
      return lead.state || a.state || "—";
    case "contact":
      return `${lead.email} · ${lead.phone}`;
    case "repositionable_assets":
      return a.repositionable_assets ?? "—";
    case "asset_location":
      return a.asset_location ?? "—";
    case "primary_objective":
      return a.primary_objective ?? "—";
    case "decision_timeline":
      return a.decision_timeline ?? "—";
    case "appointment_interest":
      return lead.appointments?.length ? "Appointment set" : "Interested / TBD";
    default:
      return "—";
  }
}

export type { SetterFieldVerification };
