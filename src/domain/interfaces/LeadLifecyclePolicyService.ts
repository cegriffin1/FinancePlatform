import type { Lead, LeadLifecycleStatus } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export type LifecyclePolicyDecision = {
  currentStatus: LeadLifecycleStatus;
  nextStatus: LeadLifecycleStatus | null;
  recycleEligible: boolean;
  reasons: string[];
};

export type LifecyclePolicyContext = {
  organizationId: UUID;
  ownershipStartedAt: string;
  contactAttemptCount: number;
  lastMeaningfulInteractionAt: string | null;
  consentAllowsRedistribution: boolean;
  campaignTerms?: Record<string, unknown>;
  subscriptionTerms?: Record<string, unknown>;
};

/**
 * Recycling must never occur solely because a timer expired.
 */
export interface LeadLifecyclePolicyService {
  evaluate(
    lead: Lead,
    context: LifecyclePolicyContext,
  ): Promise<LifecyclePolicyDecision>;
}
