import { randomBytes, randomUUID } from "crypto";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import type {
  AssessmentAttributionInput,
} from "@/application/growth/AssessmentSessionService";
import type { AssessmentSession } from "@/application/growth/simulationStore";
import { DataModeError } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

function newResumeToken() {
  return randomBytes(32).toString("hex");
}

type SessionRow = {
  id: string;
  organization_id: string | null;
  campaign_id: string | null;
  organization_slug: string | null;
  campaign_slug: string | null;
  assessment_definition_id: string;
  assessment_version: string;
  status: "active" | "completed" | "abandoned";
  last_completed_question: string | null;
  last_completed_stage: string | null;
  completion_percentage: number;
  branch: string | null;
  contactable: boolean;
  resume_token: string;
  attribution: AssessmentSession["attribution"];
  answers: Record<string, string>;
  lead_id: string | null;
  started_at: string | null;
  contact_captured_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToSession(row: SessionRow): AssessmentSession {
  return {
    id: row.id,
    campaign_id: row.campaign_id ?? "",
    organization_id: row.organization_id ?? "",
    organization_slug: row.organization_slug ?? "",
    campaign_slug: row.campaign_slug ?? "",
    assessment_definition_id: row.assessment_definition_id,
    assessment_version: row.assessment_version,
    resume_token: row.resume_token,
    attribution: row.attribution,
    answers: row.answers ?? {},
    last_completed_question: row.last_completed_question,
    last_completed_stage: row.last_completed_stage,
    completion_percentage: row.completion_percentage ?? 0,
    branch: row.branch,
    status: row.status,
    contactable: row.contactable,
    lead_id: row.lead_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    started_at: row.started_at,
    abandoned_at: row.abandoned_at,
    contact_captured_at: row.contact_captured_at,
  };
}

export class SupabaseAssessmentSessionRepository {
  private client() {
    try {
      return createSupabaseServiceClient();
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Service role client unavailable", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      throw new DataModeError(
        "Supabase is not configured for durable assessment persistence.",
      );
    }
  }

  async create(input: {
    campaign_id: string;
    organization_id: string;
    organization_slug: string;
    campaign_slug: string;
    assessment_definition_id: string;
    assessment_version: string;
    attribution: AssessmentAttributionInput & {
      altus_campaign_id?: string | null;
      altus_click_id?: string | null;
    };
  }): Promise<AssessmentSession> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const resume_token = newResumeToken();
    const attribution = {
      provider: input.attribution.provider ?? null,
      utm_source: input.attribution.utm_source ?? null,
      utm_medium: input.attribution.utm_medium ?? null,
      utm_campaign: input.attribution.utm_campaign ?? null,
      utm_content: input.attribution.utm_content ?? null,
      utm_term: input.attribution.utm_term ?? null,
      altus_campaign_id:
        input.attribution.altus_campaign_id ?? input.campaign_id,
      altus_click_id: input.attribution.altus_click_id ?? null,
      external_campaign_id: input.attribution.external_campaign_id ?? null,
      external_ad_set_id: input.attribution.external_ad_set_id ?? null,
      external_ad_id: input.attribution.external_ad_id ?? null,
      external_creative_id: input.attribution.external_creative_id ?? null,
      referrer: input.attribution.referrer ?? null,
      source_channel: input.attribution.source_channel ?? null,
      landing_page: input.attribution.landing_page ?? null,
      first_touch_at: now,
    };

    const supabase = this.client();
    const { data, error } = await supabase
      .from("assessment_sessions")
      .insert({
        id,
        organization_id: input.organization_id,
        campaign_id: input.campaign_id,
        organization_slug: input.organization_slug,
        campaign_slug: input.campaign_slug,
        assessment_definition_id: input.assessment_definition_id,
        assessment_version: input.assessment_version,
        status: "active",
        resume_token,
        attribution,
        answers: {},
        contactable: false,
        last_activity_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) {
      logAltusError("ASSESSMENT_SESSION_ERROR", "Failed to create session", {
        message: error?.message,
      });
      throw new DataModeError("Unable to start assessment session.");
    }

    await supabase.from("assessment_funnel_events").insert({
      session_id: id,
      organization_id: input.organization_id,
      campaign_id: input.campaign_id,
      event_type: "campaign_viewed",
      payload: {},
    });

    return rowToSession(data as SessionRow);
  }

  async getByIdAndToken(
    sessionId: string,
    resumeToken: string,
  ): Promise<AssessmentSession | null> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("assessment_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("resume_token", resumeToken)
      .maybeSingle();
    if (error) {
      logAltusError("ASSESSMENT_SESSION_ERROR", "Session lookup failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to load assessment session.");
    }
    return data ? rowToSession(data as SessionRow) : null;
  }

  async getByResumeToken(
    resumeToken: string,
  ): Promise<AssessmentSession | null> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("assessment_sessions")
      .select("*")
      .eq("resume_token", resumeToken)
      .maybeSingle();
    if (error) {
      logAltusError("ASSESSMENT_SESSION_ERROR", "Resume lookup failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to resume assessment session.");
    }
    return data ? rowToSession(data as SessionRow) : null;
  }

  async update(session: AssessmentSession): Promise<AssessmentSession> {
    const supabase = this.client();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("assessment_sessions")
      .update({
        answers: session.answers,
        last_completed_question: session.last_completed_question,
        last_completed_stage: session.last_completed_stage,
        completion_percentage: session.completion_percentage,
        branch: session.branch,
        status: session.status,
        contactable: session.contactable,
        lead_id: session.lead_id,
        started_at: session.started_at,
        abandoned_at: session.abandoned_at,
        contact_captured_at: session.contact_captured_at ?? null,
        completed_at:
          session.status === "completed" ? now : null,
        last_activity_at: now,
        updated_at: now,
        attribution: session.attribution,
      })
      .eq("id", session.id)
      .eq("resume_token", session.resume_token)
      .select("*")
      .single();

    if (error || !data) {
      logAltusError("ASSESSMENT_RESPONSE_ERROR", "Session update failed", {
        message: error?.message,
      });
      throw new DataModeError("Unable to save assessment progress.");
    }
    return rowToSession(data as SessionRow);
  }

  async upsertAnswer(
    session: AssessmentSession,
    questionKey: string,
    value: string,
    stage?: string | null,
  ) {
    const supabase = this.client();
    const now = new Date().toISOString();
    const { error } = await supabase.from("assessment_session_answers").upsert(
      {
        session_id: session.id,
        organization_id: session.organization_id || null,
        question_key: questionKey,
        value,
        stage: stage ?? null,
        updated_at: now,
      },
      { onConflict: "session_id,question_key" },
    );
    if (error) {
      logAltusError("ASSESSMENT_RESPONSE_ERROR", "Answer upsert failed", {
        message: error.message,
        questionKey,
      });
      throw new DataModeError("Unable to save assessment answer.");
    }
  }

  async track(
    session: AssessmentSession,
    type: string,
    payload: Record<string, unknown>,
  ) {
    const supabase = this.client();
    await supabase.from("assessment_funnel_events").insert({
      session_id: session.id,
      organization_id: session.organization_id || null,
      campaign_id: session.campaign_id || null,
      event_type: type,
      payload,
    });
  }

  async findCampaignBySlug(organizationSlug: string, campaignSlug: string) {
    const supabase = this.client();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, slug, name")
      .eq("slug", organizationSlug)
      .maybeSingle();
    if (!org) return null;

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", org.id)
      .eq("slug", campaignSlug)
      .maybeSingle();
    if (error) {
      logAltusError("ATTRIBUTION_ERROR", "Campaign lookup failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to resolve campaign.");
    }
    if (!campaign) return null;
    return {
      ...campaign,
      organization_slug: org.slug as string,
      organization_name: org.name as string,
    };
  }
}
