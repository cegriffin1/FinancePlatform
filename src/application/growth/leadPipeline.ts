import { randomUUID } from "crypto";
import {
  BUSINESS_GROWTH_ASSESSMENT_V1,
  PRIORITY_TO_STRATEGY,
} from "@/application/growth/assessmentTemplate";
import { applyScoringRules } from "@/application/growth/scoringRules";
import {
  findOrgBySlug,
  getSimStore,
  type SimCampaign,
  type SimLead,
} from "@/application/growth/simulationStore";
import type { LeadEvent } from "@/domain/types";
import type { LeadAttribution } from "@/domain/types/campaign-engine";

export type PublicLeadSubmission = {
  organizationSlug: string;
  campaignSlug: string;
  answers: Record<string, string>;
  contact: {
    firstName: string;
    lastName: string;
    businessName: string;
    email: string;
    phone: string;
    state: string;
    preferredContact: string;
    consent: boolean;
  };
  appointmentRequested: boolean;
  attribution: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    referrer?: string | null;
    source_channel?: string | null;
    landing_page?: string | null;
    ad_provider?: string | null;
    external_campaign_id?: string | null;
    external_ad_group_id?: string | null;
    external_creative_id?: string | null;
  };
  submissionKey?: string;
};

function appendEvent(
  leadId: string,
  campaignId: string,
  organizationId: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  const store = getSimStore();
  const event: LeadEvent = {
    id: randomUUID(),
    organization_id: organizationId ?? store.organizations[0]!.id,
    lead_id: leadId,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    actor_profile_id: null,
    payload: { campaign_id: campaignId, ...metadata },
    created_at: new Date().toISOString(),
  };
  store.events.push(event);
  return event;
}

function classifyStrategies(answers: Record<string, string>) {
  const priority = answers.financial_priority ?? "";
  const mapped = PRIORITY_TO_STRATEGY[priority] ?? ["Business Growth"];
  const now = new Date().toISOString();
  return mapped.map((strategy) => ({
    id: randomUUID(),
    organization_id: "",
    lead_id: "",
    strategy_category: strategy,
    strategy_confidence: strategy === mapped[0] ? 0.9 : 0.65,
    classification_reason: `Mapped from priority: ${priority || "unspecified"}`,
    classification_version: "strategy-map-v1",
    created_at: now,
  }));
}

function distributePlatformLead(lead: SimLead, campaign: SimCampaign) {
  const store = getSimStore();
  const strategies = lead.classifications.map((c) => c.strategy_category);
  const rejections: Array<{ organization_id: string; reason: string }> = [];

  let candidates = store.organizations.filter(
    (o) => o.slug !== "altus" && o.status === "active",
  );

  candidates = candidates.filter((c) => {
    if (!c.territories.includes(lead.state) && !c.territories.includes("US")) {
      rejections.push({
        organization_id: c.id,
        reason: `Territory mismatch: ${lead.state}`,
      });
      return false;
    }
    if (!strategies.some((s) => c.strategies.includes(s))) {
      rejections.push({
        organization_id: c.id,
        reason: "Strategy eligibility mismatch",
      });
      return false;
    }
    if (!c.licenses.includes("life")) {
      rejections.push({
        organization_id: c.id,
        reason: "License eligibility mismatch",
      });
      return false;
    }
    if (c.capacityRemaining <= 0) {
      rejections.push({
        organization_id: c.id,
        reason: "No remaining capacity",
      });
      return false;
    }
    return true;
  });

  const isPriority =
    lead.temperature_key === "PRIORITY" || lead.temperature_key === "HOT";
  if (isPriority) {
    const premier = candidates.filter(
      (c) => c.tier === "PREMIER" || c.tier === "ENTERPRISE",
    );
    if (premier.length > 0) candidates = premier;
  }

  candidates.sort((a, b) => {
    const rank = { STANDARD: 1, PRO: 2, PREMIER: 3, ENTERPRISE: 3 } as const;
    return rank[b.tier] - rank[a.tier];
  });

  const topTier = candidates[0]?.tier;
  const peer = candidates.filter((c) => c.tier === topTier);
  const key = `tier:${topTier ?? "none"}:${lead.state}`;
  const cursor = store.roundRobinCursor[key] ?? 0;
  const selected = peer.length > 0 ? peer[cursor % peer.length]! : null;
  if (peer.length > 0) store.roundRobinCursor[key] = cursor + 1;

  appendEvent(lead.id, campaign.id, null, "distribution_started", {
    candidates: candidates.map((c) => c.id),
  });

  if (!selected) {
    lead.distribution_status = "unassigned_pool";
    lead.status = "unassigned_pool";
    lead.distribution = {
      id: randomUUID(),
      lead_id: lead.id,
      candidates_considered: store.organizations.map((o) => o.id),
      candidate_rejections: rejections,
      selected_organization_id: null,
      selected_agent_id: null,
      distribution_method: "priority_tier",
      rule_version: "dist-vertical-v1",
      decided_at: new Date().toISOString(),
    };
    return lead;
  }

  selected.capacityRemaining -= 1;
  lead.assigned_organization_id = selected.id;
  lead.organization_id = selected.id;
  lead.assigned_agent_label = `${selected.name} Advisor`;
  lead.distribution_status = "assigned";
  lead.status = "qualified";
  lead.classifications = lead.classifications.map((c) => ({
    ...c,
    organization_id: selected.id,
    lead_id: lead.id,
  }));
  lead.distribution = {
    id: randomUUID(),
    lead_id: lead.id,
    candidates_considered: candidates.map((c) => c.id),
    candidate_rejections: rejections,
    selected_organization_id: selected.id,
    selected_agent_id: null,
    distribution_method: "priority_tier",
    rule_version: "dist-vertical-v1",
    decided_at: new Date().toISOString(),
  };

  appendEvent(lead.id, campaign.id, selected.id, "lead_assigned", {
    organization_id: selected.id,
    organization_name: selected.name,
  });

  store.notifications.unshift({
    id: randomUUID(),
    organization_id: selected.id,
    lead_id: lead.id,
    title:
      lead.temperature_key === "PRIORITY" || lead.temperature_key === "HOT"
        ? "New Priority Lead"
        : "New Lead Assigned",
    body: `${lead.business_name} · ${lead.classifications[0]?.strategy_category ?? "Strategy"} · Score ${lead.score} · ${lead.state}`,
    created_at: new Date().toISOString(),
    read: false,
  });

  return lead;
}

export function processPublicLeadSubmission(input: PublicLeadSubmission) {
  const store = getSimStore();
  const campaign = store.campaigns.find(
    (c) =>
      c.organization_slug === input.organizationSlug &&
      c.slug === input.campaignSlug,
  );
  if (!campaign) throw new Error("Campaign not found");
  const status = String(campaign.status);
  if (!["active", "active_simulation", "published"].includes(status)) {
    throw new Error("Campaign is not accepting leads");
  }

  if (!input.contact.consent) throw new Error("Consent is required");
  if (!input.contact.email.includes("@")) throw new Error("Valid email required");

  // simple duplicate guard by email+campaign
  const duplicate = store.leads.find(
    (l) =>
      l.campaign_id === campaign.id &&
      l.email.toLowerCase() === input.contact.email.toLowerCase(),
  );
  if (duplicate) {
    return { lead: duplicate, duplicate: true as const };
  }

  const now = new Date().toISOString();
  const leadId = randomUUID();
  const org =
    campaign.owner_type === "SUBSCRIBER_CAMPAIGN"
      ? findOrgBySlug(campaign.organization_slug)
      : null;

  appendEvent(leadId, campaign.id, org?.id ?? null, "assessment_started");
  for (const [key, value] of Object.entries(input.answers)) {
    appendEvent(leadId, campaign.id, org?.id ?? null, "assessment_question_completed", {
      question: key,
      answer: value,
    });
  }
  appendEvent(leadId, campaign.id, org?.id ?? null, "assessment_completed");
  appendEvent(leadId, campaign.id, org?.id ?? null, "contact_submitted");
  if (input.appointmentRequested) {
    appendEvent(leadId, campaign.id, org?.id ?? null, "appointment_cta_viewed");
    appendEvent(leadId, campaign.id, org?.id ?? null, "appointment_requested");
  }

  const scored = applyScoringRules(input.answers, {
    assessmentCompleted: true,
    contactSubmitted: true,
    appointmentRequested: input.appointmentRequested,
  });

  appendEvent(leadId, campaign.id, org?.id ?? null, "lead_scored", {
    score: scored.total,
    temperature: scored.temperature,
  });

  const classifications = classifyStrategies(input.answers).map((c) => ({
    ...c,
    lead_id: leadId,
    organization_id: org?.id ?? store.organizations[0]!.id,
  }));
  appendEvent(leadId, campaign.id, org?.id ?? null, "strategy_classified", {
    strategies: classifications.map((c) => c.strategy_category),
  });

  const attribution: LeadAttribution = {
    lead_id: leadId,
    organization_id: org?.id ?? null,
    campaign_id: campaign.id,
    platform_campaign_id:
      campaign.owner_type === "ALTUS_PLATFORM_CAMPAIGN" ? campaign.id : null,
    owner_type: campaign.owner_type,
    ad_provider: (input.attribution.ad_provider as LeadAttribution["ad_provider"]) ?? null,
    external_campaign_id: input.attribution.external_campaign_id ?? null,
    ad_set_id: input.attribution.external_ad_group_id ?? null,
    creative_id: input.attribution.external_creative_id ?? null,
    source: input.attribution.source_channel ?? "campaign",
    medium: input.attribution.utm_medium ?? "simulation",
    utm_source: input.attribution.utm_source ?? null,
    utm_medium: input.attribution.utm_medium ?? null,
    utm_campaign: input.attribution.utm_campaign ?? null,
    utm_content: input.attribution.utm_content ?? null,
    landing_page:
      input.attribution.landing_page ??
      `/c/${campaign.organization_slug}/${campaign.slug}`,
    territory: input.contact.state,
    captured_at: now,
  };

  // freeze attribution object
  Object.freeze(attribution);

  let lead: SimLead = {
    id: leadId,
    organization_id: org?.id ?? null,
    assigned_organization_id: org?.id ?? null,
    assigned_agent_label: org ? `${org.name} Advisor` : null,
    campaign_id: campaign.id,
    platform_campaign_id:
      campaign.owner_type === "ALTUS_PLATFORM_CAMPAIGN" ? campaign.id : null,
    owner_type: campaign.owner_type,
    status: "new",
    temperature_key: scored.temperature,
    score: scored.total,
    fit_score: scored.fit,
    intent_score: scored.intent,
    engagement_score: scored.engagement,
    score_version: scored.scoringVersion,
    scored_at: now,
    score_breakdown: {
      total: scored.total,
      fit: scored.fit,
      intent: scored.intent,
      engagement: scored.engagement,
      classification: scored.temperature,
      scoring_version: scored.scoringVersion,
      factors: scored.factors,
      explanation: scored.explanation,
    },
    first_name: input.contact.firstName,
    last_name: input.contact.lastName,
    business_name: input.contact.businessName,
    email: input.contact.email,
    phone: input.contact.phone,
    state: input.contact.state,
    preferred_contact: input.contact.preferredContact,
    consent: input.contact.consent,
    assessment_answers: input.answers,
    assessment_template_version: BUSINESS_GROWTH_ASSESSMENT_V1.version,
    attribution,
    classifications,
    distribution: null,
    distribution_status:
      campaign.owner_type === "SUBSCRIBER_CAMPAIGN"
        ? "subscriber_owned"
        : "pending",
    created_at: now,
    updated_at: now,
  };

  campaign.analytics.assessment_completions += 1;
  campaign.analytics.leads += 1;
  if (scored.total >= 60) campaign.analytics.qualified_leads += 1;
  if (scored.temperature === "HOT") campaign.analytics.hot_leads += 1;
  if (scored.temperature === "PRIORITY") campaign.analytics.priority_leads += 1;
  if (input.appointmentRequested) campaign.analytics.appointments += 1;

  if (campaign.owner_type === "SUBSCRIBER_CAMPAIGN" && org) {
    lead.status = "qualified";
    lead.distribution_status = "subscriber_owned";
    appendEvent(leadId, campaign.id, org.id, "lead_assigned", {
      organization_id: org.id,
      mode: "subscriber_owned",
    });
    store.notifications.unshift({
      id: randomUUID(),
      organization_id: org.id,
      lead_id: lead.id,
      title: "New Campaign Lead",
      body: `${lead.business_name} · ${lead.classifications[0]?.strategy_category ?? "Strategy"} · Score ${lead.score}`,
      created_at: now,
      read: false,
    });
  } else {
    lead = distributePlatformLead(lead, campaign);
  }

  store.leads.unshift(lead);
  return { lead, duplicate: false as const };
}

export function generateTestLead(campaignId: string) {
  const store = getSimStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const sampleAnswers = {
    business_stage: "Growing steadily",
    financial_priority: "Reduce tax exposure",
    team_size: "26–50",
    revenue_range: "$5M–$10M",
    timeline: "Within 30 days",
  };

  return processPublicLeadSubmission({
    organizationSlug: campaign.organization_slug,
    campaignSlug: campaign.slug,
    answers: sampleAnswers,
    contact: {
      firstName: "Alex",
      lastName: "Rivera",
      businessName: "Acme Manufacturing",
      email: `alex.rivera+${Date.now()}@example.com`,
      phone: "(305) 555-0142",
      state: campaign.territories[0] ?? "FL",
      preferredContact: "Email",
      consent: true,
    },
    appointmentRequested: true,
    attribution: {
      utm_source: "simulation",
      utm_medium: "test",
      utm_campaign: campaign.slug,
      source_channel: campaign.channels[0] ?? "meta",
      landing_page: `/c/${campaign.organization_slug}/${campaign.slug}`,
    },
  });
}
