import type { AssessmentQuestionMeta } from "@/domain/types/lead-intelligence";
import { BUSINESS_GROWTH_ASSESSMENT_V1 } from "@/application/growth/assessmentTemplate";

export const ASSESSMENT_QUESTION_META: AssessmentQuestionMeta[] = [
  {
    question_id: "business_stage",
    qualification_dimension: "fit",
    information_gain_weight: 0.7,
    required: true,
    scoring_effect: "fit.stage",
  },
  {
    question_id: "financial_priority",
    qualification_dimension: "strategy",
    information_gain_weight: 1,
    required: true,
    scoring_effect: "fit.strategy",
    strategy_effect: "primary_strategy",
  },
  {
    question_id: "team_size",
    qualification_dimension: "fit",
    information_gain_weight: 0.8,
    required: true,
    scoring_effect: "fit.company_size",
  },
  {
    question_id: "revenue_range",
    qualification_dimension: "fit",
    information_gain_weight: 0.9,
    required: true,
    scoring_effect: "fit.revenue",
  },
  {
    question_id: "timeline",
    qualification_dimension: "intent",
    information_gain_weight: 1,
    required: true,
    scoring_effect: "intent.timeline",
  },
  {
    question_id: "transition_timeframe",
    qualification_dimension: "intent",
    information_gain_weight: 0.85,
    required: false,
    conditional_rule: {
      when_key: "financial_priority",
      when_values: ["Prepare for succession"],
    },
    scoring_effect: "intent.succession",
    strategy_effect: "Succession",
  },
];

const EXTRA_QUESTIONS: Record<string, { prompt: string; options: string[] }> = {
  transition_timeframe: {
    prompt: "What is your approximate transition timeframe?",
    options: ["Within 12 months", "1–3 years", "3–5 years", "Exploring only"],
  },
};

export class AssessmentDecisionEngine {
  getOrderedQuestions(answers: Record<string, string>) {
    const base = BUSINESS_GROWTH_ASSESSMENT_V1.questions;
    const ordered: Array<{
      key: string;
      prompt: string;
      options: string[];
      meta: AssessmentQuestionMeta;
    }> = [];

    for (const meta of ASSESSMENT_QUESTION_META) {
      const fromBase = base.find((q) => q.key === meta.question_id);
      if (fromBase) {
        ordered.push({ ...fromBase, meta });
        continue;
      }

      if (!meta.conditional_rule) continue;
      const value = answers[meta.conditional_rule.when_key];
      if (!value || !meta.conditional_rule.when_values.includes(value)) continue;
      const extra = EXTRA_QUESTIONS[meta.question_id];
      if (!extra) continue;
      ordered.push({
        key: meta.question_id,
        prompt: extra.prompt,
        options: extra.options,
        meta,
      });
    }

    return ordered;
  }

  nextQuestion(answers: Record<string, string>) {
    return this.getOrderedQuestions(answers).find((q) => !answers[q.key]) ?? null;
  }
}
