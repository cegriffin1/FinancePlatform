import type {
  LeadScoreResult,
  LeadScoringContext,
  LeadScoringService,
} from "@/domain/interfaces/LeadScoringService";
import type { Lead, LeadEvent, LeadScoreSnapshot } from "@/domain/types";
import type { LeadScoreBreakdown, LeadScoreFactor } from "@/domain/types/campaign-engine";
import { DEFAULT_SCORE_TEMPERATURE_BANDS } from "@/domain/types/campaign-engine";

const INTENT_EVENTS: Record<string, number> = {
  "assessment.completed": 12,
  "contact.submitted": 15,
  "appointment.calendar_opened": 8,
  "appointment.scheduled": 20,
  "appointment.scheduled_within_24h": 10,
  "appointment.scheduled_within_72h": 6,
  "resource.requested": 5,
  "email.opened": 2,
  "sms.interacted": 3,
};

const ENGAGEMENT_EVENTS: Record<string, number> = {
  "landing.viewed": 2,
  "assessment.started": 4,
  "question.answered": 2,
  "document.viewed": 3,
  "follow_up.responded": 5,
  "portal.created": 6,
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function temperatureFor(
  score: number,
  bands: TemperatureBands,
): string {
  const sorted = [...bands].sort((a, b) => b.min_score - a.min_score);
  return sorted.find((b) => score >= b.min_score)?.key ?? "COLD";
}

type TemperatureBands = Array<{ key: string; min_score: number }>;

/**
 * Configurable scoring engine — Phase 1 implementation used by app services.
 */
export class ConfigurableLeadScoringService implements LeadScoringService {
  async score(lead: Lead, context: LeadScoringContext): Promise<LeadScoreResult> {
    const factors: LeadScoreFactor[] = [];

    // FIT
    let fit = 20;
    const signals = context.fitSignals ?? {};
    if (signals.business_owner === true) {
      fit += 15;
      factors.push({
        key: "fit.business_owner",
        category: "fit",
        points: 15,
        reason: "Business owner signal",
      });
    }
    if (typeof signals.company_size === "string" && signals.company_size) {
      fit += 8;
      factors.push({
        key: "fit.company_size",
        category: "fit",
        points: 8,
        reason: `Company size: ${signals.company_size}`,
      });
    }
    if (typeof signals.revenue_range === "string" && signals.revenue_range) {
      fit += 8;
      factors.push({
        key: "fit.revenue",
        category: "fit",
        points: 8,
        reason: `Revenue range: ${signals.revenue_range}`,
      });
    }
    if (typeof signals.strategy_fit === "number") {
      const pts = Math.round(Number(signals.strategy_fit) * 12);
      fit += pts;
      factors.push({
        key: "fit.strategy",
        category: "fit",
        points: pts,
        reason: "Strategy fit signal",
      });
    }
    if (typeof signals.geography === "string" && signals.geography) {
      fit += 5;
      factors.push({
        key: "fit.geography",
        category: "fit",
        points: 5,
        reason: `Geography: ${signals.geography}`,
      });
    }
    fit = clamp(fit, 0, 40);

    // INTENT from events + rule pack overlays
    let intent = 0;
    for (const event of context.events) {
      const base = INTENT_EVENTS[event.event_type] ?? 0;
      const packBonus =
        context.rulePack.rules.find((r) => r.event_type === event.event_type)?.points ??
        0;
      const points = base || packBonus;
      if (points > 0) {
        intent += points;
        factors.push({
          key: `intent.${event.event_type}`,
          category: "intent",
          points,
          reason: `Intent event: ${event.event_type}`,
        });
      }
    }
    intent = clamp(intent, 0, 40);

    // ENGAGEMENT
    let engagement = 0;
    for (const event of context.events) {
      const points = ENGAGEMENT_EVENTS[event.event_type] ?? 0;
      if (points > 0) {
        engagement += points;
        factors.push({
          key: `engagement.${event.event_type}`,
          category: "engagement",
          points,
          reason: `Engagement event: ${event.event_type}`,
        });
      }
    }
    engagement = clamp(engagement, 0, 20);

    const score = clamp(fit + intent + engagement);
    const bands: TemperatureBands =
      context.thresholds.bands.length > 0
        ? context.thresholds.bands
        : [...DEFAULT_SCORE_TEMPERATURE_BANDS];
    const temperatureKey = temperatureFor(score, bands);
    const explanation = `Fit ${fit} + Intent ${intent} + Engagement ${engagement} = ${score} (${temperatureKey})`;

    return {
      score,
      fitScore: fit,
      intentScore: intent,
      engagementScore: engagement,
      temperatureKey,
      scoringVersion: context.rulePack.version,
      factors,
      explanation,
      reasons: factors.map((f) => f.reason),
      grade: score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
    };
  }

  async applyEvent(
    lead: Lead,
    event: LeadEvent,
    context: LeadScoringContext,
  ): Promise<LeadScoreResult> {
    return this.score(lead, {
      ...context,
      events: [...context.events, event],
    });
  }

  async snapshot(lead: Lead, result: LeadScoreResult): Promise<LeadScoreSnapshot> {
    return {
      id: crypto.randomUUID(),
      organization_id: lead.organization_id,
      lead_id: lead.id,
      score: result.score,
      temperature_key: result.temperatureKey,
      scoring_version: result.scoringVersion,
      reasons: result.reasons,
      created_at: new Date().toISOString(),
    };
  }

  toBreakdown(result: LeadScoreResult): LeadScoreBreakdown {
    return {
      total: result.score,
      fit: result.fitScore,
      intent: result.intentScore,
      engagement: result.engagementScore,
      classification: result.temperatureKey,
      scoring_version: result.scoringVersion,
      factors: result.factors,
      explanation: result.explanation,
    };
  }
}
