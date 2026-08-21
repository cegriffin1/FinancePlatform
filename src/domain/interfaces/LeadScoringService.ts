import type {
  Lead,
  LeadEvent,
  LeadScoreSnapshot,
  LeadTemperatureKey,
  ScoringRulePack,
  TemperatureThresholdConfig,
} from "@/domain/types";
import type { LeadScoreBreakdown, LeadScoreFactor } from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";

export type LeadScoreResult = {
  score: number;
  fitScore: number;
  intentScore: number;
  engagementScore: number;
  temperatureKey: LeadTemperatureKey;
  scoringVersion: string;
  factors: LeadScoreFactor[];
  explanation: string;
  reasons: string[];
  /** @deprecated Prefer temperatureKey */
  grade?: "A" | "B" | "C" | "D";
};

export type LeadScoringContext = {
  organizationId: UUID;
  events: LeadEvent[];
  rulePack: ScoringRulePack;
  thresholds: TemperatureThresholdConfig;
  fitSignals?: Record<string, unknown>;
};

/**
 * Event-driven scoring with fit / intent / engagement breakdown.
 * Rules live in configurable packs — never in UI components.
 */
export interface LeadScoringService {
  score(lead: Lead, context: LeadScoringContext): Promise<LeadScoreResult>;
  applyEvent(
    lead: Lead,
    event: LeadEvent,
    context: LeadScoringContext,
  ): Promise<LeadScoreResult>;
  snapshot(lead: Lead, result: LeadScoreResult): Promise<LeadScoreSnapshot>;
  toBreakdown(result: LeadScoreResult): LeadScoreBreakdown;
}
