"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import { cn } from "@/lib/cn";

type HomePayload = {
  home: {
    greeting: string;
    metrics: {
      new_opportunities: number;
      appointments_today: number;
      pipeline_value_cents: number;
      hot_leads: number;
      follow_ups: number;
      sla_risk: number;
    };
    buckets: Record<string, SimLead[]>;
    priority_opportunities: SimLead[];
  };
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const BUCKET_LABELS: Record<string, string> = {
  new_opportunities: "New Opportunities",
  appointments_today: "Appointments Today",
  ready_now: "Ready Now",
  needs_follow_up: "Needs Follow-Up",
  callbacks: "Callbacks",
  nurture: "Nurture",
  aged_leads: "Aged Leads",
};

export default function AgentHomePage() {
  const [data, setData] = useState<HomePayload["home"] | null>(null);

  useEffect(() => {
    void fetch("/api/crm")
      .then((r) => r.json())
      .then((json: HomePayload) => setData(json.home));
  }, []);

  if (!data) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading workspace…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[16px] border border-[var(--altus-border)] bg-[linear-gradient(135deg,#003d75,#0074C8_55%,#4ea3e0)] px-5 py-6 text-white shadow-[var(--altus-shadow)] sm:px-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-white/75">
          ALTUS AGENT WORKSPACE
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          {data.greeting}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/85">
          Sell and service retirement opportunities — prioritized by ALTUS intelligence.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["New Opportunities", data.metrics.new_opportunities],
          ["Appointments Today", data.metrics.appointments_today],
          ["Pipeline Value", money(data.metrics.pipeline_value_cents)],
          ["Hot Leads", data.metrics.hot_leads],
          ["Follow-Ups", data.metrics.follow_ups],
          ["SLA Risk", data.metrics.sla_risk],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">{value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label as string}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {Object.entries(BUCKET_LABELS).map(([key, label]) => (
          <div
            key={key}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-3 shadow-[var(--altus-shadow)]"
          >
            <div className="text-xl font-bold">{data.buckets[key]?.length ?? 0}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label}
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Priority Opportunities</h2>
            <p className="text-sm text-[var(--altus-text-secondary)]">
              Sorted by ALTUS opportunity / setter priority — not only date.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/pipeline"
              className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold"
            >
              Pipeline
            </Link>
            <Link
              href="/app/tasks"
              className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold"
            >
              Follow-ups
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          {data.priority_opportunities.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-6 text-sm text-[var(--altus-text-secondary)]">
              No opportunities yet. Qualified leads appear here after campaign capture and setter handoff.
            </p>
          ) : (
            data.priority_opportunities.map((lead) => {
              const q = lead.qualification;
              return (
                <Link
                  key={lead.id}
                  href={`/app/leads/${lead.id}`}
                  className={cn(
                    "block rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]",
                    "active:scale-[0.99] transition",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
                          {q?.temperature.temperature ?? lead.temperature_key}
                        </span>
                        <span className="rounded-full border border-[var(--altus-border)] px-2 py-0.5 text-[10px] font-bold uppercase">
                          {lead.pipeline_stage ?? "NEW"}
                        </span>
                        {q?.asset.commercial_tier &&
                        q.asset.commercial_tier !== "BELOW_TARGET" ? (
                          <span className="text-[10px] font-bold uppercase text-[var(--altus-text-secondary)]">
                            {q.asset.commercial_tier}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-lg font-bold">
                        {lead.first_name} {lead.last_name}
                      </h3>
                      <p className="text-sm text-[var(--altus-text-secondary)]">
                        {lead.state} · {q?.asset.repositionable_asset_band ?? "Assets —"} ·{" "}
                        {lead.assessment_answers.decision_timeline ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--altus-blue)]">
                        {q?.opportunity.opportunity_score ?? lead.score}
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                        Opportunity
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
