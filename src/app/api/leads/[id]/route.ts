import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import { LeadSlaService } from "@/application/intelligence/lifecycle";
import type { LeadOutcome, PipelineStage } from "@/domain/types/lead-intelligence";
import { randomUUID } from "crypto";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
) {
  const { id } = await context.params;
  const store = getSimStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = store.campaigns.find((c) => c.id === lead.campaign_id);
  const org = store.organizations.find(
    (o) => o.id === lead.assigned_organization_id,
  );
  const events = store.events
    .filter((e) => e.lead_id === id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  return NextResponse.json({
    lead,
    events,
    campaignName: campaign?.name ?? null,
    organizationName: org?.name ?? null,
  });
}

export async function POST(
  request: Request,
  context: { params: Params },
) {
  const { id } = await context.params;
  const store = getSimStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const action = body.action as string;
  const now = new Date().toISOString();

  if (action === "viewed") {
    lead.sla = new LeadSlaService().buildTimers({
      createdAt: lead.created_at,
      distributedAt: lead.distribution?.decided_at,
      assignedAt: lead.assigned_organization_id ? lead.updated_at : null,
      firstViewedAt: lead.sla?.first_viewed_at ?? now,
      firstAttemptAt: lead.sla?.first_contact_attempt_at,
      firstContactAt: lead.sla?.first_contact_at,
      appointmentAt: lead.sla?.appointment_at,
      temperature: lead.temperature_key,
    });
    store.events.push({
      id: randomUUID(),
      organization_id: lead.organization_id ?? store.organizations[0]!.id,
      lead_id: lead.id,
      event_type: "lead_viewed",
      occurred_at: now,
      actor_profile_id: null,
      payload: {},
      created_at: now,
    });
    return NextResponse.json({ ok: true, lead });
  }

  if (action === "outcome") {
    const parsed = z
      .object({
        outcome: z.string(),
        stage: z.string().optional(),
        closed_value_cents: z.number().nullable().optional(),
      })
      .parse(body);
    lead.outcome = parsed.outcome as LeadOutcome;
    lead.pipeline_stage = (parsed.stage as PipelineStage) ?? lead.pipeline_stage;
    lead.stage_history = [
      ...(lead.stage_history ?? []),
      { stage: lead.pipeline_stage ?? "Contacted", at: now },
    ];
    if (parsed.outcome === "Won") {
      lead.closed_value_cents = parsed.closed_value_cents ?? 0;
      lead.closed_at = now;
      lead.status = "converted";
    }
    if (parsed.outcome === "Appointment Scheduled") {
      lead.sla = new LeadSlaService().buildTimers({
        createdAt: lead.created_at,
        distributedAt: lead.distribution?.decided_at,
        assignedAt: lead.assigned_organization_id ? lead.updated_at : null,
        firstViewedAt: lead.sla?.first_viewed_at,
        firstAttemptAt: lead.sla?.first_contact_attempt_at ?? now,
        firstContactAt: lead.sla?.first_contact_at ?? now,
        appointmentAt: now,
        temperature: lead.temperature_key,
      });
    }
    store.events.push({
      id: randomUUID(),
      organization_id: lead.organization_id ?? store.organizations[0]!.id,
      lead_id: lead.id,
      event_type: "lead_outcome_recorded",
      occurred_at: now,
      actor_profile_id: null,
      payload: { outcome: parsed.outcome },
      created_at: now,
    });
    return NextResponse.json({ ok: true, lead });
  }

  if (action === "feedback") {
    const parsed = z
      .object({
        feedback: z.enum([
          "Excellent Lead",
          "Good Lead",
          "Poor Fit",
          "Invalid Contact",
          "Duplicate",
        ]),
      })
      .parse(body);
    store.events.push({
      id: randomUUID(),
      organization_id: lead.organization_id ?? store.organizations[0]!.id,
      lead_id: lead.id,
      event_type: "subscriber_lead_feedback",
      occurred_at: now,
      actor_profile_id: null,
      payload: { feedback: parsed.feedback },
      created_at: now,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
