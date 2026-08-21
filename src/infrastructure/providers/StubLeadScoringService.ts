import type {
  LeadScoreResult,
  LeadScoringContext,
  LeadScoringService,
} from "@/domain/interfaces/LeadScoringService";
import { ConfigurableLeadScoringService } from "@/application/scoring/ConfigurableLeadScoringService";
import type { Lead, LeadEvent, LeadScoreSnapshot } from "@/domain/types";
import type { LeadScoreBreakdown } from "@/domain/types/campaign-engine";

/** Thin wrapper keeping the historical stub import path. */
export class StubLeadScoringService implements LeadScoringService {
  private readonly engine = new ConfigurableLeadScoringService();

  score(lead: Lead, context: LeadScoringContext): Promise<LeadScoreResult> {
    return this.engine.score(lead, context);
  }

  applyEvent(
    lead: Lead,
    event: LeadEvent,
    context: LeadScoringContext,
  ): Promise<LeadScoreResult> {
    return this.engine.applyEvent(lead, event, context);
  }

  snapshot(lead: Lead, result: LeadScoreResult): Promise<LeadScoreSnapshot> {
    return this.engine.snapshot(lead, result);
  }

  toBreakdown(result: LeadScoreResult): LeadScoreBreakdown {
    return this.engine.toBreakdown(result);
  }
}
