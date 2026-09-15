import { getApplicableQuestions } from "@/application/retirement/assessmentDefinition";
import type { ProfileCompleteness } from "@/domain/types/retirement-qualification";

export class ProfileCompletenessService {
  calculate(answers: Record<string, string>): ProfileCompleteness {
    const applicable = getApplicableQuestions(answers);
    const answered_keys = applicable
      .map((q) => q.id)
      .filter((id) => {
        const v = answers[id];
        return v != null && String(v).trim() !== "";
      });
    const missing_keys = applicable
      .map((q) => q.id)
      .filter((id) => !answered_keys.includes(id));

    const applicable_questions = applicable.length;
    const answered_core_questions = answered_keys.length;
    const profile_completion_percentage =
      applicable_questions === 0
        ? 0
        : Math.round((answered_core_questions / applicable_questions) * 100);

    return {
      answered_core_questions,
      applicable_questions,
      profile_completion_percentage,
      answered_keys,
      missing_keys,
    };
  }
}
