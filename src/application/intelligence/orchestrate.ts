import { randomUUID } from "crypto";
import {
  LeadQualityGateService,
  StubContactValidationProvider,
} from "@/application/intelligence/qualityGate";
import { LeadIdentityResolutionService } from "@/application/intelligence/identityResolution";
import { buildIntelligenceProfile } from "@/application/intelligence/scoring";
import { LeadSlaService, NurtureEligibilityService, actionLabel } from "@/application/intelligence/lifecycle";
import { LeadInsightProvider } from "@/application/intelligence/insights";
import { IntentSurgeService } from "@/application/intelligence/intentSurge";
import type { SimLead } from "@/application/growth/simulationStore";
import type { SimCampaign } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import type { LeadScoreSnapshotRecord } from "@/domain/types/lead-intelligence";

export type IntelligenceExtras = {
  honeypot?: string | null;
  submissionStartedAt?: string | null;
};

export async function applyLeadIntelligence(input: {
  lead: SimLead;
  campaign: SimCampaign;
  appointmentRequested: boolean;
  extras?: IntelligenceExtras;
}): Promise<SimLead> {
  const { lead, campaign } = input;
  const store = getSimStore();
  const validation = new StubContactValidationProvider();
  const gate = new LeadQualityGateService(validation);
  const identity = new LeadIdentityResolutionService();
  const sla = new LeadSlaService();
  const nurture = new NurtureEligibilityService();
  const insights = new LeadInsightProvider();
  const surge = new IntentSurgeService();

  const recentSubmissionCount = store.leads.filter(
    (l) =>
      l.email.toLowerCase() === lead.email.toLowerCase() &&
      Date.now() - new Date(l.created_at).getTime() < 3600_000,
  ).length;

  const quality = await gate.evaluate({
    email: lead.email,
    phone: lead.phone,
    firstName: lead.first_name,
    lastName: lead.last_name,
    businessName: lead.business_name,
    state: lead.state,
    consent: lead.consent,
    answers: lead.assessment_answers,
    submissionStartedAt: input.extras?.submissionStartedAt,
    honeypot: input.extras?.honeypot,
    recentSubmissionCount,
  });

  const identityResult = identity.resolve(
    {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      firstName: lead.first_name,
      lastName: lead.last_name,
      businessName: lead.business_name,
      campaignId: lead.campaign_id,
      organizationId: lead.organization_id,
    },
    store.leads
      .filter((l) => l.id !== lead.id)
      .map((l) => ({
        id: l.id,
        email: l.email,
        phone: l.phone,
        firstName: l.first_name,
        lastName: l.last_name,
        businessName: l.business_name,
        campaignId: l.campaign_id,
        organizationId: l.organization_id,
      })),
  );

  const emailStatus = (await validation.validateEmail(lead.email)).status;
  const phoneStatus = (await validation.validatePhone(lead.phone)).status;

  const profile = buildIntelligenceProfile({
    answers: lead.assessment_answers,
    campaignStrategy: campaign.strategy,
    campaignTerritories: campaign.territories,
    state: lead.state,
    consent: lead.consent,
    appointmentRequested: input.appointmentRequested,
    assessmentCompleted: true,
    contactSubmitted: true,
    emailStatus,
    phoneStatus,
    fraudRisk: quality.fraud_risk,
    qualityGate:
      identityResult.result === "DUPLICATE_SUBMISSION"
        ? "DUPLICATE"
        : quality.outcome,
    identityResult: identityResult.result,
    createdAt: lead.created_at,
  });
  profile.fraud_reasons = quality.fraud_reasons;

  const snapshot: LeadScoreSnapshotRecord = {
    id: randomUUID(),
    lead_id: lead.id,
    organization_id: lead.organization_id,
    profile: { ...profile },
    created_at: new Date().toISOString(),
  };

  lead.intelligence = profile;
  lead.score_snapshots = [...(lead.score_snapshots ?? []), snapshot];
  lead.score = profile.overall_priority_score;
  lead.fit_score = profile.fit_score;
  lead.intent_score = profile.intent_score;
  lead.engagement_score = profile.engagement_score;
  lead.temperature_key = profile.lead_temperature;
  lead.score_version = profile.score_version;
  lead.scored_at = profile.scored_at;
  lead.score_breakdown = {
    total: profile.overall_priority_score,
    fit: profile.fit_score,
    intent: profile.intent_score,
    engagement: profile.engagement_score,
    classification: profile.lead_temperature,
    scoring_version: profile.score_version,
    factors: profile.factors.map((f) => ({
      key: f.key,
      category:
        f.dimension === "intent"
          ? "intent"
          : f.dimension === "engagement"
            ? "engagement"
            : "fit",
      points: f.points,
      reason: f.reason,
    })),
    explanation: profile.explanation,
  };
  lead.pipeline_stage = "New";
  lead.stage_history = [{ stage: "New", at: lead.created_at }];
  lead.reservation_status = "AVAILABLE";

  if (identityResult.result === "DUPLICATE_SUBMISSION" && identityResult.matched_lead_id) {
    lead.parent_lead_id = identityResult.matched_lead_id;
    lead.status = "review";
    lead.distribution_status = "held";
    return lead;
  }

  if (profile.quality_gate === "SUSPECTED_FRAUD" || profile.quality_gate === "REJECT") {
    lead.status = "rejected";
    lead.distribution_status = "held";
    return lead;
  }

  if (
    profile.quality_gate === "REVIEW" ||
    nurture.shouldNurture({
      temperature: profile.lead_temperature,
      recommendedAction: profile.recommended_action,
      qualityGate: profile.quality_gate,
      timeline: lead.assessment_answers.timeline,
    })
  ) {
    if (profile.recommended_action === "NURTURE" || profile.lead_temperature === "COLD") {
      lead.status = "nurture";
      lead.distribution_status = "nurture";
      lead.pipeline_stage = "Nurture";
    } else {
      lead.status = "review";
      lead.distribution_status = "held";
    }
  }

  lead.sla = sla.buildTimers({
    createdAt: lead.created_at,
    distributedAt: lead.distribution?.decided_at,
    assignedAt: lead.assigned_organization_id ? lead.updated_at : null,
    temperature: lead.temperature_key,
  });

  const events = store.events
    .filter((e) => e.lead_id === lead.id)
    .map((e) => ({ type: e.event_type, occurred_at: e.occurred_at }));
  const surgeResult = surge.detect(events);
  if (surgeResult.surged) {
    store.events.push({
      id: randomUUID(),
      organization_id: lead.organization_id ?? store.organizations[0]!.id,
      lead_id: lead.id,
      event_type: "intent_surge_detected",
      occurred_at: new Date().toISOString(),
      actor_profile_id: null,
      payload: { reasons: surgeResult.reasons },
      created_at: new Date().toISOString(),
    });
  }

  // Enhance notification copy for premium grades
  if (
    lead.assigned_organization_id &&
    (profile.quality_grade === "A+" || profile.quality_grade === "A")
  ) {
    store.notifications.unshift({
      id: randomUUID(),
      organization_id: lead.assigned_organization_id,
      lead_id: lead.id,
      title: `NEW ${profile.quality_grade} LEAD`,
      body: `${lead.first_name} ${lead.last_name} · ${lead.business_name} · Priority ${profile.overall_priority_score} · ${actionLabel(profile.recommended_action)}`,
      created_at: new Date().toISOString(),
      read: false,
    });
  }

  // Attach brief in event payload for agents
  store.events.push({
    id: randomUUID(),
    organization_id: lead.organization_id ?? store.organizations[0]!.id,
    lead_id: lead.id,
    event_type: "lead_intelligence_ready",
    occurred_at: new Date().toISOString(),
    actor_profile_id: null,
    payload: {
      grade: profile.quality_grade,
      priority: profile.overall_priority_score,
      brief: insights.preCallBrief({
        firstName: lead.first_name,
        lastName: lead.last_name,
        businessName: lead.business_name,
        strategies: profile.strategy_classification,
        timeline: lead.assessment_answers.timeline,
        source: lead.attribution.ad_provider ?? lead.attribution.source,
        recommendedAction: actionLabel(profile.recommended_action),
        highlights: Object.entries(lead.assessment_answers).map(
          ([k, v]) => `${k}: ${v}`,
        ),
      }),
      summary: insights.summarize({
        firstName: lead.first_name,
        businessName: lead.business_name,
        state: lead.state,
        strategies: profile.strategy_classification,
        timeline: lead.assessment_answers.timeline,
        appointmentRequested: input.appointmentRequested,
      }),
    },
    created_at: new Date().toISOString(),
  });

  return lead;
}
