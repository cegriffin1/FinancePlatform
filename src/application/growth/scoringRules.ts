import type { LeadScoreFactor } from "@/domain/types/campaign-engine";
import { DEFAULT_SCORE_TEMPERATURE_BANDS } from "@/domain/types/campaign-engine";

export type ScoringRuleDefinition = {
  key: string;
  category: "fit" | "intent" | "engagement";
  points: number;
  reason: string;
  when: (answers: Record<string, string>, flags: ScoringFlags) => boolean;
};

export type ScoringFlags = {
  assessmentCompleted: boolean;
  contactSubmitted: boolean;
  appointmentRequested: boolean;
};

/** Configurable scoring rules — not UI hard-codes. */
export const DEFAULT_SCORING_RULES: ScoringRuleDefinition[] = [
  {
    key: "fit.decision_maker",
    category: "fit",
    points: 15,
    reason: "Business owner / decision-maker profile",
    when: () => true,
  },
  {
    key: "fit.company_size_target",
    category: "fit",
    points: 10,
    reason: "Company size in target segment",
    when: (a) => ["11–25", "26–50", "51–100", "100+"].includes(a.team_size ?? ""),
  },
  {
    key: "fit.revenue_target",
    category: "fit",
    points: 15,
    reason: "Revenue within campaign target",
    when: (a) =>
      ["$1M–$5M", "$5M–$10M", "$10M+"].includes(a.revenue_range ?? ""),
  },
  {
    key: "fit.high_value_strategy",
    category: "fit",
    points: 10,
    reason: "High-value strategy selected",
    when: (a) =>
      [
        "Reduce tax exposure",
        "Retain key employees",
        "Prepare for succession",
        "Grow business value",
      ].includes(a.financial_priority ?? ""),
  },
  {
    key: "engagement.assessment_completed",
    category: "engagement",
    points: 10,
    reason: "Assessment completed",
    when: (_a, f) => f.assessmentCompleted,
  },
  {
    key: "engagement.contact_completed",
    category: "engagement",
    points: 10,
    reason: "Contact information completed",
    when: (_a, f) => f.contactSubmitted,
  },
  {
    key: "intent.immediate",
    category: "intent",
    points: 15,
    reason: "Immediate timeline",
    when: (a) => a.timeline === "Immediately",
  },
  {
    key: "intent.within_30_days",
    category: "intent",
    points: 10,
    reason: "Within 30 days timeline",
    when: (a) => a.timeline === "Within 30 days",
  },
  {
    key: "intent.appointment_requested",
    category: "intent",
    points: 15,
    reason: "Appointment requested",
    when: (_a, f) => f.appointmentRequested,
  },
];

export function applyScoringRules(
  answers: Record<string, string>,
  flags: ScoringFlags,
  rules: ScoringRuleDefinition[] = DEFAULT_SCORING_RULES,
) {
  const factors: LeadScoreFactor[] = [];
  let fit = 0;
  let intent = 0;
  let engagement = 0;

  for (const rule of rules) {
    if (!rule.when(answers, flags)) continue;
    factors.push({
      key: rule.key,
      category: rule.category,
      points: rule.points,
      reason: rule.reason,
    });
    if (rule.category === "fit") fit += rule.points;
    if (rule.category === "intent") intent += rule.points;
    if (rule.category === "engagement") engagement += rule.points;
  }

  const total = Math.min(100, fit + intent + engagement);
  const bands = [...DEFAULT_SCORE_TEMPERATURE_BANDS].sort(
    (a, b) => b.min_score - a.min_score,
  );
  const temperature =
    bands.find((b) => total >= b.min_score)?.key ?? "COLD";

  return {
    total,
    fit,
    intent,
    engagement,
    temperature,
    factors,
    scoringVersion: "vertical-slice-v1",
    explanation: `Fit ${fit} + Intent ${intent} + Engagement ${engagement} = ${total} (${temperature})`,
  };
}
