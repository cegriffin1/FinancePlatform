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
import { applyLeadIntelligence } from "@/application/intelligence/orchestrate";
import { LeadIdentityResolutionService } from "@/application/intelligence/identityResolution";
import { LeadOwnershipService } from "@/application/crm/RetirementCrmService";
import { LeadInventoryService } from "@/application/inventory/LeadInventoryService";
import {
  LeadTemperatureTransitionService,
  LeadEngagementService,
} from "@/application/lifecycle/LeadLifecycleService";
import {
  SpeedToLeadService,
  issueHotLeadAlert,
} from "@/application/crm/SpeedToLeadService";
import {
  PUBLIC_CONSENT_TEXT,
  PUBLIC_CONSENT_VERSION,
} from "@/domain/compliance/consent";
import { defaultCompliance } from "@/domain/types/lead-inventory";
import { AltusCRMProvider } from "@/infrastructure/providers/AltusCRMProvider";
import { AssessmentSessionService } from "@/application/growth/AssessmentSessionService";
import { DurableProspectService } from "@/application/growth/DurableProspectService";
import { RetirementAssessmentEngine } from "@/application/retirement/RetirementAssessmentEngine";
import { RETIREMENT_OPPORTUNITY_V1 } from "@/application/retirement/assessmentDefinition";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

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
    utm_term?: string | null;
    referrer?: string | null;
    source_channel?: string | null;
    landing_page?: string | null;
    ad_provider?: string | null;
    external_campaign_id?: string | null;
    external_ad_group_id?: string | null;
    external_ad_set_id?: string | null;
    external_ad_id?: string | null;
    external_creative_id?: string | null;
  };
  sessionId?: string | null;
  resumeToken?: string | null;
  submissionKey?: string;
  honeypot?: string | null;
  submissionStartedAt?: string | null;
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
  const now = new Date().toISOString();
  if (answers.primary_objective || answers.repositionable_assets) {
    return [
      {
        id: randomUUID(),
        organization_id: "",
        lead_id: "",
        strategy_category: "Retirement",
        strategy_confidence: 0.95,
        classification_reason: `Retirement assessment · objective ${answers.primary_objective ?? "unspecified"}`,
        classification_version: "retirement-strategy-map-v1",
        created_at: now,
      },
    ];
  }
  const priority = answers.financial_priority ?? "";
  const mapped = PRIORITY_TO_STRATEGY[priority] ?? ["Business Growth"];
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
    const stateReason = rejections.find((r) =>
      r.reason.toLowerCase().includes("territory"),
    );
    lead.routing_attention =
      stateReason?.reason ??
      rejections[0]?.reason ??
      `No eligible ${lead.state} agent`;
    lead.assignment_reason = null;
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
    appendEvent(lead.id, campaign.id, null, "routing_attention_required", {
      reason: lead.routing_attention,
    });
    return lead;
  }

  selected.capacityRemaining -= 1;
  lead.assigned_organization_id = selected.id;
  lead.organization_id = selected.id;
  lead.assigned_agent_label = `${selected.name} Advisor`;
  lead.distribution_status = "assigned";
  lead.status = "qualified";
  lead.routing_attention = null;
  lead.assignment_reason = [
    `${lead.state} territory`,
    strategies[0] ? `${strategies[0]} specialist` : "Eligible strategies",
    "Eligible",
    "Capacity available",
    "Round-robin selection",
  ].join(" · ");
  new LeadOwnershipService().assign(lead, {
    organizationId: selected.id,
    ownerLabel: `${selected.name} Advisor`,
    source: "platform_distribution",
  });
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
    reason: lead.assignment_reason,
  });
  new SpeedToLeadService().markAssigned(lead);
  if (lead.operational_temperature === "HOT") {
    issueHotLeadAlert(lead);
  }

  store.notifications.unshift({
    id: randomUUID(),
    organization_id: selected.id,
    lead_id: lead.id,
    title: "New Platform Lead",
    body: `${lead.business_name} · ${lead.state} · Score ${lead.score}`,
    created_at: new Date().toISOString(),
    read: false,
  });

  return lead;
}

export async function processPublicLeadSubmission(input: PublicLeadSubmission) {
  const store = getSimStore();
  const durable = new DurableProspectService();

  // Ensure campaign exists in sim (or hydrate from Supabase in durable mode)
  let campaign = store.campaigns.find(
    (c) =>
      c.organization_slug === input.organizationSlug &&
      c.slug === input.campaignSlug,
  );
  if (!campaign && isSupabaseDataMode()) {
    const remote = await durable.resolveCampaign(
      input.organizationSlug,
      input.campaignSlug,
    );
    if (remote) {
      const orgId = String(remote.organization_id ?? "");
      if (!store.organizations.some((o) => o.id === orgId)) {
        store.organizations.push({
          id: orgId,
          slug: input.organizationSlug,
          name: String(
            (remote as { organization_name?: string }).organization_name ??
              input.organizationSlug,
          ),
          tier: "STANDARD",
          territories: ["FL", "TX", "CA", "GA", "NY"],
          strategies: ["retirement_income", "tax_advantaged_growth"],
          licenses: ["FL", "TX", "CA", "GA", "NY"],
          capacityRemaining: 50,
          status: "active",
        });
      }
      const hydrated: SimCampaign = {
        id: String(remote.id),
        organization_id: orgId,
        owner_id: orgId,
        owner_type: "SUBSCRIBER_CAMPAIGN",
        name: String(remote.name ?? input.campaignSlug),
        slug: input.campaignSlug,
        organization_slug: input.organizationSlug,
        status: "published",
        goal: String(remote.goal ?? "generate_retirement_opportunities"),
        strategy: "retirement_income",
        secondary_strategies: [],
        channels: ["linkedin"],
        territories: ["FL", "TX"],
        budget_cents: 0,
        budget_mode: "daily",
        currency: "USD",
        start_date: null,
        end_date: null,
        target_lead_count: null,
        landing_headline: "Retirement Opportunity Assessment",
        landing_support: "",
        assessment_template_key: RETIREMENT_OPPORTUNITY_V1.key,
        qualification_template_key: RETIREMENT_OPPORTUNITY_V1.key,
        branding: {},
        distribution_config: {},
        workflow_status: "active",
        launched_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        analytics: {
          views: 0,
          assessment_starts: 0,
          assessment_completions: 0,
          leads: 0,
          qualified_leads: 0,
          hot_leads: 0,
          medium_leads: 0,
          cold_leads: 0,
          priority_leads: 0,
          appointments: 0,
        },
      } as unknown as SimCampaign;
      store.campaigns.unshift(hydrated);
      campaign = hydrated;
    }
  }
  if (!campaign) throw new Error("Campaign not found");
  const status = String(campaign.status);
  if (!["active", "active_simulation", "published"].includes(status)) {
    throw new Error("Campaign is not accepting leads");
  }

  if (!input.contact.consent) throw new Error("Consent is required");
  if (!input.contact.email.includes("@")) throw new Error("Valid email required");

  const sessions = new AssessmentSessionService();
  let session = null as ReturnType<AssessmentSessionService["get"]>;
  if (input.sessionId && input.resumeToken) {
    session = await durable.getAuthorized(input.sessionId, input.resumeToken);
  } else if (input.sessionId) {
    session = sessions.get(input.sessionId);
  }

  // Idempotency: session already produced a lead
  if (session?.lead_id) {
    const existing =
      store.leads.find((l) => l.id === session!.lead_id) ??
      null;
    if (existing) {
      return {
        lead: existing,
        duplicate: true as const,
        consumerProfile: new RetirementAssessmentEngine().consumerProfile(
          existing.assessment_answers,
        ),
      };
    }
  }
  const mergedAnswers = {
    ...(session?.answers ?? {}),
    ...input.answers,
  };
  const mergedAttribution = {
    ...input.attribution,
    utm_source: input.attribution.utm_source ?? session?.attribution.utm_source,
    utm_medium: input.attribution.utm_medium ?? session?.attribution.utm_medium,
    utm_campaign:
      input.attribution.utm_campaign ?? session?.attribution.utm_campaign,
    utm_content: input.attribution.utm_content ?? session?.attribution.utm_content,
    utm_term: input.attribution.utm_term ?? session?.attribution.utm_term,
    referrer: input.attribution.referrer ?? session?.attribution.referrer,
    source_channel:
      input.attribution.source_channel ??
      session?.attribution.source_channel ??
      session?.attribution.provider,
    landing_page:
      input.attribution.landing_page ?? session?.attribution.landing_page,
    ad_provider:
      input.attribution.ad_provider ?? session?.attribution.provider,
    external_campaign_id:
      input.attribution.external_campaign_id ??
      session?.attribution.external_campaign_id,
    external_ad_group_id:
      input.attribution.external_ad_set_id ??
      session?.attribution.external_ad_set_id,
    external_ad_set_id:
      input.attribution.external_ad_set_id ??
      session?.attribution.external_ad_set_id,
    external_creative_id:
      input.attribution.external_creative_id ??
      session?.attribution.external_creative_id,
  };

  const identity = new LeadIdentityResolutionService().resolve(
    {
      id: "incoming",
      email: input.contact.email,
      phone: input.contact.phone,
      firstName: input.contact.firstName,
      lastName: input.contact.lastName,
      businessName: input.contact.businessName,
      campaignId: campaign.id,
    },
    store.leads.map((l) => ({
      id: l.id,
      email: l.email,
      phone: l.phone,
      firstName: l.first_name,
      lastName: l.last_name,
      businessName: l.business_name,
      campaignId: l.campaign_id,
    })),
  );

  if (identity.result === "DUPLICATE_SUBMISSION" && identity.matched_lead_id) {
    const existing = store.leads.find((l) => l.id === identity.matched_lead_id)!;
    appendEvent(existing.id, campaign.id, existing.organization_id, "campaign_touch", {
      mode: "duplicate_submission",
    });
    return {
      lead: existing,
      duplicate: true as const,
      consumerProfile: new RetirementAssessmentEngine().consumerProfile(
        existing.assessment_answers,
      ),
    };
  }

  const now = new Date().toISOString();
  const leadId = randomUUID();
  const org =
    campaign.owner_type === "SUBSCRIBER_CAMPAIGN"
      ? findOrgBySlug(campaign.organization_slug)
      : null;

  appendEvent(leadId, campaign.id, org?.id ?? null, "assessment_started");
  for (const [key, value] of Object.entries(mergedAnswers)) {
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

  const scored = applyScoringRules(mergedAnswers, {
    assessmentCompleted: true,
    contactSubmitted: true,
    appointmentRequested: input.appointmentRequested,
  });

  const classifications = classifyStrategies(mergedAnswers).map((c) => ({
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
    ad_provider: (mergedAttribution.ad_provider as LeadAttribution["ad_provider"]) ?? null,
    external_campaign_id: mergedAttribution.external_campaign_id ?? null,
    ad_set_id:
      mergedAttribution.external_ad_set_id ??
      mergedAttribution.external_ad_group_id ??
      null,
    creative_id: mergedAttribution.external_creative_id ?? null,
    source: mergedAttribution.source_channel ?? "campaign",
    medium: mergedAttribution.utm_medium ?? "simulation",
    utm_source: mergedAttribution.utm_source ?? null,
    utm_medium: mergedAttribution.utm_medium ?? null,
    utm_campaign: mergedAttribution.utm_campaign ?? null,
    utm_content: mergedAttribution.utm_content ?? null,
    utm_term: mergedAttribution.utm_term ?? null,
    landing_page:
      mergedAttribution.landing_page ??
      `/c/${campaign.organization_slug}/${campaign.slug}`,
    territory: input.contact.state,
    captured_at: session?.attribution.first_touch_at ?? now,
  };
  Object.freeze(attribution);

  let lead: SimLead = {
    id: leadId,
    organization_id: org?.id ?? null,
    assigned_organization_id: null,
    assigned_agent_label: null,
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
    business_name:
      input.contact.businessName ||
      `${input.contact.firstName} ${input.contact.lastName}`.trim(),
    email: input.contact.email,
    phone: input.contact.phone,
    state: input.contact.state,
    preferred_contact: input.contact.preferredContact,
    consent: input.contact.consent,
    assessment_answers: mergedAnswers,
    assessment_template_version:
      session?.assessment_version ??
      campaign.assessment_template_key ??
      campaign.qualification_template_key ??
      BUSINESS_GROWTH_ASSESSMENT_V1.version,
    attribution,
    classifications,
    distribution: null,
    distribution_status: "pending",
    created_at: now,
    updated_at: now,
    processing_flags: { scoring_pending: true },
  };

  // Persist before downstream processing
  store.leads.unshift(lead);
  new LeadInventoryService().initializeOnCreate(lead);
  lead.compliance = defaultCompliance({
    consent: input.contact.consent,
    state: input.contact.state,
    capturedAt: now,
    consentText: PUBLIC_CONSENT_TEXT,
    consentVersion: PUBLIC_CONSENT_VERSION,
  });
  lead.preferred_communication = input.contact.preferredContact;
  appendEvent(leadId, campaign.id, org?.id ?? null, "lead_submitted", {
    source: input.attribution.ad_provider ?? input.attribution.source_channel,
    consent_version: PUBLIC_CONSENT_VERSION,
    // Never log raw email/phone
  });
  campaign.analytics.assessment_completions += 1;
  campaign.analytics.leads += 1;

  try {
    lead = await applyLeadIntelligence({
      lead,
      campaign,
      appointmentRequested: input.appointmentRequested,
      extras: {
        honeypot: input.honeypot,
        submissionStartedAt: input.submissionStartedAt,
      },
    });
    lead.processing_flags = { scoring_pending: false };
    // Refresh inventory after qualification scoring
    new LeadInventoryService().initializeOnCreate(lead);
    if (lead.aging) {
      lead.aging.original_score = lead.score;
      lead.aging.current_score = lead.score;
      lead.aging.original_temperature = lead.temperature_key;
      lead.aging.current_temperature = lead.temperature_key;
    }
    // Seed operational HOT/MEDIUM/COLD without destroying Opportunity Score
    const tempScore =
      lead.qualification?.temperature.temperature_score ?? lead.score;
    new LeadTemperatureTransitionService().seedInitial(
      lead,
      tempScore,
      lead.qualification?.temperature.temperature ?? lead.temperature_key,
      "Assessment completed",
    );
    new LeadEngagementService().record(lead, "assessment_completed", {
      note: "Initial assessment completion",
    });
    new SpeedToLeadService().ensure(lead);
    appendEvent(leadId, campaign.id, org?.id ?? null, "lead_scored", {
      score: lead.score,
      temperature: lead.temperature_key,
      operational_temperature: lead.operational_temperature,
      grade: lead.intelligence?.quality_grade,
    });
    if (lead.operational_temperature === "HOT") {
      issueHotLeadAlert(lead);
      appendEvent(leadId, campaign.id, org?.id ?? null, "hot_lead_alert", {
        score: lead.score,
      });
    }
  } catch {
    lead.status = "scoring_pending";
    lead.processing_flags = { scoring_pending: true };
  }

  const gate = lead.intelligence?.quality_gate;
  const canDistribute =
    !gate ||
    (gate === "ACCEPT" &&
      lead.distribution_status !== "held" &&
      lead.distribution_status !== "nurture" &&
      lead.status !== "rejected" &&
      lead.status !== "review" &&
      lead.status !== "nurture");

  if (canDistribute) {
    if (campaign.owner_type === "SUBSCRIBER_CAMPAIGN" && org) {
      lead.organization_id = org.id;
      lead.assigned_organization_id = org.id;
      lead.assigned_agent_label = `${org.name} Advisor`;
      lead.status = "qualified";
      lead.distribution_status = "subscriber_owned";
      new LeadOwnershipService().assign(lead, {
        organizationId: org.id,
        ownerLabel: `${org.name} Advisor`,
        source: "subscriber_campaign",
      });
      lead.assignment_reason = [
        "Subscriber campaign owner",
        lead.state ? `${lead.state} territory` : null,
        "Capacity available",
      ]
        .filter(Boolean)
        .join(" · ");
      lead.routing_attention = null;
      new SpeedToLeadService().markAssigned(lead);
      appendEvent(leadId, campaign.id, org.id, "lead_assigned", {
        organization_id: org.id,
        mode: "subscriber_owned",
        reason: lead.assignment_reason,
      });
      try {
        if (lead.operational_temperature === "HOT") {
          issueHotLeadAlert(lead);
        } else {
          store.notifications.unshift({
            id: randomUUID(),
            organization_id: org.id,
            lead_id: lead.id,
            title:
              lead.intelligence?.quality_grade === "A+" ||
              lead.intelligence?.quality_grade === "A"
                ? `NEW ${lead.intelligence.quality_grade} LEAD`
                : "New Campaign Lead",
            body: `${lead.business_name} · ${lead.classifications[0]?.strategy_category ?? "Strategy"} · Priority ${lead.score}`,
            created_at: now,
            read: false,
          });
        }
        lead.processing_flags = {
          ...lead.processing_flags,
          notification_pending: false,
        };
      } catch {
        lead.processing_flags = {
          ...lead.processing_flags,
          notification_pending: true,
        };
      }
      try {
        await new AltusCRMProvider().syncSimLead(lead);
        lead.processing_flags = {
          ...lead.processing_flags,
          crm_sync_pending: false,
        };
      } catch {
        lead.processing_flags = {
          ...lead.processing_flags,
          crm_sync_pending: true,
        };
      }
    } else {
      try {
        lead = distributePlatformLead(lead, campaign);
        try {
          await new AltusCRMProvider().syncSimLead(lead);
          lead.processing_flags = {
            ...lead.processing_flags,
            crm_sync_pending: false,
          };
        } catch {
          lead.processing_flags = {
            ...lead.processing_flags,
            crm_sync_pending: true,
          };
        }
      } catch {
        lead.status = "distribution_pending";
        lead.processing_flags = {
          ...lead.processing_flags,
          distribution_pending: true,
        };
      }
    }
  }

  if (lead.score >= 60) campaign.analytics.qualified_leads += 1;
  const opTemp = lead.operational_temperature;
  if (opTemp === "HOT" || lead.temperature_key === "HOT") {
    campaign.analytics.hot_leads += 1;
  } else if (opTemp === "MEDIUM") {
    campaign.analytics.medium_leads = (campaign.analytics.medium_leads ?? 0) + 1;
  } else if (opTemp === "COLD") {
    campaign.analytics.cold_leads = (campaign.analytics.cold_leads ?? 0) + 1;
  }
  if (lead.temperature_key === "PRIORITY") campaign.analytics.priority_leads += 1;
  if (input.appointmentRequested) campaign.analytics.appointments += 1;

  // refresh stored lead reference
  const idx = store.leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) store.leads[idx] = lead;

  // Durable persist before session completion link (idempotent on session id)
  if (isSupabaseDataMode() && session) {
    try {
      await durable.persistLeadFromSim(lead, session);
    } catch (e) {
      logAltusError("LEAD_CREATION_ERROR", "Durable lead persist failed", {
        leadId: lead.id,
        reason: e instanceof Error ? e.message : "unknown",
      });
      // Lead remains in-process for recovery; fail the request so client can retry
      throw e;
    }
  }

  if (session) {
    try {
      await durable.markCompleted(session, lead.id);
    } catch (e) {
      logAltusError("ASSESSMENT_SESSION_ERROR", "Session complete failed", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      if (input.sessionId) sessions.markCompleted(input.sessionId, lead.id);
    }
  } else if (input.sessionId) {
    sessions.markCompleted(input.sessionId, lead.id);
  }

  return {
    lead,
    duplicate: false as const,
    consumerProfile: new RetirementAssessmentEngine().consumerProfile(
      lead.assessment_answers,
    ),
  };
}

export async function generateTestLead(campaignId: string) {
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
      firstName: "Marcus",
      lastName: "Reed",
      businessName: "Reed Logistics LLC",
      email: `marcus.reed+${Date.now()}@example.com`,
      phone: "(305) 555-0142",
      state: campaign.territories[0] ?? "FL",
      preferredContact: "Phone",
      consent: true,
    },
    appointmentRequested: true,
    attribution: {
      utm_source: "simulation",
      utm_medium: "test",
      utm_campaign: campaign.slug,
      source_channel: campaign.channels[0] ?? "linkedin",
      landing_page: `/c/${campaign.organization_slug}/${campaign.slug}`,
    },
    submissionStartedAt: new Date(Date.now() - 90_000).toISOString(),
  });
}
