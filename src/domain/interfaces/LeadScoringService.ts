import type { Lead } from "@/domain/types";

export type LeadScoreResult = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  reasons: string[];
};

export interface LeadScoringService {
  score(lead: Lead, context?: Record<string, unknown>): Promise<LeadScoreResult>;
}
