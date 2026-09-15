import type { SimLead } from "@/application/growth/simulationStore";

/** Pure pre-call brief — safe for client and server. */
export function buildPreCallBrief(lead: {
  first_name?: string;
  last_name?: string;
  state: string;
  assessment_answers: Record<string, string>;
}): string {
  const a = lead.assessment_answers;
  const lines = [
    [a.age_range, lead.state || a.state].filter(Boolean).join(" • "),
    a.retirement_timing
      ? `Retiring ${a.retirement_timing === "Within 2 years" ? "<2 years" : a.retirement_timing}`
      : null,
    a.repositionable_assets
      ? `${a.repositionable_assets} potentially repositionable`
      : null,
    a.employer_assets === "Former employer"
      ? "Former employer 401(k)"
      : a.asset_location
        ? a.asset_location
        : null,
    [a.primary_objective, a.advisor_improvement].filter(Boolean).join(" + ") || null,
    a.decision_timeline ? `Decision: ${a.decision_timeline}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export type { SimLead };
