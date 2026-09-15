/** Lead inventory lifecycle, marketplace, compliance, and pricing. */

import type { UUID } from "@/domain/types/base";
import {
  DEFAULT_OWNERSHIP_PERIOD_DAYS,
  type OwnershipConfig,
} from "@/domain/types/retirement-crm";

export const INVENTORY_LIFECYCLE_STATUSES = [
  "NEW",
  "QUALIFIED",
  "PURCHASED_ASSIGNED",
  "ACTIVE_OWNERSHIP",
  "EXPIRING",
  "RELEASED",
  "MARKETPLACE_ELIGIBLE",
  "MARKETPLACE",
  "REPURCHASED",
  "SOLD",
  "SUPPRESSED",
  "NOT_ELIGIBLE_FOR_RESALE",
] as const;
export type InventoryLifecycleStatus = (typeof INVENTORY_LIFECYCLE_STATUSES)[number];

export const EXPIRY_WARNING_DAYS = [14, 7, 3] as const;

export type LeadComplianceProfile = {
  marketing_consent: boolean;
  contact_consent: boolean;
  /** Required for marketplace listing / transfer. */
  data_sharing_permitted: boolean;
  resale_permitted: boolean;
  suppressed: boolean;
  suppression_reason: string | null;
  retention_policy_days: number;
  jurisdiction: string;
  /** States/jurisdictions where resale is blocked. */
  restricted_jurisdictions: string[];
  consent_basis: string;
  consent_captured_at: string | null;
  sharing_permissions_note: string | null;
};

export const DEFAULT_RETENTION_POLICY_DAYS = 365;

export function defaultCompliance(input: {
  consent: boolean;
  state: string;
  capturedAt?: string | null;
}): LeadComplianceProfile {
  return {
    marketing_consent: input.consent,
    contact_consent: input.consent,
    data_sharing_permitted: input.consent,
    resale_permitted: input.consent,
    suppressed: false,
    suppression_reason: null,
    retention_policy_days: DEFAULT_RETENTION_POLICY_DAYS,
    jurisdiction: input.state,
    restricted_jurisdictions: [],
    consent_basis: input.consent ? "web_form_express" : "none",
    consent_captured_at: input.consent ? (input.capturedAt ?? new Date().toISOString()) : null,
    sharing_permissions_note: null,
  };
}

export type ScoreAgingSnapshot = {
  original_score: number;
  current_score: number;
  original_temperature: string;
  current_temperature: string;
  last_decayed_at: string | null;
};

export type MarketplaceListingPreview = {
  lead_id: UUID;
  lead_type: string;
  title: string;
  state: string;
  age_range: string | null;
  asset_band: string | null;
  asset_tier: string | null;
  primary_objective: string | null;
  original_opportunity_score: number;
  current_temperature: string;
  lead_age_days: number;
  price_cents: number;
  exclusivity: "exclusive" | "shared";
  /** No PII in preview. */
  setter_verified: boolean;
};

export type PricingInputs = {
  asset_tier: string;
  original_score: number;
  current_temperature: string;
  profile_completeness: number;
  setter_verified: boolean;
  appointment_count: number;
  lead_age_days: number;
  exclusivity: "exclusive" | "shared";
  demand_index: number;
  territory: string;
};

export type PricingBandConfig = {
  asset_tier: string;
  base_cents: number;
};

export type LeadPricingConfig = {
  currency: "USD";
  bands: PricingBandConfig[];
  score_multiplier_per_point: number;
  temperature_multipliers: Record<string, number>;
  completeness_bonus_cents: number;
  setter_verified_bonus_cents: number;
  appointment_bonus_cents: number;
  age_decay_per_day_bps: number;
  exclusivity_multiplier: number;
  demand_multiplier: number;
  territory_multipliers: Record<string, number>;
  min_cents: number;
  max_cents: number;
};

export const DEFAULT_PRICING_CONFIG: LeadPricingConfig = {
  currency: "USD",
  bands: [
    { asset_tier: "BELOW_TARGET", base_cents: 2_500 },
    { asset_tier: "GOLD", base_cents: 12_500 },
    { asset_tier: "DIAMOND", base_cents: 22_500 },
    { asset_tier: "BLACK", base_cents: 35_000 },
  ],
  score_multiplier_per_point: 0.004,
  temperature_multipliers: {
    COLD: 0.7,
    WARM: 0.85,
    HOT: 1.0,
    VERY_HOT: 1.15,
    READY_NOW: 1.25,
  },
  completeness_bonus_cents: 1_500,
  setter_verified_bonus_cents: 2_500,
  appointment_bonus_cents: 2_000,
  age_decay_per_day_bps: 25,
  exclusivity_multiplier: 1.35,
  demand_multiplier: 1.0,
  territory_multipliers: { FL: 1.1, TX: 1.05, CA: 1.08, default: 1.0 },
  min_cents: 2_500,
  max_cents: 75_000,
};

export type LeadPurchaseRecord = {
  id: UUID;
  lead_id: UUID;
  buyer_organization_id: UUID;
  buyer_agent_id: string | null;
  seller_organization_id: UUID | null;
  seller_type: "platform" | "organization";
  price_cents: number;
  currency: "USD";
  purchased_at: string;
  rights_granted: string[];
  ownership_expires_at: string;
  lead_version: number;
  consent_basis: string;
  exclusivity: "exclusive" | "shared";
  reservation_id: string | null;
};

export type LeadReservation = {
  id: UUID;
  lead_id: UUID;
  buyer_organization_id: UUID;
  buyer_agent_id: string | null;
  reserved_at: string;
  expires_at: string;
  lead_version: number;
  status: "active" | "consumed" | "expired" | "cancelled";
};

export type InventoryExtension = {
  id: UUID;
  lead_id: UUID;
  days_added: number;
  reason: string;
  granted_by: string | null;
  created_at: string;
  previous_expires_at: string;
  new_expires_at: string;
};

export type InventoryConfig = OwnershipConfig & {
  expiry_warning_days: number[];
  max_extension_days: number;
  reservation_ttl_seconds: number;
  marketplace_min_age_days: number;
};

export const DEFAULT_INVENTORY_CONFIG: InventoryConfig = {
  ownership_period_days: DEFAULT_OWNERSHIP_PERIOD_DAYS,
  expiry_warning_days: [...EXPIRY_WARNING_DAYS],
  max_extension_days: 30,
  reservation_ttl_seconds: 120,
  marketplace_min_age_days: 0,
};

export type ComplianceGateResult = {
  eligible: boolean;
  reasons: string[];
};
