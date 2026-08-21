"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import { actionLabel } from "@/application/intelligence/lifecycle";
import { cn } from "@/lib/cn";

export default function LeadCommandCenterPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [strategy, setStrategy] = useState("all");

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => setLeads(json.leads ?? []));
  }, []);

  const filtered = useMemo(() => {
    return leads
      .filter((l) => {
        if (grade !== "all" && l.intelligence?.quality_grade !== grade) return false;
        if (
          strategy !== "all" &&
          !(l.intelligence?.strategy_classification ?? []).includes(strategy)
        ) {
          return false;
        }
        const q = query.toLowerCase();
        if (!q) return true;
        return (
          l.first_name.toLowerCase().includes(q) ||
          l.last_name.toLowerCase().includes(q) ||
          l.business_name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.phone.includes(q)
        );
      })
      .sort(
        (a, b) =>
          (b.intelligence?.overall_priority_score ?? b.score) -
          (a.intelligence?.overall_priority_score ?? a.score),
      );
  }, [leads, query, grade, strategy]);

  const priority = filtered.filter(
    (l) =>
      l.intelligence?.quality_grade === "A+" ||
      l.temperature_key === "PRIORITY",
  );
  const hot = filtered.filter((l) => l.temperature_key === "HOT");
  const slaRisk = filtered.filter((l) => l.sla?.sla_status === "breached");
  const needsAttention = filtered.filter(
    (l) =>
      l.status === "review" ||
      l.intelligence?.recommended_action === "MANAGER_REVIEW",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Lead Command Center
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          ALTUS analyzed what matters. Here is who to contact and why.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Priority", priority.length],
          ["Hot", hot.length],
          ["Needs Attention", needsAttention.length],
          ["SLA Risk", slaRisk.length],
          ["All Visible", filtered.length],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">{value as number}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label as string}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm"
          placeholder="Search name, company, email, phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        >
          <option value="all">All grades</option>
          {["A+", "A", "B", "C", "D", "REVIEW"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          className="rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
        >
          <option value="all">All strategies</option>
          {[
            "Business Growth",
            "Tax Strategy",
            "Succession",
            "Key Employee Strategy",
            "Protection",
            "Retirement",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-8 text-sm text-[var(--altus-text-secondary)]">
          No leads yet. Launch a campaign or generate a test lead.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lead) => {
            const intel = lead.intelligence;
            return (
              <Link
                key={lead.id}
                href={`/app/leads/${lead.id}`}
                className="block rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--altus-shadow-hover)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          intel?.quality_grade === "A+" || intel?.quality_grade === "A"
                            ? "bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                            : "bg-[var(--altus-section)] text-[var(--altus-text-secondary)]",
                        )}
                      >
                        {intel?.quality_grade ?? "—"} {lead.temperature_key}
                      </span>
                      <span className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                        {lead.attribution.ad_provider ?? lead.attribution.source ?? "Campaign"}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-[var(--altus-text)]">
                      {lead.first_name} {lead.last_name}
                    </h2>
                    <p className="text-sm text-[var(--altus-text-secondary)]">
                      {lead.business_name} · {lead.state}
                    </p>
                    <p className="mt-2 text-sm text-[var(--altus-text)]">
                      {(intel?.strategy_classification ?? []).join(" · ") ||
                        lead.classifications[0]?.strategy_category}
                    </p>
                    <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
                      Timeline: {lead.assessment_answers.timeline ?? "—"}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[var(--altus-blue)]">
                      Recommended:{" "}
                      {intel
                        ? actionLabel(intel.recommended_action)
                        : "Open lead"}
                    </p>
                  </div>
                  <div className="min-w-[140px] text-right">
                    <div className="text-3xl font-bold text-[var(--altus-blue)]">
                      {intel?.overall_priority_score ?? lead.score}
                    </div>
                    <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                      Priority
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[var(--altus-text-secondary)]">
                      <div>Fit {intel?.fit_score ?? lead.fit_score}</div>
                      <div>Intent {intel?.intent_score ?? lead.intent_score}</div>
                      <div>
                        Contactability {intel?.contactability_score ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
