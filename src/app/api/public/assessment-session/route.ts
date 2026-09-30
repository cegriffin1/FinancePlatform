import { NextResponse } from "next/server";
import { z } from "zod";
import { DurableProspectService } from "@/application/growth/DurableProspectService";
import { rateLimit } from "@/lib/rateLimit";
import { RETIREMENT_OPPORTUNITY_V1 } from "@/application/retirement/assessmentDefinition";
import { DataModeError } from "@/lib/dataMode";
import { logAltusError, publicError } from "@/lib/observability";

const attributionSchema = z.object({
  provider: z.string().nullable().optional(),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content: z.string().nullable().optional(),
  utm_term: z.string().nullable().optional(),
  altus_campaign_id: z.string().nullable().optional(),
  altus_click_id: z.string().nullable().optional(),
  external_campaign_id: z.string().nullable().optional(),
  external_ad_set_id: z.string().nullable().optional(),
  external_ad_id: z.string().nullable().optional(),
  external_creative_id: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  source_channel: z.string().nullable().optional(),
  landing_page: z.string().nullable().optional(),
});

const createSchema = z.object({
  organizationSlug: z.string().min(1),
  campaignSlug: z.string().min(1),
  attribution: attributionSchema.default({}),
});

const patchSchema = z.object({
  sessionId: z.string().uuid(),
  resumeToken: z.string().min(16),
  action: z.enum(["start", "answer", "contact_started", "abandon"]),
  questionId: z.string().optional(),
  value: z.string().optional(),
  stage: z.string().nullable().optional(),
});

const resumeSchema = z.object({
  resumeToken: z.string().min(16),
});

/** Create AssessmentSession — attribution captured immediately. */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`assessment-session:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = createSchema.parse(await request.json());
    const durable = new DurableProspectService();
    const campaign = await durable.resolveCampaign(
      body.organizationSlug,
      body.campaignSlug,
    );
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const orgId =
      ("organization_id" in campaign && campaign.organization_id) ||
      ("owner_id" in campaign && (campaign as { owner_id?: string }).owner_id);
    if (!orgId || typeof orgId !== "string") {
      return NextResponse.json(
        { error: "Campaign missing organization" },
        { status: 400 },
      );
    }

    // Session FK always binds to the resolved landing campaign (e.g. Direct Retirement).
    // Client-supplied altus_campaign_id (paid parent) is preserved in attribution when present.
    const session = await durable.createSession({
      campaign_id: campaign.id as string,
      organization_id: orgId,
      organization_slug: body.organizationSlug,
      campaign_slug: body.campaignSlug,
      assessment_definition_id:
        (campaign as { qualification_template_key?: string })
          .qualification_template_key ??
        (campaign as { assessment_template_key?: string })
          .assessment_template_key ??
        RETIREMENT_OPPORTUNITY_V1.key,
      assessment_version: RETIREMENT_OPPORTUNITY_V1.version,
      attribution: {
        ...body.attribution,
        // Preserve paid altus_campaign_id when supplied; else bind to landing campaign.
        altus_campaign_id:
          body.attribution.altus_campaign_id ?? (campaign.id as string),
      },
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      resumeToken: session.resume_token,
      assessment_definition_id: session.assessment_definition_id,
      assessment_version: session.assessment_version,
      contactable: false,
      first_touch_at: session.attribution.first_touch_at,
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      logAltusError("ASSESSMENT_SESSION_ERROR", error.message);
      const pub = publicError(
        "ASSESSMENT_SESSION_ERROR",
        "Unable to start assessment. Please try again.",
        503,
      );
      return NextResponse.json(
        { error: pub.error, code: pub.code },
        { status: pub.status },
      );
    }
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Progressive finalized answers — requires resume token. Never creates a lead. */
export async function PATCH(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`assessment-session-patch:${ip}`, 60, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = patchSchema.parse(await request.json());
    const durable = new DurableProspectService();
    const session = await durable.getAuthorized(body.sessionId, body.resumeToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (body.action === "start") {
      await durable.markStarted(session);
    } else if (body.action === "answer") {
      if (!body.questionId || body.value == null) {
        return NextResponse.json(
          { error: "questionId and value required" },
          { status: 400 },
        );
      }
      await durable.persistAnswer(
        session,
        body.questionId,
        body.value,
        body.stage ?? null,
      );
    } else if (body.action === "contact_started") {
      await durable.markContactStarted(session);
    } else if (body.action === "abandon") {
      await durable.markAbandoned(session);
    }

    const updated = await durable.getAuthorized(body.sessionId, body.resumeToken);
    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

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
      // Never return scores/temperature/lead internals on public session API
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      logAltusError("ASSESSMENT_RESPONSE_ERROR", error.message);
      const pub = publicError(
        "ASSESSMENT_RESPONSE_ERROR",
        "Unable to save your answer. Please try again.",
        503,
      );
      return NextResponse.json(
        { error: pub.error, code: pub.code },
        { status: pub.status },
      );
    }
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Secure resume by opaque token only — no session enumeration. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = resumeSchema.safeParse({
      resumeToken: url.searchParams.get("resumeToken"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "resumeToken required" }, { status: 400 });
    }
    const durable = new DurableProspectService();
    const session = await durable.getByResumeToken(parsed.data.resumeToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      resumeToken: session.resume_token,
      answers: session.answers,
      completion_percentage: session.completion_percentage,
      last_completed_question: session.last_completed_question,
      last_completed_stage: session.last_completed_stage,
      branch: session.branch,
      status: session.status,
      contactable: false,
      leadCreated: Boolean(session.lead_id),
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      const pub = publicError(
        "ASSESSMENT_SESSION_ERROR",
        "Unable to resume assessment.",
        503,
      );
      return NextResponse.json(
        { error: pub.error, code: pub.code },
        { status: pub.status },
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
