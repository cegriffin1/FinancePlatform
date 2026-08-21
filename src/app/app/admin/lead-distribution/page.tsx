"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";

type Org = { id: string; name: string; tier: string };

export default function LeadDistributionAdminPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);

  async function refresh() {
    const res = await fetch("/api/campaigns/state");
    const json = await res.json();
    setLeads(json.leads ?? []);
    setOrgs(json.organizations ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const unassigned = leads.filter((l) => l.distribution_status === "unassigned_pool");
  const priority = leads.filter(
    (l) => l.temperature_key === "PRIORITY" || l.temperature_key === "HOT",
  );
  const recent = leads.filter((l) => l.distribution_status === "assigned").slice(0, 20);

  function orgName(id: string | null) {
    if (!id) return "—";
    return orgs.find((o) => o.id === id)?.name ?? id.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Lead distribution
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Platform admin view of ALTUS pool routing, Premier eligibility outcomes, and audit trails.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Unassigned", unassigned.length],
          ["Priority / Hot", priority.length],
          ["Recently distributed", recent.length],
          ["Total leads", leads.length],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">{value as number}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label as string}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-[var(--altus-border)] bg-white shadow-[var(--altus-shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--altus-border)] bg-[var(--altus-section)] text-[11px] uppercase tracking-wide text-[var(--altus-text-secondary)]">
            <tr>
              {["Lead", "Score", "Strategy", "State", "Campaign", "Assigned Org", "Status", ""].map(
                (h) => (
                  <th key={h || "a"} className="px-3 py-3 font-semibold">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--altus-border)]">
                <td className="px-3 py-3 font-semibold">{lead.business_name}</td>
                <td className="px-3 py-3">{lead.score}</td>
                <td className="px-3 py-3">
                  {lead.classifications[0]?.strategy_category ?? "—"}
                </td>
                <td className="px-3 py-3">{lead.state}</td>
                <td className="px-3 py-3 text-xs">{lead.campaign_id.slice(0, 8)}…</td>
                <td className="px-3 py-3">{orgName(lead.assigned_organization_id)}</td>
                <td className="px-3 py-3 text-xs uppercase">{lead.distribution_status}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/app/leads/${lead.id}`}
                    className="text-xs font-semibold text-[var(--altus-blue)]"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
