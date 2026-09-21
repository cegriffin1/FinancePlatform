import {
  ASSESSMENT_STAGE_LABELS,
  type AssessmentQuestionDef,
  type AssessmentStageKey,
  getApplicableQuestions,
  RETIREMENT_OPPORTUNITY_V1,
} from "@/application/retirement/assessmentDefinition";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";

export type OrderedRetirementQuestion = AssessmentQuestionDef & {
  stage_label: string;
  prompt: string;
  display_options: Array<{ value: string; label: string }>;
};

const STAGE_ORDER: AssessmentStageKey[] = [
  "ABOUT_YOU",
  "YOUR_MONEY",
  "YOUR_GOAL",
  "DYNAMIC_BRANCH",
  "YOUR_PRIORITIES",
  "YOUR_PLAN",
];

/**
 * Progressive retirement assessment engine — driven by RETIREMENT_OPPORTUNITY_V1 config.
 * Does not hardcode question copy in the UI layer.
 */
export class RetirementAssessmentEngine {
  readonly definition = RETIREMENT_OPPORTUNITY_V1;

  getOrderedQuestions(answers: Record<string, string>): OrderedRetirementQuestion[] {
    return getApplicableQuestions(answers).map((q) => ({
      ...q,
      option_labels: q.option_labels as Record<string, string> | undefined,
      stage_label: ASSESSMENT_STAGE_LABELS[q.stage],
      prompt: q.label,
      display_options: (q.options ?? []).map((value) => ({
        value,
        label: (q.option_labels as Record<string, string> | undefined)?.[value] ?? value,
      })),
    }));
  }

  nextQuestion(answers: Record<string, string>) {
    return this.getOrderedQuestions(answers).find((q) => {
      const v = answers[q.id];
      return v == null || String(v).trim() === "";
    }) ?? null;
  }

  stageProgress(answers: Record<string, string>): {
    stage: AssessmentStageKey | "CONTACT" | "INTRO";
    stage_label: string;
    percent: number;
    completed_stages: AssessmentStageKey[];
  } {
    const next = this.nextQuestion(answers);
    if (!next) {
      return {
        stage: "CONTACT",
        stage_label: ASSESSMENT_STAGE_LABELS.CONTACT,
        percent: 90,
        completed_stages: STAGE_ORDER.filter((s) => this.isStageComplete(s, answers)),
      };
    }

    const completed = STAGE_ORDER.filter((s) => this.isStageComplete(s, answers));
    const stageIndex = Math.max(0, STAGE_ORDER.indexOf(next.stage));
    const percent = Math.min(
      88,
      Math.round(((completed.length + 0.35) / STAGE_ORDER.length) * 88),
    );

    return {
      stage: next.stage,
      stage_label: ASSESSMENT_STAGE_LABELS[next.stage],
      percent: Math.max(8, percent + stageIndex),
      completed_stages: completed,
    };
  }

  isStageComplete(stage: AssessmentStageKey, answers: Record<string, string>) {
    const applicable = getApplicableQuestions(answers).filter((q) => q.stage === stage);
    if (applicable.length === 0) return false;
    return applicable.every((q) => {
      if (!q.required) return true;
      const v = answers[q.id];
      return v != null && String(v).trim() !== "";
    });
  }

  completeness(answers: Record<string, string>) {
    return new ProfileCompletenessService().calculate(answers);
  }

  /** Consumer-safe profile summary — never includes scores/grades/tiers. */
  consumerProfile(answers: Record<string, string>) {
    const objective = answers.primary_objective;
    const labels = RETIREMENT_OPPORTUNITY_V1.questions.find(
      (q) => q.id === "primary_objective",
    )?.option_labels as Record<string, string> | undefined;
    const objectiveLabel =
      (objective && labels?.[objective]) || objective || null;

    return {
      primary_goal: objectiveLabel,
      retirement_timeline: answers.retirement_timing ?? null,
      important_priorities: [
        answers.inflation_concern ? `Inflation concern: ${answers.inflation_concern}/10` : null,
        answers.liquidity_importance
          ? `Liquidity importance: ${answers.liquidity_importance}/10`
          : null,
        answers.legacy_importance ? `Legacy: ${answers.legacy_importance}/10` : null,
        answers.healthcare_concern ? `Healthcare/LTC: ${answers.healthcare_concern}/10` : null,
      ].filter(Boolean) as string[],
      planning_horizon: answers.decision_timeline ?? null,
      repositionable_band: answers.repositionable_assets ?? null,
    };
  }
}
