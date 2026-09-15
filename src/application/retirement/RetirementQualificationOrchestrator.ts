import type {
  CommercialLeadStatus,
  LeadGrade,
  LeadQualificationProfile,
  OpportunityScoreResult,
  TemperatureResult,
  AssetQualification,
  ProfileCompleteness,
} from "@/domain/types/retirement-qualification";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";
import { AssetQualificationService } from "@/application/retirement/AssetQualificationService";
import { RetirementOpportunityScoringService } from "@/application/retirement/RetirementOpportunityScoringService";
import { LeadTemperatureService } from "@/application/retirement/LeadTemperatureService";

export type QualificationInput = {
  answers: Record<string, string>;
  consent: boolean;
  appointmentRequested: boolean;
  assessmentCompleted: boolean;
  contactSubmitted: boolean;
  fraudLow?: boolean;
  duplicate?: boolean;
  assigned?: boolean;
  setterVerified?: boolean;
};

export class CommercialLeadStatusService {
  resolve(input: {
    completeness: ProfileCompleteness;
    asset: AssetQualification;
    opportunity: OpportunityScoreResult;
    temperature: TemperatureResult;
    appointmentRequested: boolean;
    assigned: boolean;
    setterVerified: boolean;
    disqualified?: boolean;
  }): CommercialLeadStatus {
    if (input.disqualified) return "DISQUALIFIED";
    if (input.assigned) return "ASSIGNED";
    if (input.setterVerified && input.appointmentRequested) return "APPOINTMENT_READY";
    if (input.setterVerified) return "SETTER_VERIFIED";

    if (input.completeness.profile_completion_percentage < 50) {
      return "INCOMPLETE";
    }

    if (
      input.temperature.temperature === "READY_NOW" ||
      input.temperature.temperature === "VERY_HOT"
    ) {
      if (input.asset.meets_target_asset_threshold) return "SETTER_REVIEW";
    }

    if (
      input.opportunity.classification === "ELITE_OPPORTUNITY" ||
      input.opportunity.classification === "HIGH_PRIORITY"
    ) {
      return "HIGH_VALUE";
    }

    if (
      input.asset.meets_target_asset_threshold &&
      input.opportunity.opportunity_score >= 70
    ) {
      return "QUALIFIED";
    }

    if (
      !input.asset.meets_target_asset_threshold ||
      input.opportunity.classification === "NURTURE" ||
      input.temperature.temperature === "COLD"
    ) {
      return "NURTURE";
    }

    return "QUALIFIED";
  }
}

export class RetirementQualificationOrchestrator {
  private readonly completeness = new ProfileCompletenessService();
  private readonly assets = new AssetQualificationService();
  private readonly opportunity = new RetirementOpportunityScoringService();
  private readonly temperature = new LeadTemperatureService();
  private readonly commercial = new CommercialLeadStatusService();

  evaluate(input: QualificationInput): LeadQualificationProfile {
    const completeness = this.completeness.calculate(input.answers);
    const asset = this.assets.qualify(
      input.answers,
      input.setterVerified ? "SETTER_VERIFIED" : "SELF_REPORTED",
    );
    const opportunity = this.opportunity.score({
      answers: input.answers,
      consent: input.consent,
      appointmentRequested: input.appointmentRequested,
      assessmentCompleted: input.assessmentCompleted,
      contactSubmitted: input.contactSubmitted,
      fraudLow: input.fraudLow,
      duplicate: input.duplicate,
    });
    const temperature = this.temperature.score({
      answers: input.answers,
      contactComplete: input.contactSubmitted,
      consent: input.consent,
      appointmentRequested: input.appointmentRequested,
      assessmentCompleted: input.assessmentCompleted,
    });

    const commercial_status = this.commercial.resolve({
      completeness,
      asset,
      opportunity,
      temperature,
      appointmentRequested: input.appointmentRequested,
      assigned: Boolean(input.assigned),
      setterVerified: Boolean(input.setterVerified),
    });

    const setter_priority = this.setterPriority(temperature.temperature, opportunity.opportunity_score);
    const lead_grade = this.leadGrade(opportunity, asset);
    const agent_eligible = this.agentEligible(commercial_status, asset, opportunity);
    const intent_label = input.answers.decision_timeline ?? "Unknown";

    return {
      completeness,
      asset,
      opportunity,
      temperature,
      commercial_status,
      intent_label,
      lead_grade,
      agent_eligible,
      setter_priority,
      recommended_next_step: this.nextStep(commercial_status, temperature.temperature),
      scored_at: new Date().toISOString(),
      score_version: opportunity.score_version,
      temperature_version: temperature.temperature_version,
    };
  }

  private leadGrade(
    opportunity: OpportunityScoreResult,
    asset: AssetQualification,
  ): LeadGrade {
    const score = opportunity.opportunity_score;
    if (score >= 90 && asset.meets_target_asset_threshold) return "A+";
    if (score >= 80 && asset.meets_target_asset_threshold) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    return "D";
  }

  private agentEligible(
    status: CommercialLeadStatus,
    asset: AssetQualification,
    opportunity: OpportunityScoreResult,
  ): boolean {
    if (status === "DISQUALIFIED" || status === "INCOMPLETE" || status === "NURTURE") {
      return false;
    }
    if (status === "ASSIGNED" || status === "APPOINTMENT_READY" || status === "SETTER_VERIFIED") {
      return true;
    }
    return (
      asset.meets_target_asset_threshold &&
      opportunity.opportunity_score >= 70 &&
      (status === "QUALIFIED" || status === "HIGH_VALUE" || status === "SETTER_REVIEW")
    );
  }

  private setterPriority(
    temperature: TemperatureResult["temperature"],
    opportunityScore: number,
  ): number {
    const base =
      temperature === "READY_NOW"
        ? 100
        : temperature === "VERY_HOT"
          ? 85
          : temperature === "HOT"
            ? 70
            : temperature === "WARM"
              ? 50
              : 20;
    return Math.min(100, base + Math.round(opportunityScore * 0.05));
  }

  private nextStep(
    status: CommercialLeadStatus,
    temperature: TemperatureResult["temperature"],
  ): string {
    switch (status) {
      case "SETTER_REVIEW":
      case "HIGH_VALUE":
        return "Setter Verification";
      case "SETTER_VERIFIED":
        return "Schedule advisor conversation";
      case "APPOINTMENT_READY":
        return "Confirm appointment";
      case "ASSIGNED":
        return "Advisor follow-up";
      case "NURTURE":
        return "Nurture journey";
      case "INCOMPLETE":
        return "Complete profile / re-engage";
      case "DISQUALIFIED":
        return "No action";
      default:
        return temperature === "HOT" || temperature === "VERY_HOT"
          ? "Setter Verification"
          : "Review and qualify";
    }
  }
}
