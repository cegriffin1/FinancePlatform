import type { Lead, StrategyClassification } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export type ClassificationContext = {
  organizationId: UUID;
  moduleKey?: string | null;
  signals: Record<string, unknown>;
  classificationVersion: string;
};

export interface LeadClassificationService {
  classify(
    lead: Lead,
    context: ClassificationContext,
  ): Promise<StrategyClassification[]>;
}
