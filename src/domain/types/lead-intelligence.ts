/** Multidimensional Lead Intelligence domain model. */

import type { UUID } from "@/domain/types/base";

export const QUALITY_GATE_OUTCOMES = [
  "ACCEPT",
  "REVIEW",
  "NURTURE",
  "REJECT",
  "DUPLICATE",
  "SUSPECTED_FRAUD",
] as const;
export type QualityGateOutcome = (typeof QUALITY_GATE_OUTCOMES)[number];

export const IDENTITY_MATCH_RESULTS = [
  "NEW_PERSON",
  "EXISTING_PERSON",
  "POSSIBLE_MATCH",
  "DUPLICATE_SUBMISSION",
] as const;
export type IdentityMatchResult = (typeof IDENTITY_MATCH_RESULTS)[number];

export const VALIDATION_STATUSES = [
  "NOT_VERIFIED",
  "VALID",
  "INVALID",
  "RISKY",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const FRAUD_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type FraudRiskLevel = (typeof FRAUD_RISK_LEVELS)[number];

export const LEAD_GRADES = ["A+", "A", "B", "C", "D", "REVIEW"] as const;
export type LeadGrade = (typeof LEAD_GRADES)[number];

export const VALUE_BANDS = [
  "LOW",
  "STANDARD",
  "HIGH",
  "PREMIUM",
  "STRATEGIC",
] as const;
export type LeadValueBand = (typeof VALUE_BANDS)[number];

export const NEXT_BEST_ACTIONS = [
  "CALL_NOW",
  "SEND_EMAIL",
  "SEND_SMS",
  "BOOK_APPOINTMENT",
  "SEND_RESOURCE",
  "NURTURE",
  "MANAGER_REVIEW",
  "WAIT",
  "NO_ACTION",
] as const;
export type NextBestAction = (typeof NEXT_BEST_ACTIONS)[number];

export const PIPELINE_STAGES = [
  "New",
  "Attempted",
  "Contacted",
  "Qualified",
  "Appointment",
  "Opportunity",
  "Proposal",
  "Won",
  "Lost",
  "Nurture",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const LEAD_OUTCOMES = [
  "Unable to Reach",
  "Not Interested",
  "Wrong Fit",
  "Duplicate",
  "Invalid Contact",
  "Appointment Scheduled",
  "Appointment Completed",
  "Qualified Opportunity",
  "Proposal",
  "Won",
  "Lost",
  "Nurture",
] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export const RESERVATION_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "CLAIMED",
  "ASSIGNED",
  "EXPIRED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export type ScoreFactor = {
  key: string;
  dimension: string;
  points: number;
  reason: string;
};

export type DimensionScore = {
  score: number;
  factors: ScoreFactor[];
  explanation: string;
};

export type LeadIntelligenceProfile = {
  fit_score: number;
  intent_score: number;
  engagement_score: number;
  data_quality_score: number;
  contactability_score: number;
  conversion_score: number;
  lead_value_score: number;
  overall_priority_score: number;
  lead_temperature: string;
  quality_grade: LeadGrade;
  confidence: number;
  strategy_classification: string[];
  estimated_value_band: LeadValueBand;
  recommended_action: NextBestAction;
  score_version: string;
  model_version: string;
  conversion_model_label: "RULE_BASED_ESTIMATE" | "TRAINED_MODEL";
  scored_at: string;
  explanation: string;
  factors: ScoreFactor[];
  quality_gate: QualityGateOutcome;
  fraud_risk: FraudRiskLevel;
  fraud_reasons: string[];
  identity_result: IdentityMatchResult;
  validation: {
    email: ValidationStatus;
    phone: ValidationStatus;
    domain: ValidationStatus;
    provider: string;
    validated_at: string | null;
  };
};

export type LeadScoreSnapshotRecord = {
  id: UUID;
  lead_id: UUID;
  organization_id: UUID | null;
  profile: LeadIntelligenceProfile;
  created_at: string;
};

export type LeadSlaTimers = {
  lead_created_at: string;
  distributed_at: string | null;
  assigned_at: string | null;
  first_viewed_at: string | null;
  first_contact_attempt_at: string | null;
  first_contact_at: string | null;
  appointment_at: string | null;
  time_to_distribution_ms: number | null;
  time_to_assignment_ms: number | null;
  time_to_first_view_ms: number | null;
  time_to_first_attempt_ms: number | null;
  time_to_contact_ms: number | null;
  sla_minutes: number;
  sla_status: "ok" | "warning" | "breached" | "pending";
};

export type AssessmentQuestionMeta = {
  question_id: string;
  qualification_dimension: string;
  information_gain_weight: number;
  required: boolean;
  conditional_rule?: {
    when_key: string;
    when_values: string[];
  };
  scoring_effect?: string;
  strategy_effect?: string;
};

export type OptimizationRecommendation = {
  id: UUID;
  organization_id: UUID | null;
  campaign_id: UUID | null;
  message: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
};

export type CampaignQualityMetrics = {
  raw_leads: number;
  accepted_leads: number;
  qualified_leads: number;
  hot_leads: number;
  priority_leads: number;
  appointments: number;
  opportunities: number;
  wins: number;
  invalid_rate: number;
  duplicate_rate: number;
  contact_rate: number;
  appointment_rate: number;
  opportunity_rate: number;
  win_rate: number;
  quality_score: number;
};

export const DEFAULT_PRIORITY_WEIGHTS = {
  fit: 0.2,
  intent: 0.25,
  engagement: 0.1,
  data_quality: 0.15,
  contactability: 0.15,
  conversion: 0.1,
  recency: 0.05,
} as const;

export const DEFAULT_SLA_MINUTES = {
  PRIORITY: 5,
  HOT: 15,
  QUALIFIED: 60,
  WARM: 240,
  COLD: 1440,
} as const;

export const DEFAULT_GRADE_THRESHOLDS = [
  { grade: "A+" as LeadGrade, min: 90 },
  { grade: "A" as LeadGrade, min: 80 },
  { grade: "B" as LeadGrade, min: 65 },
  { grade: "C" as LeadGrade, min: 50 },
  { grade: "D" as LeadGrade, min: 30 },
  { grade: "REVIEW" as LeadGrade, min: 0 },
];
