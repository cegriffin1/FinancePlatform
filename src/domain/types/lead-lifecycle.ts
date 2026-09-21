/**
 * Operational lead temperature buckets (sales engagement readiness).
 * Separate from Opportunity Score (0–100) and fine-grained READY_NOW/VERY_HOT maps.
 */

export const OPERATIONAL_TEMPERATURES = ["HOT", "MEDIUM", "COLD"] as const;
export type OperationalTemperature = (typeof OPERATIONAL_TEMPERATURES)[number];

export const MEANINGFUL_ENGAGEMENT_TYPES = [
  "prospect_answered_phone",
  "prospect_replied_sms",
  "prospect_replied_email",
  "prospect_scheduled_appointment",
  "prospect_rescheduled_appointment",
  "prospect_attended_appointment",
  "prospect_completed_profile",
  "prospect_responded_setter",
  "prospect_responded_agent",
  "prospect_requested_info",
  "prospect_initiated_contact",
  "assessment_completed",
  "setter_verified",
] as const;
export type MeaningfulEngagementType = (typeof MEANINGFUL_ENGAGEMENT_TYPES)[number];

/** Events that do NOT reset inactivity */
export const NON_MEANINGFUL_EVENTS = [
  "agent_opened_lead",
  "automated_email_sent",
  "automated_sms_sent",
  "background_sync",
  "score_recalculated",
  "campaign_metrics_update",
  "notification_generated",
] as const;

export type LeadTemperatureSnapshot = {
  id: string;
  lead_id: string;
  temperature: OperationalTemperature;
  temperature_score: number | null;
  reason: string;
  trigger: string;
  version: string;
  previous_temperature: OperationalTemperature | null;
  calculated_at: string;
};

export type LeadEngagementEvent = {
  id: string;
  lead_id: string;
  type: MeaningfulEngagementType | string;
  meaningful: boolean;
  note: string | null;
  actor: string | null;
  occurred_at: string;
};

export type RecyclingEligibilityStatus =
  | "NOT_ELIGIBLE"
  | "PENDING"
  | "ELIGIBLE"
  | "REQUIRES_REVIEW"
  | "SUPPRESSED";

export type RecyclingEligibilityResult = {
  status: RecyclingEligibilityStatus;
  reasons: string[];
  days_since_meaningful_interaction: number;
  cold_after_days: number;
  recycle_after_days: number;
};

export type LifecycleConfig = {
  version: string;
  /** Map fine-grained keys → operational HOT/MEDIUM/COLD */
  operational_map: Record<string, OperationalTemperature>;
  /** Initial thresholds on temperature_score (0–100) */
  hot_min_score: number;
  medium_min_score: number;
  cold_after_days: number;
  recycle_after_days: number;
  ownership_duration_days: number;
  recycling_warning_days: number[];
  max_ownership_extensions_days: number;
};

export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  version: "lead-lifecycle-v1",
  operational_map: {
    READY_NOW: "HOT",
    VERY_HOT: "HOT",
    HOT: "HOT",
    PRIORITY: "HOT",
    WARM: "MEDIUM",
    MEDIUM: "MEDIUM",
    COLD: "COLD",
  },
  hot_min_score: 70,
  medium_min_score: 45,
  cold_after_days: 30,
  recycle_after_days: 45,
  ownership_duration_days: 60,
  recycling_warning_days: [14, 7, 3],
  max_ownership_extensions_days: 30,
};

export function toOperationalTemperature(
  fineGrained: string,
  config: LifecycleConfig = DEFAULT_LIFECYCLE_CONFIG,
): OperationalTemperature {
  return config.operational_map[fineGrained] ?? "MEDIUM";
}

export function operationalFromScore(
  score: number,
  config: LifecycleConfig = DEFAULT_LIFECYCLE_CONFIG,
): OperationalTemperature {
  if (score >= config.hot_min_score) return "HOT";
  if (score >= config.medium_min_score) return "MEDIUM";
  return "COLD";
}
