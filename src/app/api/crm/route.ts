import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import {
  RetirementCrmService,
} from "@/application/crm/RetirementCrmService";
import { PIPELINE_STAGES } from "@/domain/types/lead-intelligence";
import {
  AGENT_CRM_OUTCOMES,
  CRM_FOLLOW_UP_TYPES,
} from "@/domain/types/retirement-crm";

export async function GET() {
  const store = getSimStore();
  const crm = new RetirementCrmService();
  const home = crm.buildAgentHome(store.leads, "Advisor");
  const followUps = crm.groupFollowUps(store.leads);
  return NextResponse.json({
    home,
    followUps,
    leads: store.leads,
    ownership_config: store.ownership_config,
    pipeline_stages: PIPELINE_STAGES,
  });
}

export async function POST(request: Request) {
  const store = getSimStore();
  const body = await request.json();
  const action = body.action as string;
  const crm = new RetirementCrmService();
  const lead = store.leads.find((l) => l.id === body.lead_id);
  if (!lead && action !== "update_ownership_config") {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    if (action === "update_ownership_config") {
      const parsed = z
        .object({ ownership_period_days: z.number().int().positive() })
        .parse(body);
      store.ownership_config = {
        ownership_period_days: parsed.ownership_period_days,
      };
      return NextResponse.json({ ok: true, ownership_config: store.ownership_config });
    }

    if (action === "set_stage") {
      const parsed = z
        .object({ stage: z.enum(PIPELINE_STAGES) })
        .parse(body);
      crm.setStage(lead!, parsed.stage);
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "add_note") {
      const parsed = z.object({ body: z.string().min(1) }).parse(body);
      const note = crm.addNote(lead!, parsed.body, body.created_by ?? "agent");
      return NextResponse.json({ ok: true, lead, note });
    }

    if (action === "create_follow_up") {
      const parsed = z
        .object({
          type: z.enum(CRM_FOLLOW_UP_TYPES),
          title: z.string().min(1),
          body: z.string().nullable().optional(),
          due_at: z.string().nullable().optional(),
        })
        .parse(body);
      const item = crm.createFollowUp(lead!, {
        type: parsed.type,
        title: parsed.title,
        body: parsed.body,
        dueAt: parsed.due_at,
        createdBy: body.created_by ?? "agent",
      });
      return NextResponse.json({ ok: true, lead, follow_up: item });
    }

    if (action === "complete_follow_up") {
      const parsed = z.object({ follow_up_id: z.string() }).parse(body);
      crm.completeFollowUp(lead!, parsed.follow_up_id);
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "contact_attempt") {
      const parsed = z
        .object({
          channel: z.enum(["call", "email", "sms"]),
          result: z.string().nullable().optional(),
        })
        .parse(body);
      crm.recordContactAttempt(
        lead!,
        parsed.channel,
        parsed.result,
        body.created_by ?? "agent",
      );
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "outcome") {
      const parsed = z
        .object({
          outcome: z.enum(AGENT_CRM_OUTCOMES),
          reason: z.string().nullable().optional(),
        })
        .parse(body);
      crm.recordOutcome(lead!, parsed.outcome, parsed.reason);
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "sync_crm") {
      const { AltusCRMProvider } = await import(
        "@/infrastructure/providers/AltusCRMProvider"
      );
      await new AltusCRMProvider().syncSimLead(lead!);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
