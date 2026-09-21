import type { SimLead } from "@/application/growth/simulationStore";

/**
 * Deterministic pre-call brief from prospect responses.
 * Never invents product recommendations or financial advice.
 */
export class PreCallBriefService {
  build(lead: {
    first_name?: string;
    last_name?: string;
    state: string;
    assessment_answers: Record<string, string>;
  }): string {
    const a = lead.assessment_answers;
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Prospect";
    const paragraphs: string[] = [];

    const who = [
      name,
      a.retirement_timing
        ? `is approaching retirement (${a.retirement_timing})`
        : null,
      a.repositionable_assets
        ? `and reports ${a.repositionable_assets} potentially available to reposition`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    if (who) paragraphs.push(who + ".");

    if (a.primary_objective) {
      paragraphs.push(
        `Primary goal: ${goalLabel(a.primary_objective)}${
          a.lifetime_income_importance || a.liquidity_importance
            ? " based on their stated priorities."
            : "."
        }`,
      );
    }

    const ratings: string[] = [];
    if (a.lifetime_income_importance) {
      ratings.push(`lifetime income ${a.lifetime_income_importance}/10`);
    }
    if (a.liquidity_importance) {
      ratings.push(`liquidity ${a.liquidity_importance}/10`);
    }
    if (a.inflation_concern) {
      ratings.push(`inflation concern ${a.inflation_concern}/10`);
    }
    if (ratings.length) {
      paragraphs.push(`They rated ${ratings.join(", ")}.`);
    }

    if (a.existing_guaranteed_income) {
      paragraphs.push(
        `Guaranteed income context: ${a.existing_guaranteed_income}.`,
      );
    }
    if (a.decision_timeline) {
      paragraphs.push(`Decision timeline: ${a.decision_timeline}.`);
    }

    paragraphs.push(
      [
        "Recommended conversation topics:",
        "Retirement income objectives",
        "Principal protection priorities",
        "Liquidity requirements",
        "Existing account structure",
      ].join("\n"),
    );

    paragraphs.push(
      "This summary reflects the prospect's own responses — not individualized financial advice.",
    );

    return paragraphs.join("\n\n");
  }

  /** Compact line-style brief for cards */
  compact(lead: {
    state: string;
    assessment_answers: Record<string, string>;
  }): string {
    const a = lead.assessment_answers;
    return [
      [a.age_range, lead.state || a.state].filter(Boolean).join(" • "),
      a.retirement_timing
        ? `Retiring ${a.retirement_timing === "Within 2 years" ? "<2 years" : a.retirement_timing}`
        : null,
      a.repositionable_assets
        ? `${a.repositionable_assets} potentially repositionable`
        : null,
      a.primary_objective ? goalLabel(a.primary_objective) : null,
      a.decision_timeline ? `Decision: ${a.decision_timeline}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
}

function goalLabel(raw: string) {
  const map: Record<string, string> = {
    INCOME: "creating retirement income",
    GROW: "growth with protection awareness",
    PROTECT: "protecting principal",
    BALANCE: "balancing income and growth",
    LEGACY: "legacy / transfer goals",
  };
  return map[raw] ?? raw;
}

/** Backward-compatible helper used across client/server */
export function buildPreCallBrief(lead: {
  first_name?: string;
  last_name?: string;
  state: string;
  assessment_answers: Record<string, string>;
}): string {
  return new PreCallBriefService().build(lead);
}

export type { SimLead };
