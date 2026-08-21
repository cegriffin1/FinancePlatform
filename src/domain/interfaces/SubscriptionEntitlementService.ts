import type { SubscriptionTier } from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";

export type EntitlementKey =
  | "crm.access"
  | "campaigns.basic_templates"
  | "campaigns.premium_templates"
  | "campaigns.limit"
  | "analytics.advanced"
  | "automation.basic"
  | "automation.enhanced"
  | "leads.priority_platform_pool"
  | "territories.limit"
  | "teams.enabled"
  | "routing.custom"
  | "integrations.dynamics"
  | "integrations.contact_center"
  | "governance.advanced";

export type EntitlementValue = boolean | number | string;

export interface SubscriptionEntitlementService {
  getTier(organizationId: UUID): Promise<SubscriptionTier>;
  hasEntitlement(
    organizationId: UUID,
    key: EntitlementKey,
  ): Promise<boolean>;
  getEntitlementValue(
    organizationId: UUID,
    key: EntitlementKey,
  ): Promise<EntitlementValue | null>;
  listEntitlements(
    organizationId: UUID,
  ): Promise<Partial<Record<EntitlementKey, EntitlementValue>>>;
}
