import { describe, expect, it } from "vitest";
import { RetirementQualificationOrchestrator } from "@/application/retirement/RetirementQualificationOrchestrator";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";
import { AssetQualificationService } from "@/application/retirement/AssetQualificationService";
import { LeadTemperatureService } from "@/application/retirement/LeadTemperatureService";
import { RetirementOpportunityScoringService } from "@/application/retirement/RetirementOpportunityScoringService";
import { getApplicableQuestions } from "@/application/retirement/assessmentDefinition";

const orchestrator = new RetirementQualificationOrchestrator();
const completeness = new ProfileCompletenessService();
const assets = new AssetQualificationService();
const temperature = new LeadTemperatureService();
const opportunity = new RetirementOpportunityScoringService();

function baseAnswers(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    age_range: "60–64",
    state: "FL",
    employment: "Working",
    retirement_timing: "Within 2 years",
    marital_status: "Married",
    total_retirement_assets: "$1M–$1.99M",
    repositionable_assets: "$750K–$999K",
    asset_location: "401(k),IRA",
    employer_assets: "Former employer",
    existing_annuity: "None",
    liquidity_timeline: "1–3 years",
    primary_objective: "INCOME",
    income_start: "Within 1 year",
    desired_monthly_income: "$5,000–$7,500",
    lifetime_income_importance: "9",
    existing_guaranteed_income: "Neither",
    inflation_concern: "8",
    liquidity_importance: "7",
    legacy_importance: "5",
    healthcare_concern: "6",
    carrier_strength_importance: "8",
    advisor_team_importance: "7",
    current_advisor: "Yes, but I'm considering alternatives",
    advisor_improvement: "Income",
    decision_timeline: "Within 30 days",
    ...overrides,
  };
}

describe("ProfileCompletenessService — applicable questions", () => {
  it("uses applicable denominator for INCOME branch (not blind fixed 24)", () => {
    const answers = baseAnswers({ primary_objective: "INCOME" });
    const result = completeness.calculate(answers);
    const applicable = getApplicableQuestions(answers);
    expect(result.applicable_questions).toBe(applicable.length);
    expect(result.profile_completion_percentage).toBe(100);
    expect(result.answered_core_questions).toBe(result.applicable_questions);

    const growApplicable = getApplicableQuestions(
      baseAnswers({
        primary_objective: "GROW",
        principal_protection: "8",
        growth_participation: "7",
        market_drop_concern: "Very concerned",
        risk_growth_preference: "B",
      }),
    );
    // Branching changes the applicable set — do not hard-code a single 24 for every path
    expect(applicable.map((q) => q.id).sort().join(",")).not.toBe(
      growApplicable.map((q) => q.id).sort().join(","),
    );
  });

  it("branch-specific: GROW adds accumulation questions, not income-only", () => {
    const income = getApplicableQuestions(baseAnswers({ primary_objective: "INCOME" }));
    const grow = getApplicableQuestions(baseAnswers({ primary_objective: "GROW" }));
    expect(income.some((q) => q.id === "income_start")).toBe(true);
    expect(income.some((q) => q.id === "principal_protection")).toBe(false);
    expect(grow.some((q) => q.id === "principal_protection")).toBe(true);
    expect(grow.some((q) => q.id === "existing_guaranteed_income")).toBe(false);
  });

  it("scores partial profiles without requiring full completion", () => {
    const partial = completeness.calculate({
      age_range: "55–59",
      repositionable_assets: "$1M+",
      decision_timeline: "Immediately",
      primary_objective: "PROTECT",
    });
    expect(partial.profile_completion_percentage).toBeGreaterThan(0);
    expect(partial.profile_completion_percentage).toBeLessThan(50);
    expect(partial.answered_core_questions).toBeLessThan(partial.applicable_questions);
  });
});

describe("AssetQualificationService", () => {
  it("marks under $250K as BELOW_TARGET", () => {
    const q = assets.qualify({ repositionable_assets: "Under $250K" });
    expect(q.commercial_tier).toBe("BELOW_TARGET");
    expect(q.meets_target_asset_threshold).toBe(false);
    expect(q.repositionable_min_cents).toBe(0);
    expect(q.verification_status).toBe("SELF_REPORTED");
  });

  it("qualifies $250K threshold as GOLD", () => {
    const q = assets.qualify({ repositionable_assets: "$250K–$499K" });
    expect(q.commercial_tier).toBe("GOLD");
    expect(q.meets_target_asset_threshold).toBe(true);
    expect(q.repositionable_min_cents).toBe(25_000_000);
  });

  it("maps $1M+ to DIAMOND", () => {
    const q = assets.qualify({ repositionable_assets: "$1M+" });
    expect(q.commercial_tier).toBe("DIAMOND");
    expect(q.meets_target_asset_threshold).toBe(true);
  });

  it("maps $3M+ to BLACK", () => {
    const q = assets.qualify({ repositionable_assets: "$3M+" });
    expect(q.commercial_tier).toBe("BLACK");
    expect(q.repositionable_min_cents).toBe(300_000_000);
  });

  it("upgrades $1M+ to BLACK when total assets are $3M+", () => {
    const q = assets.qualify({
      repositionable_assets: "$1M+",
      total_retirement_assets: "$3M+",
    });
    expect(q.commercial_tier).toBe("BLACK");
  });

  it("stores verification separately from self-reported band", () => {
    const q = assets.qualify({ repositionable_assets: "$750K–$999K" }, "SETTER_CONFIRMED");
    expect(q.verification_status).toBe("SETTER_CONFIRMED");
    expect(q.commercial_tier).toBe("GOLD");
  });
});

describe("LeadTemperatureService", () => {
  it("maps immediate intent + assets + appointment toward READY_NOW / VERY_HOT", () => {
    const result = temperature.score({
      answers: baseAnswers({
        decision_timeline: "Immediately",
        repositionable_assets: "$1M+",
      }),
      contactComplete: true,
      consent: true,
      appointmentRequested: true,
      assessmentCompleted: true,
    });
    expect(result.temperature_score).toBeGreaterThanOrEqual(75);
    expect(["VERY_HOT", "READY_NOW"]).toContain(result.temperature);
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.temperature_version).toBe("lead-temperature-v1");
  });

  it("keeps research-only lower temperature", () => {
    const result = temperature.score({
      answers: baseAnswers({
        decision_timeline: "Just researching",
        retirement_timing: "10+ years",
        repositionable_assets: "Under $250K",
      }),
      contactComplete: false,
      consent: false,
      appointmentRequested: false,
      assessmentCompleted: false,
    });
    expect(result.temperature_score).toBeLessThan(50);
    expect(result.temperature).toBe("COLD");
  });
});

describe("Opportunity vs completion — three separate concepts", () => {
  it("complete high-value profile scores elite / high opportunity", () => {
    const result = orchestrator.evaluate({
      answers: baseAnswers({
        decision_timeline: "Immediately",
        repositionable_assets: "$1M+",
        total_retirement_assets: "$2M+",
      }),
      consent: true,
      appointmentRequested: true,
      assessmentCompleted: true,
      contactSubmitted: true,
    });
    expect(result.completeness.profile_completion_percentage).toBe(100);
    expect(result.opportunity.opportunity_score).toBeGreaterThanOrEqual(80);
    expect(result.asset.meets_target_asset_threshold).toBe(true);
    expect(result.temperature.temperature_score).toBeGreaterThan(0);
    expect(result.score_version).toBeTruthy();
    expect(result.temperature_version).toBeTruthy();
    expect(["A+", "A", "B"]).toContain(result.lead_grade);
  });

  it("high assets / low completion still outranks low assets / high completion on opportunity", () => {
    const highAssetsPartial = opportunity.score({
      answers: {
        repositionable_assets: "$1M+",
        decision_timeline: "Immediately",
        retirement_timing: "Within 2 years",
        primary_objective: "INCOME",
        employer_assets: "Former employer",
      },
      consent: true,
      appointmentRequested: true,
      assessmentCompleted: false,
      contactSubmitted: true,
    });

    const lowAssetsComplete = opportunity.score({
      answers: baseAnswers({
        repositionable_assets: "Under $250K",
        total_retirement_assets: "Under $250K",
        decision_timeline: "Just researching",
        retirement_timing: "10+ years",
        primary_objective: "GROW",
        principal_protection: "5",
        growth_participation: "5",
        market_drop_concern: "Not concerned",
        risk_growth_preference: "B",
      }),
      consent: true,
      appointmentRequested: false,
      assessmentCompleted: true,
      contactSubmitted: true,
    });

    const partialCompletion = completeness.calculate({
      repositionable_assets: "$1M+",
      decision_timeline: "Immediately",
      retirement_timing: "Within 2 years",
      primary_objective: "INCOME",
      employer_assets: "Former employer",
    });
    const fullCompletion = completeness.calculate(
      baseAnswers({
        repositionable_assets: "Under $250K",
        primary_objective: "GROW",
        principal_protection: "5",
        growth_participation: "5",
        market_drop_concern: "Not concerned",
        risk_growth_preference: "B",
      }),
    );

    expect(partialCompletion.profile_completion_percentage).toBeLessThan(
      fullCompletion.profile_completion_percentage,
    );
    expect(highAssetsPartial.opportunity_score).toBeGreaterThan(
      lowAssetsComplete.opportunity_score,
    );
  });

  it("does not treat question count as the entire opportunity score", () => {
    const completeLow = opportunity.score({
      answers: baseAnswers({
        primary_objective: "GROW",
        principal_protection: "3",
        growth_participation: "3",
        market_drop_concern: "Not concerned",
        risk_growth_preference: "A",
        repositionable_assets: "Under $250K",
        decision_timeline: "Just researching",
        retirement_timing: "10+ years",
      }),
      consent: true,
      appointmentRequested: false,
      assessmentCompleted: true,
      contactSubmitted: true,
    });
    const incompleteHigh = opportunity.score({
      answers: {
        repositionable_assets: "$3M+",
        decision_timeline: "Immediately",
        retirement_timing: "Already retired",
        primary_objective: "PROTECT",
        employer_assets: "Former employer",
      },
      consent: true,
      appointmentRequested: true,
      assessmentCompleted: false,
      contactSubmitted: true,
    });
    expect(completeLow.opportunity_score).toBeLessThan(incompleteHigh.opportunity_score);
  });
});

describe("Commercial status, grade, setter priority", () => {
  it("routes ready high-value leads to SETTER_REVIEW", () => {
    const result = orchestrator.evaluate({
      answers: baseAnswers({
        decision_timeline: "Immediately",
        repositionable_assets: "$1M+",
      }),
      consent: true,
      appointmentRequested: true,
      assessmentCompleted: true,
      contactSubmitted: true,
    });
    expect(["SETTER_REVIEW", "HIGH_VALUE", "QUALIFIED", "APPOINTMENT_READY"]).toContain(
      result.commercial_status,
    );
    expect(result.setter_priority).toBeGreaterThanOrEqual(70);
  });

  it("keeps below-target / research as NURTURE", () => {
    const result = orchestrator.evaluate({
      answers: baseAnswers({
        repositionable_assets: "Under $250K",
        decision_timeline: "Just researching",
        retirement_timing: "10+ years",
      }),
      consent: true,
      appointmentRequested: false,
      assessmentCompleted: true,
      contactSubmitted: true,
    });
    expect(result.commercial_status).toBe("NURTURE");
    expect(result.agent_eligible).toBe(false);
  });

  it("marks incomplete low-fill profiles as INCOMPLETE", () => {
    const result = orchestrator.evaluate({
      answers: { age_range: "50–54" },
      consent: false,
      appointmentRequested: false,
      assessmentCompleted: false,
      contactSubmitted: false,
    });
    expect(result.commercial_status).toBe("INCOMPLETE");
    expect(result.completeness.profile_completion_percentage).toBeLessThan(50);
  });
});
