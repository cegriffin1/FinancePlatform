import { randomBytes, randomUUID } from "crypto";
import {
  getSimStore,
  type AssessmentFunnelEvent,
  type AssessmentSession,
} from "@/application/growth/simulationStore";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";
import { RETIREMENT_OPPORTUNITY_V1 } from "@/application/retirement/assessmentDefinition";
import { recordAssessmentStart } from "@/application/growth/campaignService";

export type AssessmentAttributionInput = {
  provider?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  altus_campaign_id?: string | null;
  altus_click_id?: string | null;
  external_campaign_id?: string | null;
  external_ad_set_id?: string | null;
  external_ad_id?: string | null;
  external_creative_id?: string | null;
  referrer?: string | null;
  source_channel?: string | null;
  landing_page?: string | null;
};

function newResumeToken() {
  return randomBytes(32).toString("hex");
}

export type FunnelEventType =
  | "campaign_viewed"
  | "assessment_started"
  | "question_answered"
  | "stage_completed"
  | "branch_selected"
  | "contact_started"
  | "contact_submitted"
  | "assessment_completed"
  | "assessment_abandoned";

/**
 * AssessmentSession — attribution + progressive answers.
 * Incomplete sessions are NOT contactable leads.
 */
export class AssessmentSessionService {
  create(input: {
    campaign_id: string;
    organization_id: string;
    organization_slug: string;
    campaign_slug: string;
    assessment_definition_id?: string;
    assessment_version?: string;
    attribution: AssessmentAttributionInput;
  }): AssessmentSession {
    const store = getSimStore();
    const now = new Date().toISOString();
    const session: AssessmentSession = {
      id: randomUUID(),
      campaign_id: input.campaign_id,
      organization_id: input.organization_id,
      organization_slug: input.organization_slug,
      campaign_slug: input.campaign_slug,
      assessment_definition_id:
        input.assessment_definition_id ?? RETIREMENT_OPPORTUNITY_V1.key,
      assessment_version: input.assessment_version ?? RETIREMENT_OPPORTUNITY_V1.version,
      resume_token: newResumeToken(),
      attribution: {
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
      },
      answers: {},
      last_completed_question: null,
      last_completed_stage: null,
      completion_percentage: 0,
      branch: null,
      status: "active",
      lead_id: null,
      contactable: false,
      created_at: now,
      updated_at: now,
      abandoned_at: null,
      started_at: null,
      contact_captured_at: null,
    };
    store.assessment_sessions.unshift(session);
    this.track(session.id, "campaign_viewed", {});
    return session;
  }

  get(sessionId: string) {
    return getSimStore().assessment_sessions.find((s) => s.id === sessionId) ?? null;
  }

  /** Public access requires opaque resume token — prevents session enumeration. */
  getAuthorized(sessionId: string, resumeToken: string) {
    const session = this.get(sessionId);
    if (!session || session.resume_token !== resumeToken) return null;
    return session;
  }

  getByResumeToken(resumeToken: string) {
    return (
      getSimStore().assessment_sessions.find((s) => s.resume_token === resumeToken) ??
      null
    );
  }

  markStarted(sessionId: string) {
    const session = this.get(sessionId);
    if (!session) return null;
    if (!session.started_at) {
      session.started_at = new Date().toISOString();
      recordAssessmentStart(session.organization_slug, session.campaign_slug);
      this.track(sessionId, "assessment_started", {});
    }
    session.updated_at = new Date().toISOString();
    return session;
  }

  /**
   * Idempotent finalized-answer write. Does not create a lead.
   */
  persistAnswer(
    sessionId: string,
    questionId: string,
    value: string,
    stage?: string | null,
  ) {
    const session = this.get(sessionId);
    if (!session) return null;
    if (session.status === "completed") return session;

    const previous = session.answers[questionId];
    session.answers = { ...session.answers, [questionId]: value };
    session.last_completed_question = questionId;
    if (stage) session.last_completed_stage = stage;
    session.completion_percentage = new ProfileCompletenessService().calculate(
      session.answers,
    ).profile_completion_percentage;
    session.updated_at = new Date().toISOString();

    if (previous !== value) {
      this.track(sessionId, "question_answered", {
        question_id: questionId,
        stage: stage ?? null,
      });
    }

    if (questionId === "primary_objective") {
      session.branch =
        value === "BALANCE"
          ? "BOTH"
          : value === "INCOME"
            ? "INCOME"
            : value === "GROW" || value === "PROTECT"
              ? "ACCUMULATION"
              : value;
      this.track(sessionId, "branch_selected", { branch: session.branch });
    }

    if (stage) {
      this.track(sessionId, "stage_completed", {
        stage,
        completion_percentage: session.completion_percentage,
      });
    }

    return session;
  }

  markContactStarted(sessionId: string) {
    const session = this.get(sessionId);
    if (!session) return null;
    this.track(sessionId, "contact_started", {});
    session.updated_at = new Date().toISOString();
    return session;
  }

  markCompleted(sessionId: string, leadId: string) {
    const session = this.get(sessionId);
    if (!session) return null;
    session.status = "completed";
    session.lead_id = leadId;
    session.contactable = true;
    session.completion_percentage = 100;
    session.updated_at = new Date().toISOString();
    this.track(sessionId, "contact_submitted", { lead_id: leadId });
    this.track(sessionId, "assessment_completed", { lead_id: leadId });
    return session;
  }

  markAbandoned(sessionId: string) {
    const session = this.get(sessionId);
    if (!session || session.status === "completed") return session;
    session.status = "abandoned";
    session.abandoned_at = new Date().toISOString();
    session.updated_at = session.abandoned_at;
    this.track(sessionId, "assessment_abandoned", {
      last_completed_question: session.last_completed_question,
      last_completed_stage: session.last_completed_stage,
      completion_percentage: session.completion_percentage,
    });
    return session;
  }

  track(
    sessionId: string,
    type: FunnelEventType,
    payload: Record<string, unknown>,
  ) {
    const store = getSimStore();
    const session = this.get(sessionId);
    const event: AssessmentFunnelEvent = {
      id: randomUUID(),
      session_id: sessionId,
      campaign_id: session?.campaign_id ?? null,
      organization_id: session?.organization_id ?? null,
      type,
      payload,
      created_at: new Date().toISOString(),
    };
    store.assessment_funnel_events.unshift(event);
    return event;
  }

  funnelCounts(campaignId?: string) {
    const events = getSimStore().assessment_funnel_events.filter(
      (e) => !campaignId || e.campaign_id === campaignId,
    );
    const count = (type: FunnelEventType) =>
      events.filter((e) => e.type === type).length;
    return {
      campaign_clicks: count("campaign_viewed"),
      assessment_starts: count("assessment_started"),
      about_you_completed: events.filter(
        (e) => e.type === "stage_completed" && e.payload.stage === "ABOUT_YOU",
      ).length,
      your_money_completed: events.filter(
        (e) => e.type === "stage_completed" && e.payload.stage === "YOUR_MONEY",
      ).length,
      goal_completed: events.filter(
        (e) =>
          e.type === "stage_completed" &&
          (e.payload.stage === "YOUR_GOAL" || e.payload.stage === "DYNAMIC_BRANCH"),
      ).length,
      priorities_completed: events.filter(
        (e) => e.type === "stage_completed" && e.payload.stage === "YOUR_PRIORITIES",
      ).length,
      contact_captured: count("contact_submitted"),
      assessment_completed: count("assessment_completed"),
      assessment_abandoned: count("assessment_abandoned"),
    };
  }
}
