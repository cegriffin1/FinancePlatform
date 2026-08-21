import type {
  EntitlementKey,
  EntitlementValue,
  SubscriptionEntitlementService,
} from "@/domain/interfaces/SubscriptionEntitlementService";
import type { SubscriptionTier } from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";

const TIER_ENTITLEMENTS: Record<
  SubscriptionTier,
  Partial<Record<EntitlementKey, EntitlementValue>>
> = {
  STANDARD: {
    "crm.access": true,
    "campaigns.basic_templates": true,
    "campaigns.limit": 3,
    "territories.limit": 2,
    "leads.priority_platform_pool": false,
  },
  PRO: {
    "crm.access": true,
    "campaigns.basic_templates": true,
    "campaigns.premium_templates": false,
    "campaigns.limit": 10,
    "analytics.advanced": true,
    "automation.basic": true,
    "territories.limit": 5,
    "leads.priority_platform_pool": false,
  },
  PREMIER: {
    "crm.access": true,
    "campaigns.basic_templates": true,
    "campaigns.premium_templates": true,
    "campaigns.limit": 25,
    "analytics.advanced": true,
    "automation.basic": true,
    "automation.enhanced": true,
    "leads.priority_platform_pool": true,
    "territories.limit": 15,
  },
  ENTERPRISE: {
    "crm.access": true,
    "campaigns.basic_templates": true,
    "campaigns.premium_templates": true,
    "campaigns.limit": 100,
    "analytics.advanced": true,
    "automation.basic": true,
    "automation.enhanced": true,
    "leads.priority_platform_pool": true,
    "territories.limit": 50,
    "teams.enabled": true,
    "routing.custom": true,
    "integrations.dynamics": true,
    "integrations.contact_center": true,
    "governance.advanced": true,
  },
};

/** In-memory entitlement map for Phase 1 — replace with DB-backed plans later. */
export class InMemorySubscriptionEntitlementService
  implements SubscriptionEntitlementService
{
  constructor(
    private readonly orgTiers: Record<string, SubscriptionTier> = {},
  ) {}

  async getTier(organizationId: UUID): Promise<SubscriptionTier> {
    return this.orgTiers[organizationId] ?? "STANDARD";
  }

  async listEntitlements(organizationId: UUID) {
    const tier = await this.getTier(organizationId);
    return { ...TIER_ENTITLEMENTS[tier] };
  }

  async hasEntitlement(organizationId: UUID, key: EntitlementKey) {
    const value = await this.getEntitlementValue(organizationId, key);
    return Boolean(value);
  }

  async getEntitlementValue(organizationId: UUID, key: EntitlementKey) {
    const entitlements = await this.listEntitlements(organizationId);
    return entitlements[key] ?? null;
  }
}
