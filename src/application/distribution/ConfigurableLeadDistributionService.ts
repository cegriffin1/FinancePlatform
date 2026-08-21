import type {
  LeadDistributionContext,
  LeadDistributionService,
} from "@/domain/interfaces/LeadDistributionService";
import type { Lead } from "@/domain/types";
import type { LeadDistributionDecision } from "@/domain/types/campaign-engine";
import type { SubscriptionTier } from "@/domain/types/campaign-engine";

const TIER_RANK: Record<SubscriptionTier, number> = {
  STANDARD: 1,
  PRO: 2,
  PREMIER: 3,
  ENTERPRISE: 3,
};

/**
 * Auditable platform distribution — Phase 1 rule engine (no live marketplace).
 * Never routes by tier alone; always applies territory/strategy/capacity filters.
 */
export class ConfigurableLeadDistributionService implements LeadDistributionService {
  async distribute(
    lead: Lead,
    context: LeadDistributionContext,
  ): Promise<LeadDistributionDecision> {
    const rejections: Array<{ organization_id: string; reason: string }> = [];
    let pool = [...context.candidates];

    pool = pool.filter((c) => {
      if (context.leadTerritory && !c.territories.includes(context.leadTerritory)) {
        rejections.push({
          organization_id: c.organizationId,
          reason: `Territory mismatch: ${context.leadTerritory}`,
        });
        return false;
      }
      if (
        context.strategyCategories.length > 0 &&
        !context.strategyCategories.some((s) => c.strategyKeys.includes(s))
      ) {
        rejections.push({
          organization_id: c.organizationId,
          reason: "Strategy eligibility mismatch",
        });
        return false;
      }
      if (
        context.requiredLicenseTypes?.length &&
        !context.requiredLicenseTypes.every((l) => c.licenseTypes.includes(l))
      ) {
        rejections.push({
          organization_id: c.organizationId,
          reason: "License eligibility mismatch",
        });
        return false;
      }
      if (c.capacityRemaining <= 0) {
        rejections.push({
          organization_id: c.organizationId,
          reason: "No remaining capacity",
        });
        return false;
      }
      return true;
    });

    const temperature = (lead.temperature_key ?? "").toUpperCase();
    const isPriority =
      temperature === "PRIORITY" || temperature === "HOT" || (lead.score ?? 0) >= 80;

    if (context.preferPremierForPriority && isPriority && pool.length > 0) {
      const premier = pool.filter(
        (c) => c.subscriptionTier === "PREMIER" || c.subscriptionTier === "ENTERPRISE",
      );
      if (premier.length > 0) {
        pool = premier;
      }
    }

    if (context.method === "priority_tier") {
      pool.sort(
        (a, b) => TIER_RANK[b.subscriptionTier] - TIER_RANK[a.subscriptionTier],
      );
    } else if (context.method === "lowest_workload") {
      pool.sort((a, b) => b.capacityRemaining - a.capacityRemaining);
    } else if (context.method === "highest_conversion") {
      pool.sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0));
    } else if (context.method === "campaign_owner" && lead.organization_id) {
      pool = pool.filter((c) => c.organizationId === lead.organization_id);
    }

    const selected = pool[0] ?? null;

    return {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      candidates_considered: context.candidates.map((c) => c.organizationId),
      candidate_rejections: rejections,
      selected_organization_id: selected?.organizationId ?? null,
      selected_agent_id: null,
      distribution_method: context.method,
      rule_version: context.ruleVersion,
      decided_at: new Date().toISOString(),
    };
  }
}
