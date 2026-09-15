import { AssetQualificationService } from "@/application/retirement/AssetQualificationService";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";
import {
  DEFAULT_INTENT_TIMELINE_POINTS,
  type OpportunityScoreResult,
  type ScoreFactorRecord,
} from "@/domain/types/retirement-qualification";

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type RetirementScoringInput = {
  answers: Record<string, string>;
  consent: boolean;
  appointmentRequested: boolean;
  assessmentCompleted: boolean;
  contactSubmitted: boolean;
  fraudLow?: boolean;
  duplicate?: boolean;
};

/**
 * Deterministic, explainable retirement opportunity score 0–100.
 * Dimensions: size 30 + intent 25 + need 20 + alignment 15 + engagement 10.
 */
export class RetirementOpportunityScoringService {
  private readonly assets = new AssetQualificationService();
  private readonly completeness = new ProfileCompletenessService();

  score(input: RetirementScoringInput): OpportunityScoreResult {
    const factors: ScoreFactorRecord[] = [];

    // Opportunity size (max 30) — Q7 primary
    const sizePts = this.assets.opportunityPoints(
      input.answers.repositionable_assets ?? null,
    );
    factors.push({
      key: "opp.size.repositionable",
      dimension: "opportunity_size",
      points: sizePts,
      reason: `Repositionable assets: ${input.answers.repositionable_assets ?? "unknown"}`,
    });
    const opportunity_size = Math.min(30, sizePts);

    // Intent / timing (max 25) — Q24 primary
    let intent = DEFAULT_INTENT_TIMELINE_POINTS[input.answers.decision_timeline ?? ""] ?? 0;
    factors.push({
      key: "opp.intent.timeline",
      dimension: "intent_timing",
      points: intent,
      reason: `Decision timeline: ${input.answers.decision_timeline ?? "unknown"}`,
    });
    if (input.appointmentRequested) {
      intent = Math.min(25, intent + 3);
      factors.push({
        key: "opp.intent.appointment",
        dimension: "intent_timing",
        points: 3,
        reason: "Appointment requested",
      });
    }
    if (input.answers.current_advisor?.includes("considering")) {
      intent = Math.min(25, intent + 2);
      factors.push({
        key: "opp.intent.advisor_switch",
        dimension: "intent_timing",
        points: 2,
        reason: "Considering alternatives to current advisor",
      });
    }
    const intent_timing = Math.min(25, intent);

    // Retirement need (max 20)
    let need = 0;
    const timing = input.answers.retirement_timing;
    if (timing === "Already retired" || timing === "Within 2 years") {
      need += 6;
      factors.push({
        key: "opp.need.near_retirement",
        dimension: "retirement_need",
        points: 6,
        reason: `Retirement timing: ${timing}`,
      });
    } else if (timing === "2–5 years") {
      need += 4;
      factors.push({
        key: "opp.need.mid_horizon",
        dimension: "retirement_need",
        points: 4,
        reason: `Retirement timing: ${timing}`,
      });
    }

    const market = input.answers.market_drop_concern;
    if (market === "Extremely concerned" || market === "Very concerned") {
      need += 4;
      factors.push({
        key: "opp.need.market_concern",
        dimension: "retirement_need",
        points: 4,
        reason: `Market concern: ${market}`,
      });
    }

    const protection = Number(input.answers.principal_protection ?? 0);
    if (protection >= 8) {
      need += 3;
      factors.push({
        key: "opp.need.protection",
        dimension: "retirement_need",
        points: 3,
        reason: "High principal protection priority",
      });
    }

    const lifetime = Number(input.answers.lifetime_income_importance ?? 0);
    if (lifetime >= 8) {
      need += 3;
      factors.push({
        key: "opp.need.lifetime_income",
        dimension: "retirement_need",
        points: 3,
        reason: "High lifetime income priority",
      });
    }

    if (input.answers.existing_guaranteed_income === "Neither") {
      need += 2;
      factors.push({
        key: "opp.need.income_gap",
        dimension: "retirement_need",
        points: 2,
        reason: "No pension / existing annuity income",
      });
    }

    const inflation = Number(input.answers.inflation_concern ?? 0);
    if (inflation >= 7) {
      need += 2;
      factors.push({
        key: "opp.need.inflation",
        dimension: "retirement_need",
        points: 2,
        reason: "Elevated inflation concern",
      });
    }
    const retirement_need = Math.min(20, need);

    // Strategy alignment (max 15)
    let align = 0;
    if (input.answers.primary_objective) {
      align += 4;
      factors.push({
        key: "opp.align.objective",
        dimension: "strategy_alignment",
        points: 4,
        reason: `Primary objective: ${input.answers.primary_objective}`,
      });
    }
    if (input.answers.employer_assets === "Former employer") {
      align += 4;
      factors.push({
        key: "opp.align.former_employer",
        dimension: "strategy_alignment",
        points: 4,
        reason: "Former employer plan assets may be movable",
      });
    }
    if (input.answers.asset_location) {
      align += 3;
      factors.push({
        key: "opp.align.location",
        dimension: "strategy_alignment",
        points: 3,
        reason: "Asset location captured",
      });
    }
    if (input.answers.liquidity_timeline) {
      align += 2;
      factors.push({
        key: "opp.align.liquidity",
        dimension: "strategy_alignment",
        points: 2,
        reason: `Liquidity horizon: ${input.answers.liquidity_timeline}`,
      });
    }
    if (input.answers.existing_annuity) {
      align += 2;
      factors.push({
        key: "opp.align.annuity_status",
        dimension: "strategy_alignment",
        points: 2,
        reason: `Annuity status: ${input.answers.existing_annuity}`,
      });
    }
    const strategy_alignment = Math.min(15, align);

    // Engagement / profile quality (max 10)
    let eng = 0;
    const completion = this.completeness.calculate(input.answers);
    if (input.assessmentCompleted || completion.profile_completion_percentage >= 80) {
      eng += 3;
      factors.push({
        key: "opp.eng.complete",
        dimension: "engagement_quality",
        points: 3,
        reason: "Assessment substantially complete",
      });
    }
    if (input.contactSubmitted) {
      eng += 3;
      factors.push({
        key: "opp.eng.contact",
        dimension: "engagement_quality",
        points: 3,
        reason: "Contact information complete",
      });
    }
    if (input.consent) {
      eng += 2;
      factors.push({
        key: "opp.eng.consent",
        dimension: "engagement_quality",
        points: 2,
        reason: "Consent recorded",
      });
    }
    if (input.fraudLow !== false && !input.duplicate) {
      eng += 2;
      factors.push({
        key: "opp.eng.clean",
        dimension: "engagement_quality",
        points: 2,
        reason: "No duplicate/fraud concerns flagged",
      });
    }
    // Completion alone must not dominate — cap engagement
    const engagement_quality = Math.min(10, eng);

    const opportunity_score = clamp(
      opportunity_size +
        intent_timing +
        retirement_need +
        strategy_alignment +
        engagement_quality,
    );

    const asset = this.assets.qualify(input.answers);
    let classification: OpportunityScoreResult["classification"] = "NURTURE";
    if (opportunity_score >= 90 && asset.meets_target_asset_threshold) {
      classification = "ELITE_OPPORTUNITY";
    } else if (opportunity_score >= 80 && asset.meets_target_asset_threshold) {
      classification = "HIGH_PRIORITY";
    } else if (opportunity_score >= 70 && asset.meets_target_asset_threshold) {
      classification = "QUALIFIED";
    } else if (opportunity_score >= 55) {
      classification = "DEVELOPING";
    } else {
      classification = "NURTURE";
    }

    // High intent alone with below-target assets cannot be Elite
    if (!asset.meets_target_asset_threshold && classification === "ELITE_OPPORTUNITY") {
      classification = "DEVELOPING";
    }
    if (!asset.meets_target_asset_threshold && classification === "HIGH_PRIORITY") {
      classification = "DEVELOPING";
    }

    const explanation = this.explain({
      opportunity_score,
      classification,
      answers: input.answers,
      assetBand: asset.repositionable_asset_band,
      meets: asset.meets_target_asset_threshold,
    });

    return {
      opportunity_score,
      opportunity_size,
      intent_timing,
      retirement_need,
      strategy_alignment,
      engagement_quality,
      classification,
      factors,
      explanation,
      score_version: "retirement-opportunity-score-v1",
    };
  }

  private explain(input: {
    opportunity_score: number;
    classification: string;
    answers: Record<string, string>;
    assetBand: string | null;
    meets: boolean;
  }): string {
    const bits: string[] = [];
    if (input.assetBand) {
      bits.push(
        `reports ${input.assetBand} potentially available to reposition`,
      );
    }
    if (input.answers.retirement_timing) {
      bits.push(`retirement timing: ${input.answers.retirement_timing}`);
    }
    if (input.answers.primary_objective) {
      bits.push(`priority: ${input.answers.primary_objective}`);
    }
    if (input.answers.decision_timeline) {
      bits.push(`decision timeline: ${input.answers.decision_timeline}`);
    }
    if (!input.meets) {
      bits.push("below the $250K repositionable target threshold");
    }
    if (!bits.length) return "Opportunity profile requires additional review.";
    return `${input.classification.replaceAll("_", " ")} (${input.opportunity_score}/100) because the prospect ${bits.join("; ")}.`;
  }
}
