import type {
  ClassificationContext,
  LeadClassificationService,
} from "@/domain/interfaces/LeadClassificationService";
import type { Lead, StrategyClassification } from "@/domain/types";

const SIGNAL_MAP: Array<{ key: string; category: string }> = [
  { key: "tax", category: "Tax Strategy" },
  { key: "succession", category: "Succession" },
  { key: "premium", category: "Premium Financing" },
  { key: "key_employee", category: "Key Employee" },
  { key: "executive", category: "Executive Benefits" },
  { key: "growth", category: "Business Growth" },
  { key: "protection", category: "Protection" },
  { key: "retirement", category: "Retirement" },
];

/** Internal strategy bucketing — never shown as consumer financial advice. */
export class ConfigurableLeadClassificationService
  implements LeadClassificationService
{
  async classify(
    lead: Lead,
    context: ClassificationContext,
  ): Promise<StrategyClassification[]> {
    const now = new Date().toISOString();
    const matched: StrategyClassification[] = [];

    for (const mapping of SIGNAL_MAP) {
      const raw = context.signals[mapping.key];
      if (!raw) continue;
      const confidence =
        typeof raw === "number" ? Math.min(1, Math.max(0, raw)) : 0.7;
      matched.push({
        id: crypto.randomUUID(),
        organization_id: lead.organization_id,
        lead_id: lead.id,
        strategy_category: mapping.category,
        strategy_confidence: confidence,
        classification_reason: `Signal matched: ${mapping.key}`,
        classification_version: context.classificationVersion,
        created_at: now,
      });
    }

    if (matched.length === 0) {
      matched.push({
        id: crypto.randomUUID(),
        organization_id: lead.organization_id,
        lead_id: lead.id,
        strategy_category: "Business Growth",
        strategy_confidence: 0.35,
        classification_reason: "Default bucket — insufficient signals",
        classification_version: context.classificationVersion,
        created_at: now,
      });
    }

    return matched;
  }
}
