"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";

export default function AdminLeadQualityPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => setLeads(json.leads ?? []));
  }, []);

  const stats = useMemo(() => {
    return {
      total: leads.length,
      accepted: leads.filter((l) => l.intelligence?.quality_gate === "ACCEPT").length,
      review: leads.filter((l) => l.intelligence?.quality_gate === "REVIEW").length,
      rejected: leads.filter((l) => l.intelligence?.quality_gate === "REJECT").length,
      duplicates: leads.filter((l) => l.intelligence?.quality_gate === "DUPLICATE").length,
      fraud: leads.filter((l) => l.intelligence?.quality_gate === "SUSPECTED_FRAUD").length,
      unassigned: leads.filter((l) => l.distribution_status === "unassigned_pool").length,
      sla: leads.filter((l) => l.sla?.sla_status === "breached").length,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Platform lead quality
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Is the ALTUS lead ecosystem healthy?
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(stats).map(([k, v]) => (
          <div
            key={k}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">{v}</div>
            <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
              {k}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-[var(--altus-border)] bg-white shadow-[var(--altus-shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--altus-border)] bg-[var(--altus-section)] text-[11px] uppercase tracking-wide text-[var(--altus-text-secondary)]">
            <tr>
              {["Lead", "Grade", "Gate", "Priority", "Validation", "Campaign", ""].map((h) => (
                <th key={h || "a"} className="px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--altus-border)]">
                <td className="px-3 py-3 font-semibold">{lead.business_name}</td>
                <td className="px-3 py-3">{lead.intelligence?.quality_grade ?? "—"}</td>
                <td className="px-3 py-3">{lead.intelligence?.quality_gate ?? "—"}</td>
                <td className="px-3 py-3">{lead.score}</td>
                <td className="px-3 py-3 text-xs">
                  email {lead.intelligence?.validation.email ?? "—"} / phone{" "}
                  {lead.intelligence?.validation.phone ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs">{lead.campaign_id.slice(0, 8)}…</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/app/leads/${lead.id}`}
                    className="text-xs font-semibold text-[var(--altus-blue)]"
                  >
                    Inspect
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
