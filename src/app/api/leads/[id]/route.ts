import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import { LeadSlaService } from "@/application/intelligence/lifecycle";
import type { LeadOutcome, PipelineStage } from "@/domain/types/lead-intelligence";
import { randomUUID } from "crypto";
import {
  requireOrgAuth,
  assertSameOrganization,
} from "@/infrastructure/security/requireOrgAuth";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
) {
  const auth = await requireOrgAuth({ permission: "leads.view_own" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (isSupabaseDataMode() && auth.ctx.organizationId) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data: lead, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .eq("organization_id", auth.ctx.organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!lead) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const [{ data: campaign }, { data: org }, { data: score }, { data: temps }] =
        await Promise.all([
          lead.campaign_id
            ? supabase
                .from("campaigns")
                .select("id, name")
                .eq("id", lead.campaign_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("organizations")
            .select("id, name")
            .eq("id", auth.ctx.organizationId)
            .maybeSingle(),
          supabase
            .from("lead_scores")
            .select("*")
            .eq("lead_id", id)
            .eq("organization_id", auth.ctx.organizationId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("lead_temperature_snapshots")
            .select("*")
            .eq("lead_id", id)
            .eq("organization_id", auth.ctx.organizationId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      const mapped = {
        ...lead,
        operational_temperature: lead.operational_temperature,
        temperature_key: lead.temperature_key ?? lead.operational_temperature,
        score: lead.opportunity_score ?? lead.score,
        assessment_answers: lead.assessment_answers ?? {},
        attribution: lead.attribution ?? {},
        qualification: score
          ? {
              opportunity: {
                opportunity_score: score.total_score,
                classification: score.classification,
                explanation: score.explanation,
                score_version: score.scoring_version,
              },
            }
          : undefined,
      };

      return NextResponse.json({
        lead: mapped,
        events: [],
        campaignName: campaign?.name ?? null,
        organizationName: org?.name ?? null,
        temperatureHistory: temps ?? [],
        dataMode: "supabase",
      });
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Failed to load durable lead detail", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      return NextResponse.json(
        { error: "Unable to load lead", code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
  }

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
  const auth = await requireOrgAuth({ permission: "leads.update" });
  if (!auth.ok) return auth.response;

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
    // Opening a lead is NOT meaningful prospect interaction
    const { LeadEngagementService } = await import(
      "@/application/lifecycle/LeadLifecycleService"
    );
    new LeadEngagementService().recordSystemActivity(lead, "agent_opened_lead", {
      note: "Agent opened lead record",
    });
    store.events.push({
      id: randomUUID(),
      organization_id: lead.organization_id ?? store.organizations[0]!.id,
      lead_id: lead.id,
      event_type: "lead_viewed",
      occurred_at: now,
      actor_profile_id: null,
      payload: { meaningful: false },
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
      { stage: lead.pipeline_stage ?? "CONTACTED", at: now },
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
