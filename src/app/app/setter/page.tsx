"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { key: "READY_NOW", label: "READY NOW" },
  { key: "VERY_HOT", label: "VERY HOT" },
  { key: "HOT", label: "HOT" },
  { key: "NEEDS_REVIEW", label: "NEEDS REVIEW" },
] as const;

function sectionFor(lead: SimLead): (typeof SECTIONS)[number]["key"] {
  const temp = lead.qualification?.temperature.temperature ?? lead.temperature_key;
  if (temp === "READY_NOW") return "READY_NOW";
  if (temp === "VERY_HOT") return "VERY_HOT";
  if (temp === "HOT") return "HOT";
  if (
    lead.qualification?.commercial_status === "SETTER_REVIEW" ||
    lead.qualification?.commercial_status === "INCOMPLETE" ||
    lead.status === "review"
  ) {
    return "NEEDS_REVIEW";
  }
  return "NEEDS_REVIEW";
}

function ageFromAnswers(answers: Record<string, string>) {
  return answers.age_range ?? "—";
}

function timeSince(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function SetterQueuePage() {
  const [leads, setLeads] = useState<SimLead[]>([]);

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => setLeads(json.leads ?? []));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, SimLead[]> = {
      READY_NOW: [],
      VERY_HOT: [],
      HOT: [],
      NEEDS_REVIEW: [],
    };
    const sorted = [...leads].sort(
      (a, b) =>
        (b.qualification?.setter_priority ?? b.score) -
        (a.qualification?.setter_priority ?? a.score),
    );
    for (const lead of sorted) {
      // Show retirement-qualified or high-temp leads in setter queue
      if (!lead.qualification && lead.score < 65) continue;
      map[sectionFor(lead)]!.push(lead);
    }
    return map;
  }, [leads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Setter Queue
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Verify high-intent retirement opportunities before advisor assignment.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.key} className="space-y-3">
          <h2 className="text-sm font-bold tracking-[0.12em] text-[var(--altus-blue)]">
            {section.label}
            <span className="ml-2 text-[var(--altus-text-secondary)]">
              ({grouped[section.key]?.length ?? 0})
            </span>
          </h2>
          {(grouped[section.key] ?? []).length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[var(--altus-border)] bg-white p-4 text-sm text-[var(--altus-text-secondary)]">
              No leads in this queue.
            </p>
          ) : (
            <div className="grid gap-3">
              {(grouped[section.key] ?? []).map((lead) => {
                const q = lead.qualification;
                return (
                  <article
                    key={lead.id}
                    className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
                            {q?.temperature.temperature ?? lead.temperature_key}
                          </span>
                          {q?.asset.commercial_tier ? (
                            <span className="rounded-full border border-[var(--altus-border)] px-2 py-0.5 text-[10px] font-bold uppercase">
                              {q.asset.commercial_tier}
                            </span>
                          ) : null}
                          <span className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                            {lead.attribution.ad_provider ??
                              lead.attribution.source ??
                              "Campaign"}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-bold text-[var(--altus-text)]">
                          {lead.first_name} {lead.last_name}
                        </h3>
                        <p className="text-sm text-[var(--altus-text-secondary)]">
                          {lead.state} · Age {ageFromAnswers(lead.assessment_answers)} ·{" "}
                          {timeSince(lead.created_at)}
                        </p>
                        <p className="mt-2 text-sm">
                          {q?.asset.repositionable_asset_band ?? "Assets —"} ·{" "}
                          {lead.assessment_answers.primary_objective ?? "Objective —"} ·{" "}
                          {lead.assessment_answers.decision_timeline ??
                            lead.assessment_answers.timeline ??
                            "Timeline —"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
                          Profile{" "}
                          {q?.completeness.answered_core_questions ?? "—"}/
                          {q?.completeness.applicable_questions ?? "—"} ·{" "}
                          {q?.asset.verification_status ?? "SELF_REPORTED"} ·{" "}
                          {q?.commercial_status ?? lead.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[var(--altus-blue)]">
                          {q?.opportunity.opportunity_score ?? lead.score}
                        </div>
                        <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                          Opportunity
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {q?.temperature.temperature_score ?? "—"}°
                        </div>
                        <Link
                          href={`/app/leads/${lead.id}`}
                          className={cn(
                            "mt-3 inline-flex rounded-md bg-[var(--altus-blue)] px-3 py-1.5 text-xs font-semibold text-white",
                          )}
                        >
                          Verify Lead
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
