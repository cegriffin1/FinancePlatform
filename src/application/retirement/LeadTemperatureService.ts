import {
  DEFAULT_TEMPERATURE_THRESHOLDS,
  DEFAULT_INTENT_TIMELINE_POINTS,
  type LeadTemperature,
  type ScoreFactorRecord,
  type TemperatureResult,
} from "@/domain/types/retirement-qualification";
import { AssetQualificationService } from "@/application/retirement/AssetQualificationService";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type TemperatureInput = {
  answers: Record<string, string>;
  contactComplete: boolean;
  consent: boolean;
  appointmentRequested: boolean;
  assessmentCompleted: boolean;
};

/**
 * Temperature = readiness NOW (separate from opportunity value).
 */
export class LeadTemperatureService {
  private readonly assets = new AssetQualificationService();
  private readonly completeness = new ProfileCompletenessService();

  score(input: TemperatureInput): TemperatureResult {
    const factors: ScoreFactorRecord[] = [];
    let score = 0;

    const completion = this.completeness.calculate(input.answers);
    const completionPts = Math.round(
      (completion.profile_completion_percentage / 100) * 15,
    );
    score += completionPts;
    factors.push({
      key: "temp.completion",
      dimension: "temperature",
      points: completionPts,
      reason: `Profile ${completion.profile_completion_percentage}% complete (${completion.answered_core_questions}/${completion.applicable_questions} applicable)`,
    });

    const asset = this.assets.qualify(input.answers);
    if (asset.meets_target_asset_threshold) {
      const pts = asset.commercial_tier === "BLACK" ? 20 : asset.commercial_tier === "DIAMOND" ? 18 : 15;
      score += pts;
      factors.push({
        key: "temp.assets",
        dimension: "temperature",
        points: pts,
        reason: `Meets asset threshold (${asset.commercial_tier})`,
      });
    } else if (asset.repositionable_asset_band) {
      score += 4;
      factors.push({
        key: "temp.assets_below",
        dimension: "temperature",
        points: 4,
        reason: "Assets captured but below target threshold",
      });
    }

    const intentPts =
      DEFAULT_INTENT_TIMELINE_POINTS[input.answers.decision_timeline ?? ""] ?? 0;
    // Scale intent into temperature (max 30)
    const intentTemp = Math.round((intentPts / 25) * 30);
    score += intentTemp;
    factors.push({
      key: "temp.intent",
      dimension: "temperature",
      points: intentTemp,
      reason: `Decision timeline: ${input.answers.decision_timeline ?? "unknown"}`,
    });

    const timing = input.answers.retirement_timing;
    if (timing === "Already retired" || timing === "Within 2 years") {
      score += 10;
      factors.push({
        key: "temp.retirement_near",
        dimension: "temperature",
        points: 10,
        reason: `Near-term retirement: ${timing}`,
      });
    } else if (timing === "2–5 years") {
      score += 5;
      factors.push({
        key: "temp.retirement_mid",
        dimension: "temperature",
        points: 5,
        reason: `Retirement horizon: ${timing}`,
      });
    }

    if (input.contactComplete && input.consent) {
      score += 10;
      factors.push({
        key: "temp.contact",
        dimension: "temperature",
        points: 10,
        reason: "Contact complete with consent",
      });
    } else if (input.contactComplete) {
      score += 4;
      factors.push({
        key: "temp.contact_partial",
        dimension: "temperature",
        points: 4,
        reason: "Contact present without full consent signal",
      });
    }

    if (input.appointmentRequested) {
      score += 12;
      factors.push({
        key: "temp.appointment",
        dimension: "temperature",
        points: 12,
        reason: "Appointment requested",
      });
    }

    if (input.answers.primary_objective) {
      score += 5;
      factors.push({
        key: "temp.objective",
        dimension: "temperature",
        points: 5,
        reason: `Primary need: ${input.answers.primary_objective}`,
      });
    }

    if (input.assessmentCompleted) {
      score += 3;
      factors.push({
        key: "temp.engagement",
        dimension: "temperature",
        points: 3,
        reason: "Assessment completed",
      });
    }

    const temperature_score = clamp(score);
    const temperature = this.mapTemperature(temperature_score);

    return {
      temperature,
      temperature_score,
      factors,
      temperature_version: "lead-temperature-v1",
    };
  }

  mapTemperature(
    score: number,
    thresholds = DEFAULT_TEMPERATURE_THRESHOLDS,
  ): LeadTemperature {
    const sorted = [...thresholds].sort((a, b) => b.min - a.min);
    return sorted.find((t) => score >= t.min)?.key ?? "COLD";
  }
}
