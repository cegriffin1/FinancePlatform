"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function money(cents: number | null | undefined) {
  if (cents == null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function ExecutiveAnalyticsPage() {
  const [data, setData] = useState<{
    executive: Record<string, unknown>;
    channels: Array<Record<string, unknown>>;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/mvp", {
      headers: { "x-altus-role": "admin" },
    })
      .then((r) => r.json())
      .then((json) => setData(json.analytics));
  }, []);

  if (!data) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading executive dashboard…</p>;
  }

  const e = data.executive as Record<string, number | null | boolean | string>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
          Primary KPI: <strong>Cost Per Qualified Opportunity</strong>. Advertising
          metrics are never fabricated when unavailable.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Ad Spend", money(e.ad_spend_cents as number | null)],
          ["Clicks", e.clicks ?? "Unavailable"],
          ["Assessment Starts", e.assessment_starts],
          ["Completed Profiles", e.completed_profiles],
          ["Qualified $250K+", e.qualified_250k_plus],
          ["Setter Verified", e.setter_verified],
          ["Appointments", e.appointments],
          ["Opportunities", e.opportunities],
          ["Won", e.won],
          ["Lost", e.lost],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">{value as string | number}</div>
            <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
              {label as string}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cost Per Assessment", money(e.cost_per_assessment_cents as number | null)],
          ["Cost Per Qualified Opportunity", money(e.cost_per_qualified_opportunity_cents as number | null)],
          ["Cost Per Verified Opportunity", money(e.cost_per_verified_opportunity_cents as number | null)],
          ["Cost Per Appointment", money(e.cost_per_appointment_cents as number | null)],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4"
          >
            <div className="text-xl font-bold">{value as string}</div>
            <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
              {label as string}
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5">
        <h2 className="text-lg font-bold">Campaign channel comparison</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase text-[var(--altus-text-secondary)]">
              <tr>
                <th className="px-2 py-1 text-left">Channel</th>
                <th className="px-2 py-1 text-left">CPQO</th>
                <th className="px-2 py-1 text-left">$250K+</th>
                <th className="px-2 py-1 text-left">Wins</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((row) => (
                <tr key={String(row.channel)} className="border-t">
                  <td className="px-2 py-2 capitalize">{String(row.channel)}</td>
                  <td className="px-2 py-2">
                    {money(row.cost_per_qualified_opportunity_cents as number | null)}
                  </td>
                  <td className="px-2 py-2">{String(row.asset_250k)}</td>
                  <td className="px-2 py-2">{String(row.wins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link href="/admin/mvp" className="text-sm font-semibold text-[var(--altus-blue)]">
        ← MVP Control Center
      </Link>
    </div>
  );
}
