import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import { buildPreCallBrief } from "@/application/crm/preCallBrief";
import {
  AppointmentHandoffService,
  SetterVerificationService,
  selfReportedValue,
} from "@/application/setter/SetterHandoffService";
import {
  FIELD_VERIFICATION_STATUSES,
  SETTER_DISPOSITIONS,
  SETTER_VERIFICATION_FIELDS,
} from "@/domain/types/setter-handoff";
import {
  requireOrgAuth,
  assertSameOrganization,
} from "@/infrastructure/security/requireOrgAuth";
import {
  assertPermission,
  AuthorizationError,
} from "@/application/authorization";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
) {
  const auth = await requireOrgAuth({ permission: "setter.leads.view" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const store = getSimStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const verification = new SetterVerificationService().ensure(lead);
  const campaign = store.campaigns.find((c) => c.id === lead.campaign_id);
  const org = store.organizations.find(
    (o) => o.id === (lead.assigned_organization_id ?? lead.organization_id),
  );
  const handoff = new AppointmentHandoffService();
  const orgId = lead.assigned_organization_id ?? lead.organization_id ?? org?.id;
  const agents = orgId
    ? handoff.listEligibleAgents(orgId, lead.state)
    : [];
  const events = store.events
    .filter((e) => e.lead_id === id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const fieldDefaults = SETTER_VERIFICATION_FIELDS.map((field) => ({
    field,
    self_reported: selfReportedValue(lead, field),
    verification: verification.fields.find((f) => f.field === field)!,
  }));

  return NextResponse.json({
    lead,
    verification,
    preCallBrief: buildPreCallBrief(lead),
    campaignName: campaign?.name ?? null,
    campaignSource:
      lead.attribution.ad_provider ?? lead.attribution.source ?? null,
    organizationName: org?.name ?? null,
    agents,
    introductions: store.agent_introductions.filter(
      (i) => i.organization_id === orgId && i.active,
    ),
    appointments: lead.appointments ?? [],
    events,
    fieldDefaults,
  });
}

export async function POST(
  request: Request,
  context: { params: Params },
) {
  const auth = await requireOrgAuth({ permission: "setter.leads.verify" });
  if (!auth.ok) return auth.response;

  const granted = auth.ctx.permissions;
  const { id } = await context.params;
  const store = getSimStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    auth.ctx.organizationId &&
    lead.organization_id &&
    !assertSameOrganization(
      auth.ctx,
      lead.organization_id ?? lead.assigned_organization_id,
    )
  ) {
    return NextResponse.json(
      { error: "Forbidden", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const action = body.action as string;
  const verification = new SetterVerificationService();
  const handoff = new AppointmentHandoffService();

  try {
    if (action === "open") {
      assertPermission(granted, "setter.leads.view");
      const record = verification.open(lead, body.setter_user_id ?? "setter-sim");
      return NextResponse.json({ ok: true, lead, verification: record });
    }

    if (action === "call_attempted") {
      assertPermission(granted, "setter.leads.verify");
      const record = verification.markCallAttempted(lead);
      return NextResponse.json({ ok: true, lead, verification: record });
    }

    if (action === "verify_field") {
      assertPermission(granted, "setter.leads.verify");
      const parsed = z
        .object({
          field: z.enum(SETTER_VERIFICATION_FIELDS),
          status: z.enum(FIELD_VERIFICATION_STATUSES),
          updated_value: z.string().nullable().optional(),
          note: z.string().nullable().optional(),
        })
        .parse(body);
      const originalAnswers = { ...lead.assessment_answers };
      const record = verification.verifyField(lead, parsed.field, parsed.status, {
        updated_value: parsed.updated_value,
        note: parsed.note,
        setterUserId: body.setter_user_id ?? "setter-sim",
      });
      if (
        JSON.stringify(lead.assessment_answers) !==
        JSON.stringify(originalAnswers)
      ) {
        return NextResponse.json(
          { error: "Assessment answers were mutated" },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, lead, verification: record });
    }

    if (action === "confirm_assets") {
      assertPermission(granted, "setter.leads.verify");
      const record = verification.confirmAssets(
        lead,
        body.setter_user_id ?? "setter-sim",
      );
      return NextResponse.json({ ok: true, lead, verification: record });
    }

    if (action === "disposition") {
      assertPermission(granted, "setter.leads.verify");
      const parsed = z
        .object({
          disposition: z.enum(SETTER_DISPOSITIONS),
          reason: z.string().nullable().optional(),
        })
        .parse(body);
      const record = verification.setDisposition(
        lead,
        parsed.disposition,
        parsed.reason,
        body.setter_user_id ?? "setter-sim",
      );
      return NextResponse.json({ ok: true, lead, verification: record });
    }

    if (action === "schedule_appointment") {
      assertPermission(granted, "setter.appointments.manage");
      const parsed = z
        .object({
          agent_id: z.string().uuid(),
          scheduled_at: z.string().min(1),
          preferred_contact_method: z.string().min(1),
          notes: z.string().nullable().optional(),
        })
        .parse(body);
      const appointment = handoff.scheduleAppointment({
        lead,
        agentId: parsed.agent_id,
        scheduledAt: parsed.scheduled_at,
        preferredContactMethod: parsed.preferred_contact_method,
        notes: parsed.notes,
        createdBy: body.setter_user_id ?? "setter-sim",
      });
      return NextResponse.json({
        ok: true,
        lead,
        appointment,
        introduction: handoff.getIntroduction(parsed.agent_id),
      });
    }

    if (action === "assign_agent") {
      assertPermission(granted, "setter.appointments.manage");
      const parsed = z
        .object({
          agent_id: z.string().uuid(),
          appointment_id: z.string().uuid().nullable().optional(),
        })
        .parse(body);
      const result = await handoff.assignAgentAndHandoff({
        lead,
        agentId: parsed.agent_id,
        appointmentId: parsed.appointment_id,
      });
      return NextResponse.json({
        ok: true,
        lead: result.lead,
        agent: result.agent,
        notifications: store.notifications.filter((n) => n.lead_id === lead.id),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
