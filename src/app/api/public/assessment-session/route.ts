import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import { AssessmentSessionService } from "@/application/growth/AssessmentSessionService";
import { rateLimit } from "@/lib/rateLimit";
import { RETIREMENT_OPPORTUNITY_V1 } from "@/application/retirement/assessmentDefinition";

const createSchema = z.object({
  organizationSlug: z.string().min(1),
  campaignSlug: z.string().min(1),
  attribution: z
    .object({
      provider: z.string().nullable().optional(),
      utm_source: z.string().nullable().optional(),
      utm_medium: z.string().nullable().optional(),
      utm_campaign: z.string().nullable().optional(),
      utm_content: z.string().nullable().optional(),
      utm_term: z.string().nullable().optional(),
      external_campaign_id: z.string().nullable().optional(),
      external_ad_set_id: z.string().nullable().optional(),
      external_ad_id: z.string().nullable().optional(),
      external_creative_id: z.string().nullable().optional(),
      referrer: z.string().nullable().optional(),
      source_channel: z.string().nullable().optional(),
      landing_page: z.string().nullable().optional(),
    })
    .default({}),
});

const patchSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum([
    "start",
    "answer",
    "contact_started",
    "abandon",
  ]),
  questionId: z.string().optional(),
  value: z.string().optional(),
  stage: z.string().nullable().optional(),
});

/** Create AssessmentSession on campaign entry — attribution captured immediately. */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`assessment-session:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = createSchema.parse(await request.json());
    const store = getSimStore();
    const campaign = store.campaigns.find(
      (c) =>
        c.organization_slug === body.organizationSlug &&
        c.slug === body.campaignSlug,
    );
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const session = new AssessmentSessionService().create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id ?? campaign.owner_id,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      assessment_definition_id:
        campaign.qualification_template_key ??
        campaign.assessment_template_key ??
        RETIREMENT_OPPORTUNITY_V1.key,
      assessment_version: RETIREMENT_OPPORTUNITY_V1.version,
      attribution: body.attribution,
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      assessment_definition_id: session.assessment_definition_id,
      assessment_version: session.assessment_version,
      contactable: false,
      first_touch_at: session.attribution.first_touch_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Progressive finalized answers — never creates a contactable lead. */
export async function PATCH(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`assessment-session-patch:${ip}`, 60, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = patchSchema.parse(await request.json());
    const svc = new AssessmentSessionService();
    const session = svc.get(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (body.action === "start") {
      svc.markStarted(body.sessionId);
    } else if (body.action === "answer") {
      if (!body.questionId || body.value == null) {
        return NextResponse.json(
          { error: "questionId and value required" },
          { status: 400 },
        );
      }
      svc.persistAnswer(
        body.sessionId,
        body.questionId,
        body.value,
        body.stage ?? null,
      );
    } else if (body.action === "contact_started") {
      svc.markContactStarted(body.sessionId);
    } else if (body.action === "abandon") {
      svc.markAbandoned(body.sessionId);
    }

    const updated = svc.get(body.sessionId)!;
    return NextResponse.json({
      ok: true,
      sessionId: updated.id,
      answers: updated.answers,
      completion_percentage: updated.completion_percentage,
      last_completed_question: updated.last_completed_question,
      last_completed_stage: updated.last_completed_stage,
      branch: updated.branch,
      contactable: false,
      status: updated.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
