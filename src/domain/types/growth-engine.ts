/** Growth-engine & accelerator domain types (core remains industry-neutral). */

import type { AuditFields, UUID } from "@/domain/types/base";

/** Recommended defaults — orgs may configure alternate keys/thresholds. */
export const DEFAULT_LEAD_TEMPERATURES = [
  "COLD",
  "WARM",
  "QUALIFIED",
  "HOT",
  "PRIORITY",
] as const;

export type LeadTemperatureKey = string;

export const LEAD_EVENT_TYPES = [
  "campaign.clicked",
  "landing.viewed",
  "assessment.started",
  "question.answered",
  "assessment.completed",
  "assessment.abandoned",
  "contact.submitted",
  "resource.requested",
  "email.opened",
  "sms.interacted",
  "appointment.calendar_opened",
  "appointment.scheduled",
  "appointment.scheduled_within_24h",
  "appointment.scheduled_within_72h",
  "appointment.confirmed",
  "appointment.attended",
  "appointment.missed",
  "appointment.cancelled",
  "appointment.rescheduled",
  "follow_up.responded",
  "portal.created",
  "document.viewed",
  "opportunity.created",
  "lead.score_changed",
  "lead.temperature_changed",
  "lead.classified",
  "lead.assigned",
  "lead.nurture_entered",
  "lead.recycle_reviewed",
] as const;

export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number] | (string & {});

export type LeadEvent = {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  event_type: LeadEventType;
  occurred_at: string;
  actor_profile_id: UUID | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type LeadProvenance = {
  lead_id: UUID;
  organization_id: UUID;
  original_campaign_id: UUID | null;
  original_organization_id: UUID;
  source: string | null;
  source_platform: string | null;
  source_ad: string | null;
  source_creative: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  captured_at: string;
  qualification_version: string | null;
  scoring_version: string | null;
};

export type LeadScoreSnapshot = {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  score: number;
  temperature_key: LeadTemperatureKey;
  scoring_version: string;
  reasons: string[];
  created_at: string;
};

export type StrategyClassification = {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  strategy_category: string;
  strategy_confidence: number;
  classification_reason: string;
  classification_version: string;
  created_at: string;
};

export type QuestionInteractionType =
  | "single_select"
  | "multi_select"
  | "slider"
  | "numeric"
  | "yes_no"
  | "short_text"
  | "currency_range"
  | "conditional"
  | "location_state"
  | "datetime_schedule";

export type QualificationQuestion = {
  id: UUID;
  template_id: UUID;
  key: string;
  prompt: string;
  interaction_type: QuestionInteractionType;
  options: unknown;
  position: number;
  metadata: Record<string, unknown>;
};

export type QualificationBranch = {
  id: UUID;
  template_id: UUID;
  from_question_id: UUID;
  to_question_id: UUID | null;
  condition: Record<string, unknown>;
};

export type QualificationTemplate = AuditFields & {
  id: UUID;
  organization_id: UUID | null;
  module_key: string | null;
  key: string;
  name: string;
  stage: 1 | 2;
  version: string;
  status: "draft" | "published" | "archived";
};

export type CampaignTemplate = AuditFields & {
  id: UUID;
  organization_id: UUID | null;
  module_key: string | null;
  key: string;
  name: string;
  growth_objective: string;
  qualification_template_key: string | null;
  metadata: Record<string, unknown>;
};

export type AgentTerritory = AuditFields & {
  id: UUID;
  organization_id: UUID;
  member_id: UUID;
  region_code: string;
  country_code: string;
};

export type AgentLicense = AuditFields & {
  id: UUID;
  organization_id: UUID;
  member_id: UUID;
  license_type: string;
  jurisdiction_code: string;
  status: "declared" | "verified" | "expired" | "revoked";
  /** Self-attested or externally verified — not a regulatory determination by the app. */
  attestation_source: string | null;
};

export type AppointmentIntent = {
  appointment_requested_at: string | null;
  appointment_scheduled_for: string | null;
  days_until_appointment: number | null;
  appointment_status:
    | "none"
    | "requested"
    | "scheduled"
    | "confirmed"
    | "attended"
    | "cancelled"
    | "rescheduled"
    | "no_show"
    | null;
  appointment_attended: boolean;
  appointment_cancelled: boolean;
  appointment_rescheduled: boolean;
  appointment_no_show: boolean;
};

export type LeadLifecycleStatus =
  | "NEW"
  | "CONTACTED"
  | "ENGAGED"
  | "QUALIFIED_NOT_SCHEDULED"
  | "ABANDONED_ASSESSMENT"
  | "APPOINTMENT_SCHEDULED"
  | "APPOINTMENT_COMPLETED"
  | "NO_RESPONSE"
  | "NURTURE"
  | "REENGAGED"
  | "NO_SHOW"
  | "RESCHEDULED"
  | "OPPORTUNITY"
  | "WON"
  | "DORMANT"
  | "RECYCLE_REVIEW"
  | "RECYCLE_ELIGIBLE"
  | (string & {});

export type ScoringRulePack = {
  id: UUID;
  organization_id: UUID | null;
  module_key: string | null;
  key: string;
  version: string;
  rules: ScoringRule[];
};

export type ScoringRule = {
  event_type: LeadEventType;
  points: number;
  conditions?: Record<string, unknown>;
};

export type TemperatureThresholdConfig = {
  id: UUID;
  organization_id: UUID | null;
  version: string;
  bands: Array<{ key: LeadTemperatureKey; min_score: number }>;
};

export type SubscriptionPlan = {
  id: UUID;
  key: string;
  name: string;
  billing_period: "monthly" | "annual" | "custom";
  metadata: Record<string, unknown>;
};

export type SubscriptionEntitlement = {
  id: UUID;
  plan_id: UUID;
  key: string;
  value: string | number | boolean;
};

export type CampaignPackage = {
  id: UUID;
  key: string;
  name: string;
  metadata: Record<string, unknown>;
};

export type LeadPackage = {
  id: UUID;
  key: string;
  name: string;
  metadata: Record<string, unknown>;
};

export type LeadAccessTier = "STANDARD" | "PRO" | "PREMIUM" | "ENTERPRISE" | (string & {});

export type AcceleratorModuleKey = "advanced_markets" | (string & {});

export type AcceleratorModuleDescriptor = {
  key: AcceleratorModuleKey;
  displayName: string;
  registers: {
    campaignTemplates: boolean;
    qualificationTemplates: boolean;
    scoringRulePacks: boolean;
    strategyCatalog: boolean;
    routingOverlays: boolean;
    entitlementOverlays: boolean;
    nurtureSequences: boolean;
  };
};
