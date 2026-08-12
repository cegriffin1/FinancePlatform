import type { LeadScoringService } from "@/domain/interfaces/LeadScoringService";
import type { Lead } from "@/domain/types";

/** Stub scorer — replace with rules/ML without changing callers. */
export class StubLeadScoringService implements LeadScoringService {
  async score(lead: Lead) {
    const score = lead.score ?? 50;
    const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
    return {
      score,
      grade: grade as "A" | "B" | "C" | "D",
      reasons: ["stub-scoring"],
    };
  }
}
