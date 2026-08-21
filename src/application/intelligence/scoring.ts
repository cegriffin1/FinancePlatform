import {
  DEFAULT_GRADE_THRESHOLDS,
  DEFAULT_PRIORITY_WEIGHTS,
  type DimensionScore,
  type LeadGrade,
  type LeadIntelligenceProfile,
  type LeadValueBand,
  type NextBestAction,
  type QualityGateOutcome,
  type ScoreFactor,
  type FraudRiskLevel,
  type IdentityMatchResult,
  type ValidationStatus,
} from "@/domain/types/lead-intelligence";
import { PRIORITY_TO_STRATEGY } from "@/application/growth/assessmentTemplate";

export type IntelligenceScoringInput = {
  answers: Record<string, string>;
  campaignStrategy: string;
  campaignTerritories: string[];
  state: string;
  consent: boolean;
  appointmentRequested: boolean;
  assessmentCompleted: boolean;
  contactSubmitted: boolean;
  emailStatus: ValidationStatus;
  phoneStatus: ValidationStatus;
  fraudRisk: FraudRiskLevel;
  qualityGate: QualityGateOutcome;
  identityResult: IdentityMatchResult;
  createdAt: string;
  intentEvents?: Array<{ type: string; occurred_at: string }>;
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export class IntentDecayPolicy {
  decay(points: number, occurredAt: string, halfLifeDays = 30): number {
    const ageMs = Date.now() - new Date(occurredAt).getTime();
    const ageDays = ageMs / (24 * 3600_000);
    const factor = Math.pow(0.5, ageDays / halfLifeDays);
    return points * factor;
  }
}

export class LeadIntelligenceScoringService {
  private readonly decay = new IntentDecayPolicy();

  scoreFit(input: IntelligenceScoringInput): DimensionScore {
    const factors: ScoreFactor[] = [];
    let score = 0;
    factors.push({
      key: "fit.business_owner",
      dimension: "fit",
      points: 20,
      reason: "Business owner / decision-maker profile",
    });
    score += 20;

    if (["11–25", "26–50", "51–100", "100+"].includes(input.answers.team_size ?? "")) {
      factors.push({
        key: "fit.company_size",
        dimension: "fit",
        points: 15,
        reason: "Company size in target segment",
      });
      score += 15;
    }
    if (["$1M–$5M", "$5M–$10M", "$10M+"].includes(input.answers.revenue_range ?? "")) {
      factors.push({
        key: "fit.revenue",
        dimension: "fit",
        points: 20,
        reason: "Revenue within campaign target",
      });
      score += 20;
    }
    if (
      input.campaignTerritories.includes(input.state) ||
      input.campaignTerritories.includes("US")
    ) {
      factors.push({
        key: "fit.geography",
        dimension: "fit",
        points: 15,
        reason: "Target geography",
      });
      score += 15;
    }
    const strategies = PRIORITY_TO_STRATEGY[input.answers.financial_priority ?? ""] ?? [];
    if (strategies.includes(input.campaignStrategy) || strategies.length > 0) {
      factors.push({
        key: "fit.strategy",
        dimension: "fit",
        points: 20,
        reason: "Strategy match to campaign target",
      });
      score += 20;
    }
    return {
      score: clamp(score),
      factors,
      explanation: `Fit ${clamp(score)} from targeting alignment`,
    };
  }

  scoreIntent(input: IntelligenceScoringInput): DimensionScore {
    const factors: ScoreFactor[] = [];
    let score = 0;
    const now = input.createdAt;

    if (input.answers.timeline === "Immediately") {
      const pts = this.decay.decay(25, now);
      factors.push({
        key: "intent.immediate",
        dimension: "intent",
        points: pts,
        reason: "Immediate timeline",
      });
      score += pts;
    } else if (input.answers.timeline === "Within 30 days") {
      const pts = this.decay.decay(18, now);
      factors.push({
        key: "intent.30_days",
        dimension: "intent",
        points: pts,
        reason: "Within 30 days timeline",
      });
      score += pts;
    } else if (input.answers.timeline === "Within 3 months") {
      const pts = this.decay.decay(8, now);
      factors.push({
        key: "intent.3_months",
        dimension: "intent",
        points: pts,
        reason: "Within 3 months timeline",
      });
      score += pts;
    }

    if (input.appointmentRequested) {
      const pts = this.decay.decay(30, now);
      factors.push({
        key: "intent.appointment",
        dimension: "intent",
        points: pts,
        reason: "Appointment requested",
      });
      score += pts;
    }

    for (const event of input.intentEvents ?? []) {
      if (event.type === "appointment_cta_viewed") {
        score += this.decay.decay(5, event.occurred_at);
      }
    }

    return {
      score: clamp(score),
      factors,
      explanation: `Intent ${clamp(score)} with decay policy applied`,
    };
  }

  scoreEngagement(input: IntelligenceScoringInput): DimensionScore {
    const factors: ScoreFactor[] = [];
    let score = 0;
    if (input.assessmentCompleted) {
      factors.push({
        key: "eng.assessment",
        dimension: "engagement",
        points: 35,
        reason: "Assessment completed",
      });
      score += 35;
    }
    if (input.contactSubmitted) {
      factors.push({
        key: "eng.contact",
        dimension: "engagement",
        points: 25,
        reason: "Contact information submitted",
      });
      score += 25;
    }
    if (input.appointmentRequested) {
      factors.push({
        key: "eng.appointment_cta",
        dimension: "engagement",
        points: 25,
        reason: "Appointment CTA interaction",
      });
      score += 25;
    }
    return {
      score: clamp(score),
      factors,
      explanation: `Engagement ${clamp(score)} from meaningful actions`,
    };
  }

  scoreDataQuality(input: IntelligenceScoringInput): DimensionScore {
    const factors: ScoreFactor[] = [];
    let score = 40;
    if (input.consent) {
      factors.push({
        key: "dq.consent",
        dimension: "data_quality",
        points: 15,
        reason: "Consent provided",
      });
      score += 15;
    }
    if (input.emailStatus !== "INVALID") {
      factors.push({
        key: "dq.email",
        dimension: "data_quality",
        points: 15,
        reason: "Email format acceptable",
      });
      score += 15;
    }
    if (input.phoneStatus !== "INVALID") {
      factors.push({
        key: "dq.phone",
        dimension: "data_quality",
        points: 15,
        reason: "Phone format acceptable",
      });
      score += 15;
    }
    if (input.fraudRisk === "LOW") {
      factors.push({
        key: "dq.fraud_low",
        dimension: "data_quality",
        points: 10,
        reason: "Low fraud risk",
      });
      score += 10;
    } else if (input.fraudRisk === "HIGH") {
      score -= 40;
      factors.push({
        key: "dq.fraud_high",
        dimension: "data_quality",
        points: -40,
        reason: "High fraud risk",
      });
    }
    if (input.identityResult === "DUPLICATE_SUBMISSION") {
      score -= 20;
      factors.push({
        key: "dq.duplicate",
        dimension: "data_quality",
        points: -20,
        reason: "Duplicate submission",
      });
    }
    return {
      score: clamp(score),
      factors,
      explanation: `Data quality ${clamp(score)}`,
    };
  }

  scoreContactability(input: IntelligenceScoringInput): DimensionScore {
    const factors: ScoreFactor[] = [];
    let score = 20;
    if (input.emailStatus !== "INVALID") {
      factors.push({
        key: "ct.email",
        dimension: "contactability",
        points: 35,
        reason: "Reachable email present",
      });
      score += 35;
    }
    if (input.phoneStatus !== "INVALID") {
      factors.push({
        key: "ct.phone",
        dimension: "contactability",
        points: 35,
        reason: "Reachable phone present",
      });
      score += 35;
    }
    if (input.consent) {
      factors.push({
        key: "ct.consent",
        dimension: "contactability",
        points: 10,
        reason: "Consent allows outreach",
      });
      score += 10;
    }
    return {
      score: clamp(score),
      factors,
      explanation: `Contactability ${clamp(score)}`,
    };
  }
}

export class ConversionScoringService {
  score(dims: {
    fit: number;
    intent: number;
    engagement: number;
    data_quality: number;
    contactability: number;
  }): DimensionScore {
    const score = clamp(
      dims.fit * 0.25 +
        dims.intent * 0.3 +
        dims.engagement * 0.15 +
        dims.data_quality * 0.15 +
        dims.contactability * 0.15,
    );
    return {
      score,
      factors: [
        {
          key: "conversion.rule_blend",
          dimension: "conversion",
          points: score,
          reason: "Transparent rule-based estimate from score dimensions",
        },
      ],
      explanation: `Conversion ${score} (RULE_BASED_ESTIMATE)`,
    };
  }
}

export class LeadValueService {
  score(
    conversion: number,
    fit: number,
    strategyCount: number,
  ): { score: number; band: LeadValueBand; explanation: string } {
    const score = clamp(conversion * 0.5 + fit * 0.4 + strategyCount * 5);
    let band: LeadValueBand = "STANDARD";
    if (score >= 90) band = "STRATEGIC";
    else if (score >= 80) band = "PREMIUM";
    else if (score >= 65) band = "HIGH";
    else if (score < 40) band = "LOW";
    return {
      score,
      band,
      explanation: `Internal value band ${band} (not a financial promise)`,
    };
  }
}

export class LeadPriorityPolicy {
  constructor(
    private readonly weights: typeof DEFAULT_PRIORITY_WEIGHTS = DEFAULT_PRIORITY_WEIGHTS,
  ) {}

  calculate(input: {
    fit: number;
    intent: number;
    engagement: number;
    data_quality: number;
    contactability: number;
    conversion: number;
    createdAt: string;
  }): number {
    const ageHours = (Date.now() - new Date(input.createdAt).getTime()) / 3600_000;
    const recency = clamp(100 - ageHours * 2);
    return clamp(
      input.fit * this.weights.fit +
        input.intent * this.weights.intent +
        input.engagement * this.weights.engagement +
        input.data_quality * this.weights.data_quality +
        input.contactability * this.weights.contactability +
        input.conversion * this.weights.conversion +
        recency * this.weights.recency,
    );
  }
}

export function gradeFromPriority(priority: number): LeadGrade {
  for (const row of DEFAULT_GRADE_THRESHOLDS) {
    if (priority >= row.min) return row.grade;
  }
  return "REVIEW";
}

export function temperatureFromPriority(priority: number): string {
  if (priority >= 90) return "PRIORITY";
  if (priority >= 80) return "HOT";
  if (priority >= 60) return "QUALIFIED";
  if (priority >= 40) return "WARM";
  return "COLD";
}

export function buildExplanation(profile: {
  fit: number;
  intent: number;
  contactability: number;
  grade: LeadGrade;
  timeline?: string;
}): string {
  const bits: string[] = [];
  if (profile.fit >= 70) bits.push("matches your target business profile");
  if (profile.intent >= 70) bits.push("shows strong timing/intent signals");
  if (profile.contactability >= 70) bits.push("provided usable contact information");
  if (profile.timeline) bits.push(`indicated timeline: ${profile.timeline}`);
  if (!bits.length) {
    return "This lead requires review before prioritized outreach.";
  }
  return `This lead is graded ${profile.grade} because the prospect ${bits.join(", ")}.`;
}

export class NextBestActionService {
  recommend(input: {
    grade: LeadGrade;
    temperature: string;
    phoneOk: boolean;
    emailOk: boolean;
    consent: boolean;
    appointmentRequested: boolean;
    qualityGate: QualityGateOutcome;
    timeline?: string;
  }): NextBestAction {
    if (
      input.qualityGate === "REJECT" ||
      input.qualityGate === "SUSPECTED_FRAUD"
    ) {
      return "MANAGER_REVIEW";
    }
    if (input.qualityGate === "NURTURE" || input.temperature === "COLD") {
      return "NURTURE";
    }
    if (input.appointmentRequested) return "BOOK_APPOINTMENT";
    if (
      (input.grade === "A+" || input.grade === "A" || input.temperature === "PRIORITY") &&
      input.phoneOk &&
      input.consent
    ) {
      return "CALL_NOW";
    }
    if (input.emailOk && input.consent) return "SEND_EMAIL";
    if (input.timeline === "Within 6 months" || input.timeline === "Exploring options") {
      return "NURTURE";
    }
    return "WAIT";
  }
}

export function buildIntelligenceProfile(
  input: IntelligenceScoringInput,
): LeadIntelligenceProfile {
  const scoring = new LeadIntelligenceScoringService();
  const conversionSvc = new ConversionScoringService();
  const valueSvc = new LeadValueService();
  const priorityPolicy = new LeadPriorityPolicy();
  const nba = new NextBestActionService();

  const fit = scoring.scoreFit(input);
  const intent = scoring.scoreIntent(input);
  const engagement = scoring.scoreEngagement(input);
  const dataQuality = scoring.scoreDataQuality(input);
  const contactability = scoring.scoreContactability(input);
  const conversion = conversionSvc.score({
    fit: fit.score,
    intent: intent.score,
    engagement: engagement.score,
    data_quality: dataQuality.score,
    contactability: contactability.score,
  });
  const strategies =
    PRIORITY_TO_STRATEGY[input.answers.financial_priority ?? ""] ?? [
      input.campaignStrategy,
    ];
  const value = valueSvc.score(conversion.score, fit.score, strategies.length);
  const priority = priorityPolicy.calculate({
    fit: fit.score,
    intent: intent.score,
    engagement: engagement.score,
    data_quality: dataQuality.score,
    contactability: contactability.score,
    conversion: conversion.score,
    createdAt: input.createdAt,
  });

  // Contactability gate: high intent alone cannot become Priority with unusable contact
  let adjustedPriority = priority;
  if (contactability.score < 50 || dataQuality.score < 40) {
    adjustedPriority = Math.min(adjustedPriority, 59);
  }
  if (input.qualityGate === "REVIEW") {
    adjustedPriority = Math.min(adjustedPriority, 70);
  }

  const grade =
    input.qualityGate === "REVIEW" || input.qualityGate === "SUSPECTED_FRAUD"
      ? "REVIEW"
      : gradeFromPriority(adjustedPriority);
  const temperature = temperatureFromPriority(adjustedPriority);
  const recommended = nba.recommend({
    grade,
    temperature,
    phoneOk: input.phoneStatus !== "INVALID",
    emailOk: input.emailStatus !== "INVALID",
    consent: input.consent,
    appointmentRequested: input.appointmentRequested,
    qualityGate: input.qualityGate,
    timeline: input.answers.timeline,
  });

  const factors = [
    ...fit.factors,
    ...intent.factors,
    ...engagement.factors,
    ...dataQuality.factors,
    ...contactability.factors,
    ...conversion.factors,
  ];

  const explanation = buildExplanation({
    fit: fit.score,
    intent: intent.score,
    contactability: contactability.score,
    grade,
    timeline: input.answers.timeline,
  });

  return {
    fit_score: fit.score,
    intent_score: intent.score,
    engagement_score: engagement.score,
    data_quality_score: dataQuality.score,
    contactability_score: contactability.score,
    conversion_score: conversion.score,
    lead_value_score: value.score,
    overall_priority_score: adjustedPriority,
    lead_temperature: temperature,
    quality_grade: grade,
    confidence: clamp(
      (dataQuality.score + contactability.score) / 2,
    ),
    strategy_classification: strategies,
    estimated_value_band: value.band,
    recommended_action: recommended,
    score_version: "lead-intel-v1",
    model_version: "rules-v1",
    conversion_model_label: "RULE_BASED_ESTIMATE",
    scored_at: new Date().toISOString(),
    explanation,
    factors,
    quality_gate: input.qualityGate,
    fraud_risk: input.fraudRisk,
    fraud_reasons: [],
    identity_result: input.identityResult,
    validation: {
      email: input.emailStatus,
      phone: input.phoneStatus,
      domain: "NOT_VERIFIED",
      provider: "none",
      validated_at: null,
    },
  };
}
