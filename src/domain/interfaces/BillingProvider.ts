import type {
  CampaignPackage,
  LeadPackage,
  SubscriptionEntitlement,
  SubscriptionPlan,
} from "@/domain/types";
import type { UUID } from "@/domain/types/base";

/**
 * Payment processing is not implemented yet — interface only.
 */
export interface BillingProvider {
  listPlans(): Promise<SubscriptionPlan[]>;
  getEntitlements(planId: UUID): Promise<SubscriptionEntitlement[]>;
  listCampaignPackages(): Promise<CampaignPackage[]>;
  listLeadPackages(): Promise<LeadPackage[]>;
}
