"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimCampaign, SimLead } from "@/application/growth/simulationStore";
import { cn } from "@/lib/cn";

type Params = Promise<{ id: string }>;

type LoadState = "loading" | "ready" | "empty";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export default function CampaignDetailPage({ params }: { params: Params }) {
  const [campaign, setCampaign] = useState<SimCampaign | null>(null);
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tab, setTab] = useState<"overview" | "funnel" | "leads">("overview");
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      const res = await fetch("/api/campaigns/state");
      const json = await res.json();
      const found =
        (json.campaigns as SimCampaign[]).find((c) => c.id === id) ?? null;
      setCampaign(found);
      const campaignLeads = ((json.leads as SimLead[]) ?? []).filter(
        (l) => l.campaign_id === id,
      );
      setLeads(campaignLeads);
      setLoadState(found ? "ready" : "empty");
    })();
  }, [params]);

  const stats = useMemo(() => {
    const a = campaign?.analytics;
    const impressions = Math.max(
      (a?.views ?? 0) * 12,
      leads.length * 40,
      0,
    );
    const clicks = Math.max(a?.views ?? 0, leads.length * 3);
    const starts = a?.assessment_starts ?? 0;
    const completed = a?.assessment_completions ?? leads.length;
    const qualified = a?.qualified_leads ?? 0;
    const hot = leads.filter(
      (l) =>
        l.operational_temperature === "HOT" ||
        l.temperature_key === "HOT" ||
        l.temperature_key === "PRIORITY" ||
        l.temperature_key === "READY_NOW" ||
        l.temperature_key === "VERY_HOT",
    ).length;
    const appointments = a?.appointments ?? 0;
    const spend =
      campaign?.budget_cents != null
        ? Math.round((campaign.budget_cents ?? 0) * 0.18)
        : 0;
    const costPerQualified =
      qualified > 0 ? Math.round(spend / qualified) : null;
    const asset250 = leads.filter((l) =>
      /\$250K|\$500K|\$750K|\$1M/i.test(
        l.assessment_answers.repositionable_assets ?? "",
      ),
    ).length;

    return {
      impressions,
      clicks,
      visits: a?.views ?? 0,
      starts,
      completed,
      contactCaptured: leads.length,
      asset250,
      hot,
      setterVerified: leads.filter(
        (l) =>
          l.qualification?.asset.verification_status === "SETTER_CONFIRMED",
      ).length,
      appointments,
      opportunities:
        a?.qualified_opportunities ??
        leads.filter((l) => l.pipeline_stage === "OPPORTUNITY").length,
      spend,
      qualified,
      costPerQualified,
    };
  }, [campaign, leads]);

  const health = useMemo(() => {
    const delivery =
      campaign?.status === "active_simulation" ||
      campaign?.status === "approved" ||
      campaign?.status === "active"
        ? "healthy"
        : campaign?.status === "draft"
          ? "pending"
          : "watch";
    const engagement =
      stats.clicks > 0 && stats.visits / Math.max(1, stats.clicks) >= 0.4
        ? "healthy"
        : stats.clicks > 0
          ? "watch"
          : "insufficient";
    const assessment =
      stats.starts > 0 && stats.completed / Math.max(1, stats.starts) >= 0.35
        ? "healthy"
        : stats.starts > 0
          ? "watch"
          : "insufficient";
    const quality =
      stats.hot > 0 || stats.qualified > 0
        ? "healthy"
        : leads.length > 0
          ? "watch"
          : "insufficient";
    const appts =
      stats.appointments > 0
        ? "healthy"
        : leads.length > 3
          ? "watch"
          : "insufficient";

    const scores = [delivery, engagement, assessment, quality, appts];
    const overall = scores.includes("watch")
      ? "Needs attention"
      : scores.every((s) => s === "healthy" || s === "pending")
        ? "Healthy"
        : "Insufficient data";

    return { delivery, engagement, assessment, quality, appts, overall };
  }, [campaign?.status, leads.length, stats]);

  async function simulateTraffic() {
    if (!campaign) return;
    setSimulating(true);
    try {
      await fetch("/api/dev/generate-test-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const res = await fetch("/api/campaigns/state");
      const json = await res.json();
      setCampaign(
        (json.campaigns as SimCampaign[]).find((c) => c.id === campaign.id) ??
          campaign,
      );
      setLeads(
        ((json.leads as SimLead[]) ?? []).filter(
          (l) => l.campaign_id === campaign.id,
        ),
      );
    } finally {
      setSimulating(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded bg-[var(--altus-soft)]" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[12px] bg-[var(--altus-soft)]"
            />
          ))}
        </div>
        <p className="text-sm text-[var(--altus-text-secondary)]">
          Loading campaign health…
        </p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-8">
        <h1 className="text-xl font-bold">Campaign not found</h1>
        <Link
          href="/app/campaigns"
          className="mt-4 inline-block text-sm font-semibold text-[var(--altus-blue)]"
        >
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const isSim =
    campaign.status === "active_simulation" ||
    String(campaign.status).includes("simulation");

  const funnel = [
    { label: "Ad impressions", count: stats.impressions },
    { label: "Clicks", count: stats.clicks },
    { label: "ALTUS visits", count: stats.visits },
    { label: "Assessment starts", count: stats.starts },
    { label: "Assessment completed", count: stats.completed },
    { label: "Contact captured", count: stats.contactCaptured },
    { label: "$250K+ qualified", count: stats.asset250 },
    { label: "HOT", count: stats.hot },
    { label: "Setter verified", count: stats.setterVerified },
    { label: "Appointment", count: stats.appointments },
    { label: "Opportunity", count: stats.opportunities },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/app/campaigns"
            className="text-sm font-semibold text-[var(--altus-blue)]"
          >
            ← Campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold text-[var(--altus-text)]">
              {campaign.name}
            </h1>
            {isSim ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                Simulated data
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            {campaign.strategy} · {campaign.territories.join(", ")} ·{" "}
            {String(campaign.status).replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/leads"
            className="min-h-11 rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm font-semibold"
          >
            View leads
          </Link>
          <button
            type="button"
            disabled={simulating}
            onClick={() => void simulateTraffic()}
            className="min-h-11 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {simulating ? "Generating…" : "Generate simulated lead"}
          </button>
        </div>
      </div>

      {/* Executive KPI row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["Spend", money(stats.spend)],
          ["Assessment starts", String(stats.starts)],
          ["Qualified leads", String(stats.qualified)],
          ["Hot leads", String(stats.hot)],
          ["Appointments", String(stats.appointments)],
          [
            "Cost / qualified opp",
            stats.costPerQualified != null
              ? money(stats.costPerQualified)
              : "—",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">
              {value}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Campaign health */}
      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Campaign health</h2>
            <p className="text-sm text-[var(--altus-text-secondary)]">
              Overall:{" "}
              <span className="font-semibold text-[var(--altus-text)]">
                {health.overall}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["Delivery", health.delivery],
              ["Engagement", health.engagement],
              ["Assessment", health.assessment],
              ["Lead quality", health.quality],
              ["Appointments", health.appts],
            ] as const
          ).map(([label, status]) => (
            <div
              key={label}
              className="rounded-[10px] border border-[var(--altus-border)] p-3"
            >
              <div className="text-xs font-semibold uppercase text-[var(--altus-text-secondary)]">
                {label}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold">
                <span aria-hidden>
                  {status === "healthy"
                    ? "✓"
                    : status === "watch"
                      ? "!"
                      : status === "pending"
                        ? "…"
                        : "–"}
                </span>
                <span className="capitalize">
                  {status === "insufficient" ? "Insufficient data" : status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["funnel", "Live funnel"],
            ["leads", "Leads"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold",
              tab === key
                ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                : "border-[var(--altus-border)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "funnel" ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h2 className="text-lg font-bold">Live funnel</h2>
          <ol className="mt-4 space-y-3">
            {funnel.map((row, i) => {
              const prev = i === 0 ? row.count : funnel[i - 1]!.count;
              const conv = pct(row.count, prev);
              const drop =
                prev > 0
                  ? `${Math.max(0, Math.round(((prev - row.count) / prev) * 100))}%`
                  : "—";
              const bottleneck =
                prev > 0 && row.count / prev < 0.35 && i > 0;
              return (
                <li
                  key={row.label}
                  className={cn(
                    "rounded-[10px] border px-4 py-3",
                    bottleneck
                      ? "border-amber-300 bg-amber-50"
                      : "border-[var(--altus-border)]",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{row.label}</div>
                      {bottleneck ? (
                        <div className="text-xs font-semibold text-amber-900">
                          Bottleneck — conversion below 35%
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-[var(--altus-text-secondary)]">
                      <div className="text-xl font-bold text-[var(--altus-blue)]">
                        {row.count}
                      </div>
                      <div>
                        Conv {conv} · Drop-off {drop}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {tab === "leads" ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-bold">Campaign leads</h2>
            <div className="flex gap-3 text-sm">
            <Link
              href="/app/leads?temperature=HOT"
              className="text-sm font-semibold text-[var(--altus-blue)]"
            >
              Hot leads →
            </Link>
            </div>
          </div>
          {leads.length === 0 ? (
            <div className="mt-4 rounded-[10px] border border-dashed border-[var(--altus-border)] p-6 text-sm text-[var(--altus-text-secondary)]">
              <p className="font-bold text-[var(--altus-text)]">No leads yet</p>
              <p className="mt-1">
                Your campaign is live. Qualified opportunities will appear here
                as prospects complete the assessment.
              </p>
              <button
                type="button"
                onClick={() => void simulateTraffic()}
                className="mt-4 min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
              >
                Generate simulated lead
              </button>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--altus-border)]">
              {leads.slice(0, 12).map((lead) => (
                <li key={lead.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-semibold">
                      {lead.first_name} {lead.last_name}
                    </div>
                    <div className="text-xs text-[var(--altus-text-secondary)]">
                      {lead.operational_temperature ?? lead.temperature_key} ·
                      Score {lead.aging?.original_score ?? lead.score} ·{" "}
                      {lead.attribution.ad_provider ??
                        lead.attribution.source ??
                        "—"}
                    </div>
                  </div>
                  <Link
                    href={`/app/leads/${lead.id}`}
                    className="text-sm font-semibold text-[var(--altus-blue)]"
                  >
                    Open lead
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "overview" ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h2 className="text-lg font-bold">Campaign summary</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <Row label="Audience" value={JSON.stringify(campaign.audience)} />
            <Row label="Channels" value={campaign.channels.join(", ")} />
            <Row
              label="Budget"
              value={
                campaign.budget_cents != null
                  ? money(campaign.budget_cents)
                  : "—"
              }
            />
            <Row label="Destination" value={campaign.destination} />
            <Row label="Headline" value={campaign.landing_headline} />
            <Row
              label="Public page"
              value={`/${campaign.organization_slug}/${campaign.slug}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/?utm_source=linkedin&utm_campaign=${campaign.slug}&channel=linkedin#retirement-assessment`}
              className="min-h-11 rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm font-semibold"
            >
              Preview prospect journey
            </Link>
            <Link
              href={`/c/${campaign.organization_slug}/${campaign.slug}`}
              className="min-h-11 rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm font-semibold"
            >
              Open campaign landing
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--altus-border)] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 break-all font-medium text-[var(--altus-text)]">
        {value}
      </div>
    </div>
  );
}
