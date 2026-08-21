"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";

export default function LeadsPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [orgFilter, setOrgFilter] = useState("all");

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => setLeads(json.leads ?? []));
  }, []);

  const filtered =
    orgFilter === "all"
      ? leads
      : leads.filter((l) => l.assigned_organization_id === orgFilter);

  const orgs = Array.from(
    new Set(
      leads
        .map((l) => l.assigned_organization_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">Leads</h1>
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            CRM inbox for campaign leads — scores, strategies, and attribution included.
          </p>
        </div>
        <select
          className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="all">All organizations</option>
          {orgs.map((id) => (
            <option key={id} value={id}>
              {id.slice(0, 8)}…
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-8 text-sm text-[var(--altus-text-secondary)]">
          No leads yet. Launch a campaign and complete the public assessment, or use Generate Test Lead.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <Link
              key={lead.id}
              href={`/app/leads/${lead.id}`}
              className="block rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--altus-shadow-hover)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[var(--altus-text)]">
                    {lead.business_name}
                  </h2>
                  <p className="text-sm text-[var(--altus-text-secondary)]">
                    {lead.first_name} {lead.last_name} · {lead.state} ·{" "}
                    {lead.classifications[0]?.strategy_category ?? "Unclassified"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[var(--altus-blue)]">{lead.score}</div>
                  <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                    {lead.temperature_key}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
