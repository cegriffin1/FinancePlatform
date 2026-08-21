import type { LeadClassificationService } from "@/domain/interfaces/LeadClassificationService";
import type { LeadLifecyclePolicyService } from "@/domain/interfaces/LeadLifecyclePolicyService";
import type { LeadNurtureService } from "@/domain/interfaces/LeadNurtureService";
import type { TerritoryEligibilityService } from "@/domain/interfaces/TerritoryEligibilityService";
import type { BillingProvider } from "@/domain/interfaces/BillingProvider";
import type { AdvancedMarketsModule } from "@/domain/interfaces/AdvancedMarketsModule";
import {
  ADVANCED_MARKETS_DESCRIPTOR,
  ADVANCED_MARKETS_STRATEGY_CATEGORIES,
} from "@/domain/accelerators/advanced-markets";
import type { Lead, StrategyClassification } from "@/domain/types";

export class StubLeadClassificationService implements LeadClassificationService {
  async classify(
    lead: Lead,
    context: { classificationVersion: string },
  ): Promise<StrategyClassification[]> {
    return [
      {
        id: "00000000-0000-4000-8000-000000000020",
        organization_id: lead.organization_id,
        lead_id: lead.id,
        strategy_category: "General Protection",
        strategy_confidence: 0.4,
        classification_reason: "stub-classification",
        classification_version: context.classificationVersion,
        created_at: new Date().toISOString(),
      },
    ];
  }
}

export class StubTerritoryEligibilityService implements TerritoryEligibilityService {
  async evaluate() {
    return { eligible: true, reasons: ["stub-allow-all"] };
  }
}

export class StubLeadLifecyclePolicyService implements LeadLifecyclePolicyService {
  async evaluate(lead: Lead) {
    return {
      currentStatus: (lead.lifecycle_status as never) ?? "NEW",
      nextStatus: null,
      recycleEligible: false,
      reasons: ["stub-no-recycle"],
    };
  }
}

export class StubLeadNurtureService implements LeadNurtureService {
  async enroll(lead: Lead, sequenceKey: string, organizationId: string) {
    return {
      id: "00000000-0000-4000-8000-000000000030",
      organization_id: organizationId,
      lead_id: lead.id,
      sequence_key: sequenceKey,
      status: "active" as const,
      enrolled_at: new Date().toISOString(),
    };
  }

  async suggestLifecycleTransition() {
    return null;
  }
}

export class StubBillingProvider implements BillingProvider {
  async listPlans() {
    return [];
  }
  async getEntitlements() {
    return [];
  }
  async listCampaignPackages() {
    return [];
  }
  async listLeadPackages() {
    return [];
  }
}

export class StubAdvancedMarketsModule implements AdvancedMarketsModule {
  descriptor = {
    ...ADVANCED_MARKETS_DESCRIPTOR,
    key: ADVANCED_MARKETS_DESCRIPTOR.key,
  };

  strategyCatalog() {
    return [...ADVANCED_MARKETS_STRATEGY_CATEGORIES];
  }

  scoringRulePackKey() {
    return "advanced_markets.default_scoring";
  }

  defaultQualificationTemplateKey() {
    return "advanced_markets.stage1.engagement";
  }
}
