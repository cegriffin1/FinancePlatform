"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MvpPayload = {
  health: Record<string, number>;
  inventory_counts: Record<string, number>;
  analytics: {
    executive: Record<string, unknown>;
    channels: Array<Record<string, unknown>>;
  };
};

function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminMvpControlCenter() {
  const [data, setData] = useState<MvpPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/mvp", {
      headers: { "x-altus-role": "admin" },
    });
    setData(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function reprocess() {
    const res = await fetch("/api/admin/mvp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-altus-role": "admin",
      },
      body: JSON.stringify({ action: "reprocess_pending" }),
    });
    const json = await res.json();
    setMessage(`Reprocessed ${json.results?.length ?? 0} lead(s)`);
    await load();
  }

  if (!data) {
    return <p className="p-6 text-sm text-[var(--altus-text-secondary)]">Loading MVP control center…</p>;
  }

  const h = data.health;
  const exec = data.analytics.executive as {
    ad_spend_cents: number | null;
    clicks: number | null;
    assessment_starts: number;
    completed_profiles: number;
    qualified_250k_plus: number;
    setter_verified: number;
    appointments: number;
    opportunities: number;
    won: number;
    lost: number;
    cost_per_assessment_cents: number | null;
    cost_per_qualified_opportunity_cents: number | null;
    cost_per_verified_opportunity_cents: number | null;
    cost_per_appointment_cents: number | null;
    spend_data_available: boolean;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MVP Control Center</h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            Pilot operations — campaign health, pending retries, marketplace inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reprocess()}
          className="rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
        >
          Retry pending leads
        </button>
      </div>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Campaign health", h.campaigns_active],
          ["Lead ingestion", h.lead_ingestion_24h],
          ["Scoring failures", h.scoring_failures],
          ["Distribution failures", h.distribution_failures],
          ["Setter backlog", h.setter_backlog],
          ["Appointments", h.appointments],
          ["Unassigned leads", h.unassigned_leads],
          ["CRM sync failures", h.crm_sync_failures],
          ["Marketplace inventory", h.marketplace_inventory],
          ["Partial recoveries", h.partial_recoveries],
          ["Notification pending", h.notification_pending],
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

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Executive funnel</h2>
        {!exec.spend_data_available ? (
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            Ad spend not available in this environment — cost metrics show as unavailable (not fabricated).
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Ad Spend", money(exec.ad_spend_cents)],
            ["Clicks", exec.clicks ?? "—"],
            ["Assessment Starts", exec.assessment_starts],
            ["Completed Profiles", exec.completed_profiles],
            ["Qualified $250K+", exec.qualified_250k_plus],
            ["Setter Verified", exec.setter_verified],
            ["Appointments", exec.appointments],
            ["Opportunities", exec.opportunities],
            ["Won", exec.won],
            ["Lost", exec.lost],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-lg font-bold">{value as string | number}</div>
              <div className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                {label as string}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Cost / Assessment", money(exec.cost_per_assessment_cents)],
            ["Cost / Qualified Opp (PRIMARY KPI)", money(exec.cost_per_qualified_opportunity_cents)],
            ["Cost / Verified Opp", money(exec.cost_per_verified_opportunity_cents)],
            ["Cost / Appointment", money(exec.cost_per_appointment_cents)],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-md border border-[var(--altus-border)] p-3">
              <div className="text-xl font-bold text-[var(--altus-blue)]">{value as string}</div>
              <div className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                {label as string}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Channel comparison</h2>
        <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
          Primary KPI is Cost Per Qualified Opportunity — not cheapest lead.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-[var(--altus-text-secondary)]">
              <tr>
                <th className="px-2 py-1">Channel</th>
                <th className="px-2 py-1">Clicks</th>
                <th className="px-2 py-1">Completion</th>
                <th className="px-2 py-1">$250K+</th>
                <th className="px-2 py-1">$500K+</th>
                <th className="px-2 py-1">$1M+</th>
                <th className="px-2 py-1">High Priority</th>
                <th className="px-2 py-1">Setter Verified</th>
                <th className="px-2 py-1">Appts</th>
                <th className="px-2 py-1">Opps</th>
                <th className="px-2 py-1">Wins</th>
                <th className="px-2 py-1">CPQO</th>
              </tr>
            </thead>
            <tbody>
              {data.analytics.channels.map((row) => (
                <tr key={String(row.channel)} className="border-t border-[var(--altus-border)]">
                  <td className="px-2 py-2 font-semibold capitalize">{String(row.channel)}</td>
                  <td className="px-2 py-2">{row.clicks == null ? "—" : String(row.clicks)}</td>
                  <td className="px-2 py-2">{String(row.completion)}</td>
                  <td className="px-2 py-2">{String(row.asset_250k)}</td>
                  <td className="px-2 py-2">{String(row.asset_500k)}</td>
                  <td className="px-2 py-2">{String(row.asset_1m)}</td>
                  <td className="px-2 py-2">{String(row.high_priority)}</td>
                  <td className="px-2 py-2">{String(row.setter_verified)}</td>
                  <td className="px-2 py-2">{String(row.appointments)}</td>
                  <td className="px-2 py-2">{String(row.opportunities)}</td>
                  <td className="px-2 py-2">{String(row.wins)}</td>
                  <td className="px-2 py-2">
                    {money(row.cost_per_qualified_opportunity_cents as number | null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/app/analytics/executive" className="text-[var(--altus-blue)]">
          Executive dashboard →
        </Link>
        <Link href="/admin/lead-inventory" className="text-[var(--altus-blue)]">
          Lead inventory →
        </Link>
        <Link href="/setter" className="text-[var(--altus-blue)]">
          Setter queue →
        </Link>
        <Link href="/marketplace" className="text-[var(--altus-blue)]">
          Marketplace →
        </Link>
      </div>
    </div>
  );
}
