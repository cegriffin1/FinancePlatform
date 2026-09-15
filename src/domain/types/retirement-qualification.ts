/** MVP retirement qualification, temperature, and commercial tiers. */

export const LEAD_TEMPERATURES = [
  "COLD",
  "WARM",
  "HOT",
  "VERY_HOT",
  "READY_NOW",
] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const ASSET_COMMERCIAL_TIERS = [
  "BELOW_TARGET",
  "GOLD",
  "DIAMOND",
  "BLACK",
] as const;
export type AssetCommercialTier = (typeof ASSET_COMMERCIAL_TIERS)[number];

export const ASSET_VERIFICATION_STATUSES = [
  "SELF_REPORTED",
  "SETTER_VERIFIED",
] as const;
export type AssetVerificationStatus = (typeof ASSET_VERIFICATION_STATUSES)[number];

export const COMMERCIAL_LEAD_STATUSES = [
  "INCOMPLETE",
  "NURTURE",
  "QUALIFIED",
  "HIGH_VALUE",
  "SETTER_REVIEW",
  "SETTER_VERIFIED",
  "APPOINTMENT_READY",
  "ASSIGNED",
  "DISQUALIFIED",
] as const;
export type CommercialLeadStatus = (typeof COMMERCIAL_LEAD_STATUSES)[number];

export type ScoreFactorRecord = {
  key: string;
  dimension: string;
  points: number;
  reason: string;
};

export type ProfileCompleteness = {
  answered_core_questions: number;
  applicable_questions: number;
  profile_completion_percentage: number;
  answered_keys: string[];
  missing_keys: string[];
};

export type AssetQualification = {
  repositionable_asset_band: string | null;
  repositionable_min_cents: number | null;
  repositionable_max_cents: number | null;
  meets_target_asset_threshold: boolean;
  commercial_tier: AssetCommercialTier;
  verification_status: AssetVerificationStatus;
  total_retirement_asset_band: string | null;
};

export type OpportunityScoreResult = {
  opportunity_score: number;
  opportunity_size: number;
  intent_timing: number;
  retirement_need: number;
  strategy_alignment: number;
  engagement_quality: number;
  classification:
    | "ELITE_OPPORTUNITY"
    | "HIGH_PRIORITY"
    | "QUALIFIED"
    | "DEVELOPING"
    | "NURTURE";
  factors: ScoreFactorRecord[];
  explanation: string;
  score_version: string;
};

export type TemperatureResult = {
  temperature: LeadTemperature;
  temperature_score: number;
  factors: ScoreFactorRecord[];
  temperature_version: string;
};

export type LeadGrade = "A+" | "A" | "B" | "C" | "D";

export type LeadQualificationProfile = {
  completeness: ProfileCompleteness;
  asset: AssetQualification;
  opportunity: OpportunityScoreResult;
  temperature: TemperatureResult;
  commercial_status: CommercialLeadStatus;
  /** Derived from decision timeline — readiness of commercial intent. */
  intent_label: string;
  lead_grade: LeadGrade;
  /** Agent may receive lead only after commercial gates pass. */
  agent_eligible: boolean;
  setter_priority: number;
  recommended_next_step: string;
  scored_at: string;
  score_version: string;
  temperature_version: string;
};

/** Configurable temperature thresholds. */
export const DEFAULT_TEMPERATURE_THRESHOLDS = [
  { key: "READY_NOW" as LeadTemperature, min: 90 },
  { key: "VERY_HOT" as LeadTemperature, min: 75 },
  { key: "HOT" as LeadTemperature, min: 65 },
  { key: "WARM" as LeadTemperature, min: 50 },
  { key: "COLD" as LeadTemperature, min: 0 },
];

/** Configurable repositionable asset bands (cents). */
export const DEFAULT_ASSET_BANDS = [
  {
    key: "Under $250K",
    tier: "BELOW_TARGET" as AssetCommercialTier,
    min_cents: 0,
    max_cents: 24_999_900,
    opportunity_points: 3,
  },
  {
    key: "$250K–$499K",
    tier: "GOLD" as AssetCommercialTier,
    min_cents: 25_000_000,
    max_cents: 49_999_900,
    opportunity_points: 15,
  },
  {
    key: "$500K–$749K",
    tier: "GOLD" as AssetCommercialTier,
    min_cents: 50_000_000,
    max_cents: 74_999_900,
    opportunity_points: 20,
  },
  {
    key: "$750K–$999K",
    tier: "GOLD" as AssetCommercialTier,
    min_cents: 75_000_000,
    max_cents: 99_999_900,
    opportunity_points: 25,
  },
  {
    key: "$1M–$1.99M",
    tier: "DIAMOND" as AssetCommercialTier,
    min_cents: 100_000_000,
    max_cents: 199_999_900,
    opportunity_points: 28,
  },
  {
    key: "$1M+",
    tier: "DIAMOND" as AssetCommercialTier,
    min_cents: 100_000_000,
    max_cents: 299_999_900,
    opportunity_points: 30,
  },
  {
    key: "$2M+",
    tier: "DIAMOND" as AssetCommercialTier,
    min_cents: 200_000_000,
    max_cents: 299_999_900,
    opportunity_points: 30,
  },
  {
    key: "$3M+",
    tier: "BLACK" as AssetCommercialTier,
    min_cents: 300_000_000,
    max_cents: null,
    opportunity_points: 30,
  },
] as const;

export const TARGET_REPOSITIONABLE_MIN_CENTS = 25_000_000;

export const DEFAULT_INTENT_TIMELINE_POINTS: Record<string, number> = {
  Immediately: 25,
  "Within 30 days": 22,
  "1–3 months": 17,
  "3–6 months": 11,
  "6–12 months": 6,
  "Just researching": 2,
};
