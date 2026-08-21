"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimCampaign } from "@/application/growth/simulationStore";
import { CHANNEL_CAPABILITIES } from "@/domain/types/social-integrations";
import { cn } from "@/lib/cn";

type Params = Promise<{ id: string }>;

export default function CampaignDetailPage({ params }: { params: Params }) {
  const [campaign, setCampaign] = useState<SimCampaign | null>(null);
  const [tab, setTab] = useState<"facebook" | "instagram" | "linkedin" | "google">(
    "facebook",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      const res = await fetch("/api/campaigns/state");
      const json = await res.json();
      setCampaign(json.campaigns.find((c: SimCampaign) => c.id === id) ?? null);
    })();
  }, [params]);

  const channelConfigs = useMemo(() => {
    if (!campaign) return [];
    return campaign.channels
      .filter((c) => c === "meta" || c === "linkedin" || c === "google")
      .map((provider) => {
        if (provider === "meta") {
          return {
            provider: "meta" as const,
            config: {
              placements: ["facebook", "instagram"] as Array<"facebook" | "instagram">,
              objective: "OUTCOME_LEADS",
              daily_budget_cents: Math.round((campaign.budget_cents ?? 10000) / 10),
              cta: campaign.branding.custom_cta ?? "LEARN_MORE",
            },
          };
        }
        if (provider === "linkedin") {
          return {
            provider: "linkedin" as const,
            config: {
              company_sizes: ["11-50", "51-200"],
              industries: [campaign.audience.industry ?? "Professional Services"],
              job_seniority: ["Director", "Owner"],
              locations: campaign.territories,
              daily_budget_cents: Math.round((campaign.budget_cents ?? 10000) / 10),
            },
          };
        }
        return {
          provider: "google" as const,
          config: {
            subtype: "search" as const,
            keywords: [
              { text: `${campaign.strategy} planning`, match_type: "phrase" as const },
              { text: "business tax strategy", match_type: "broad" as const },
            ],
            headlines: [
              campaign.landing_headline.slice(0, 30),
              "Talk with an advisor",
              "Business strategy assessment",
            ],
            descriptions: [campaign.landing_support.slice(0, 90)],
            geography: campaign.territories,
            daily_budget_cents: Math.round((campaign.budget_cents ?? 10000) / 10),
          },
        };
      });
  }, [campaign]);

  async function publish() {
    if (!campaign) return;
    setPublishing(true);
    setError(null);
    try {
      // ensure connections exist in simulation
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_simulation" }),
      });
      const res = await fetch("/api/campaigns/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          campaignId: campaign.id,
          confirmationAccepted: true,
          channelConfigs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Publish failed");
      setPublishResult(json.result);
      for (const cfg of channelConfigs) {
        const m = await fetch("/api/campaigns/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_metrics",
            campaignId: campaign.id,
            provider: cfg.provider,
          }),
        });
        const mj = await m.json();
        if (m.ok) {
          setMetrics((prev) => ({ ...prev, [cfg.provider]: mj.metrics }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (!campaign) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading campaign…</p>;
  }

  const totalSpend = Object.values(metrics).reduce((sum: number, m) => {
    const mm = m as { spend_cents?: number };
    return sum + (mm.spend_cents ?? 0);
  }, 0);
  const totalLeads = Object.values(metrics).reduce((sum: number, m) => {
    const mm = m as { leads?: number };
    return sum + (mm.leads ?? 0);
  }, 0);
  const totalClicks = Object.values(metrics).reduce((sum: number, m) => {
    const mm = m as { clicks?: number };
    return sum + (mm.clicks ?? 0);
  }, 0);
  const totalImpressions = Object.values(metrics).reduce((sum: number, m) => {
    const mm = m as { impressions?: number };
    return sum + (mm.impressions ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/campaigns" className="text-sm font-semibold text-[var(--altus-blue)]">
            ← Campaigns
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-[var(--altus-text)]">{campaign.name}</h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            {campaign.strategy} · {campaign.territories.join(", ")} ·{" "}
            {String(campaign.status).replaceAll("_", " ")}
          </p>
        </div>
        <Link
          href="/app/campaigns/creative-library"
          className="text-sm font-semibold text-[var(--altus-blue)]"
        >
          Creative library
        </Link>
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Campaign Review</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Row label="Audience" value={JSON.stringify(campaign.audience)} />
          <Row label="Strategy" value={campaign.strategy} />
          <Row label="Territory" value={campaign.territories.join(", ")} />
          <Row
            label="Budget"
            value={
              campaign.budget_cents != null
                ? `$${(campaign.budget_cents / 100).toLocaleString()}`
                : "—"
            }
          />
          <Row label="Destination" value={campaign.destination} />
          <Row label="Channels" value={campaign.channels.join(", ")} />
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Preview</h2>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
            Approximate · not exact platform rendering
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["facebook", "instagram", "linkedin", "google"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                tab === t
                  ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                  : "border-[var(--altus-border)]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-[10px] border border-[var(--altus-border)] bg-[var(--altus-section)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--altus-text-secondary)]">
            Preview · {tab}
          </p>
          <h3 className="mt-2 text-lg font-bold">{campaign.landing_headline}</h3>
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            {campaign.landing_support}
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-[var(--altus-blue)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            {campaign.branding.custom_cta ?? "Learn More"}
          </button>
          {tab === "google" && CHANNEL_CAPABILITIES.google.supportsSearchKeywords ? (
            <p className="mt-3 text-xs text-[var(--altus-text-secondary)]">
              Keywords enabled for Search subtype
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Publish to channels</h2>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          You are about to publish this campaign to external advertising platforms and may
          incur advertising charges.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1"
          />
          I understand charges may apply and I have approval to publish.
        </label>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!confirmed || publishing}
            onClick={() => void publish()}
            className="rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Publish Campaign"}
          </button>
          <Link
            href="/app/campaigns"
            className="rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </Link>
        </div>
        {publishResult ? (
          <pre className="mt-4 overflow-auto rounded-[8px] bg-[var(--altus-section)] p-3 text-xs">
            {JSON.stringify(publishResult, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Performance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Spend" value={`$${(totalSpend / 100).toFixed(2)}`} />
          <Metric label="Impressions" value={String(totalImpressions)} />
          <Metric label="Clicks" value={String(totalClicks)} />
          <Metric
            label="CTR"
            value={
              totalImpressions
                ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%`
                : "—"
            }
          />
          <Metric label="Leads" value={String(totalLeads || campaign.analytics.leads)} />
          <Metric
            label="Qualified"
            value={String(campaign.analytics.qualified_leads)}
          />
          <Metric
            label="Cost / Lead"
            value={
              totalLeads
                ? `$${(totalSpend / 100 / totalLeads).toFixed(2)}`
                : "—"
            }
          />
          <Metric
            label="Appointments"
            value={String(campaign.analytics.appointments)}
          />
        </div>

        <h3 className="mt-6 text-sm font-bold">Channel Performance</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {Object.entries(metrics).map(([provider, m]) => {
            const mm = m as {
              spend_cents: number;
              clicks: number;
              leads: number;
              appointments: number;
              revenue_cents: number;
            };
            return (
              <div
                key={provider}
                className="rounded-[10px] border border-[var(--altus-border)] p-3 text-sm"
              >
                <div className="font-bold capitalize">{provider}</div>
                <div className="mt-2 space-y-1 text-[var(--altus-text-secondary)]">
                  <div>Spend ${(mm.spend_cents / 100).toFixed(2)}</div>
                  <div>Clicks {mm.clicks}</div>
                  <div>Leads {mm.leads}</div>
                  <div>Appointments {mm.appointments}</div>
                  <div>Revenue ${(mm.revenue_cents / 100).toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 font-medium break-words">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--altus-border)] p-3">
      <div className="text-xl font-bold text-[var(--altus-blue)]">{value}</div>
      <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
        {label}
      </div>
    </div>
  );
}
