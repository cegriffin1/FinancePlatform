"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimCampaign, SimLead } from "@/application/growth/simulationStore";
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

export default function AgentHomePage() {
  const [data, setData] = useState<HomePayload["home"] | null>(null);
  const [campaigns, setCampaigns] = useState<SimCampaign[]>([]);
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch("/api/crm").then((r) => r.json()),
      fetch("/api/campaigns/state").then((r) => r.json()),
    ]).then(([crm, state]) => {
      setData(crm.home);
      setCampaigns(state.campaigns ?? []);
      setLeads(state.leads ?? []);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-28 animate-pulse rounded-[16px] bg-[var(--altus-soft)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[12px] bg-[var(--altus-soft)]"
            />
          ))}
        </div>
        <p className="text-sm text-[var(--altus-text-secondary)]">Loading workspace…</p>
      </div>
    );
  }

  const activeCampaigns = campaigns.filter((c) =>
    ["active_simulation", "approved", "active", "scheduled"].includes(
      String(c.status),
    ),
  ).length;
  const recyclingSoon = leads.filter((l) => {
    const days =
      l.days_since_meaningful_interaction ??
      Math.floor(
        (Date.now() -
          new Date(l.last_meaningful_interaction_at ?? l.created_at).getTime()) /
          (24 * 60 * 60 * 1000),
      );
    return days >= 30 && days < 45;
  }).length;
  const attention: string[] = [];
  if (data.metrics.hot_leads > 0) {
    attention.push(
      `${data.metrics.hot_leads} Hot lead${data.metrics.hot_leads === 1 ? "" : "s"} need contact`,
    );
  }
  if (data.metrics.sla_risk > 0) {
    attention.push(`${data.metrics.sla_risk} campaign item${data.metrics.sla_risk === 1 ? "" : "s"} need attention`);
  }
  if (recyclingSoon > 0) {
    attention.push(
      `${recyclingSoon} lead${recyclingSoon === 1 ? "" : "s"} approaching recycling`,
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[16px] border border-[var(--altus-border)] bg-[linear-gradient(135deg,#003d75,#0074C8_55%,#4ea3e0)] px-5 py-6 text-white shadow-[var(--altus-shadow)] sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/75">
              GOOD MORNING
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
              {data.greeting}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/85">
              Here&apos;s what&apos;s happening across your campaigns.
            </p>
          </div>
          <Link
            href="/app/campaigns/new"
            className="min-h-11 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-[var(--altus-blue)]"
          >
            + Create Campaign
          </Link>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          ["Active campaigns", activeCampaigns, "/app/campaigns"],
          ["Hot leads", data.metrics.hot_leads, "/app/leads?temperature=HOT"],
          ["Appointments", data.metrics.appointments_today, "/app/calendar"],
          [
            "Qualified opportunities",
            data.metrics.new_opportunities,
            "/app/pipeline",
          ],
        ].map(([label, value, href]) => (
          <Link
            key={label as string}
            href={href as string}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)] transition hover:border-[var(--altus-blue)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">
              {value as number}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label as string}
            </div>
          </Link>
        ))}
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Needs your attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            You&apos;re clear. Create a campaign or review recent leads.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item}>
                <Link
                  href="/app/leads"
                  className="block rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-950"
                >
                  {item} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold">Campaign performance</h2>
          <Link
            href="/app/campaigns"
            className="text-sm font-semibold text-[var(--altus-blue)]"
          >
            All campaigns →
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="mt-4 rounded-[10px] border border-dashed border-[var(--altus-border)] p-6 text-sm">
            <p className="font-bold">No campaigns yet</p>
            <p className="mt-1 text-[var(--altus-text-secondary)]">
              Launch your first retirement opportunity campaign.
            </p>
            <Link
              href="/app/campaigns/new"
              className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[var(--altus-blue)] px-4 text-sm font-semibold text-white"
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--altus-border)]">
            {campaigns.slice(0, 5).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-[var(--altus-text-secondary)]">
                    {String(c.status).replaceAll("_", " ")} ·{" "}
                    {c.analytics.leads} leads · {c.analytics.hot_leads} hot
                  </div>
                </div>
                <Link
                  href={`/app/campaigns/${c.id}`}
                  className="text-sm font-semibold text-[var(--altus-blue)]"
                >
                  Health →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Live opportunities</h2>
            <p className="text-sm text-[var(--altus-text-secondary)]">
              Recent qualified leads — actual data, not simulated ticks.
            </p>
          </div>
          <Link
            href="/app/leads"
            className="text-sm font-semibold text-[var(--altus-blue)]"
          >
            Lead Command Center →
          </Link>
        </div>

        <div className="grid gap-3">
          {leads.slice(0, 5).length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-6 text-sm text-[var(--altus-text-secondary)]">
              <p className="font-bold text-[var(--altus-text)]">No leads yet</p>
              <p className="mt-1">
                Qualified opportunities will appear here as prospects complete
                the assessment.
              </p>
            </div>
          ) : (
            leads.slice(0, 5).map((lead) => (
              <Link
                key={lead.id}
                href={`/app/leads/${lead.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
              >
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
                      {lead.operational_temperature ?? lead.temperature_key}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                      {lead.attribution.ad_provider ?? lead.attribution.source ?? "—"}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold">
                    {lead.first_name} {lead.last_name.charAt(0)}.
                  </h3>
                  <p className="text-sm text-[var(--altus-text-secondary)]">
                    {lead.assessment_answers.repositionable_assets ?? "—"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--altus-blue)]">
                  Open →
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Recent leads</h2>
            <p className="text-sm text-[var(--altus-text-secondary)]">
              Pipeline value {money(data.metrics.pipeline_value_cents)}
            </p>
          </div>
          <Link
            href="/app/leads"
            className="text-sm font-semibold text-[var(--altus-blue)]"
          >
            Lead Command Center →
          </Link>
        </div>

        <div className="grid gap-3">
          {data.priority_opportunities.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-6 text-sm text-[var(--altus-text-secondary)]">
              <p className="font-bold text-[var(--altus-text)]">No leads yet</p>
              <p className="mt-1">
                Qualified opportunities will appear here as prospects complete
                the assessment.
              </p>
              <Link
                href="/app/campaigns/new"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--altus-blue)]"
              >
                Create Campaign →
              </Link>
            </div>
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
                          {lead.operational_temperature ??
                            q?.temperature.temperature ??
                            lead.temperature_key}
                        </span>
                        <span className="rounded-full border border-[var(--altus-border)] px-2 py-0.5 text-[10px] font-bold uppercase">
                          {lead.pipeline_stage ?? "NEW"}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold">
                        {lead.first_name} {lead.last_name}
                      </h3>
                      <p className="text-sm text-[var(--altus-text-secondary)]">
                        {lead.state} ·{" "}
                        {q?.asset.repositionable_asset_band ??
                          lead.assessment_answers.repositionable_assets ??
                          "Assets —"}{" "}
                        · {lead.assessment_answers.decision_timeline ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--altus-blue)]">
                        {q?.opportunity.opportunity_score ??
                          lead.aging?.original_score ??
                          lead.score}
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
