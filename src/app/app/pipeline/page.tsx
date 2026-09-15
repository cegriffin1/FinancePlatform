"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import { PIPELINE_STAGES, type PipelineStage } from "@/domain/types/lead-intelligence";
import { cn } from "@/lib/cn";

export default function PipelinePage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  async function load() {
    const res = await fetch("/api/crm");
    const json = await res.json();
    setLeads(json.leads ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s, [] as SimLead[]]),
    ) as Record<PipelineStage, SimLead[]>;
    for (const lead of leads) {
      const stage = (lead.pipeline_stage ?? "NEW") as PipelineStage;
      (map[stage] ?? map.NEW).push(lead);
    }
    for (const stage of PIPELINE_STAGES) {
      map[stage].sort(
        (a, b) =>
          (b.qualification?.opportunity.opportunity_score ?? b.score) -
          (a.qualification?.opportunity.opportunity_score ?? a.score),
      );
    }
    return map;
  }, [leads]);

  async function move(leadId: string, stage: PipelineStage) {
    await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_stage", lead_id: leadId, stage }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            Retirement lead stages for selling and servicing — not full Dynamics.
          </p>
        </div>
        <div className="flex rounded-md border border-[var(--altus-border)] p-1">
          {(["kanban", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold capitalize",
                view === v ? "bg-[var(--altus-blue)] text-white" : "",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              className="w-[260px] shrink-0 rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-soft,#f3f7fb)] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-bold tracking-wide text-[var(--altus-blue)]">
                  {stage.replaceAll("_", " ")}
                </h2>
                <span className="text-xs font-semibold text-[var(--altus-text-secondary)]">
                  {byStage[stage].length}
                </span>
              </div>
              <div className="space-y-2">
                {byStage[stage].map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-[10px] border border-[var(--altus-border)] bg-white p-3 shadow-sm"
                  >
                    <Link href={`/app/leads/${lead.id}`} className="font-semibold">
                      {lead.first_name} {lead.last_name}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
                      {lead.qualification?.temperature.temperature ?? lead.temperature_key} ·{" "}
                      {lead.qualification?.opportunity.opportunity_score ?? lead.score}
                    </p>
                    <select
                      className="mt-2 w-full rounded border border-[var(--altus-border)] px-1 py-1 text-[10px]"
                      value={stage}
                      onChange={(e) =>
                        void move(lead.id, e.target.value as PipelineStage)
                      }
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-[var(--altus-border)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--altus-border)] text-[11px] uppercase text-[var(--altus-text-secondary)]">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Temp</th>
                <th className="px-3 py-2">Assets</th>
                <th className="px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-[var(--altus-border)]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="font-semibold text-[var(--altus-blue)]"
                    >
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-[var(--altus-border)] px-1 py-1 text-xs"
                      value={lead.pipeline_stage ?? "NEW"}
                      onChange={(e) =>
                        void move(lead.id, e.target.value as PipelineStage)
                      }
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {lead.qualification?.opportunity.opportunity_score ?? lead.score}
                  </td>
                  <td className="px-3 py-2">
                    {lead.qualification?.temperature.temperature ?? lead.temperature_key}
                  </td>
                  <td className="px-3 py-2">
                    {lead.qualification?.asset.repositionable_asset_band ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {lead.ownership?.owner_label ?? lead.assigned_agent_label ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
