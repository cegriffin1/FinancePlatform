import type {
  DistributionMethod,
  LeadDistributionDecision,
  SubscriptionTier,
} from "@/domain/types/campaign-engine";
import type { Lead } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export type DistributionCandidate = {
  organizationId: UUID;
  subscriptionTier: SubscriptionTier;
  territories: string[];
  strategyKeys: string[];
  licenseTypes: string[];
  capacityRemaining: number;
  conversionRate?: number;
};

export type LeadDistributionContext = {
  method: DistributionMethod;
  ruleVersion: string;
  leadTerritory: string | null;
  strategyCategories: string[];
  requiredLicenseTypes?: string[];
  candidates: DistributionCandidate[];
  /** When true, PRIORITY/HOT platform leads prefer PREMIER before lower tiers. */
  preferPremierForPriority: boolean;
};

export interface LeadDistributionService {
  distribute(
    lead: Lead,
    context: LeadDistributionContext,
  ): Promise<LeadDistributionDecision>;
}
