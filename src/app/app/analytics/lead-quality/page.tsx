"use client";

import { useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type { SimCampaign } from "@/application/growth/simulationStore";
import { CampaignQualityService } from "@/application/intelligence/insights";
import { CampaignOptimizationService } from "@/application/intelligence/insights";

export default function LeadQualityAnalyticsPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [campaigns, setCampaigns] = useState<SimCampaign[]>([]);

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => {
        setLeads(json.leads ?? []);
        setCampaigns(json.campaigns ?? []);
      });
  }, []);

  const quality = useMemo(() => {
    const svc = new CampaignQualityService();
    return svc.compute({
      raw_leads: leads.length,
      accepted_leads: leads.filter((l) => l.intelligence?.quality_gate === "ACCEPT").length,
      qualified_leads: leads.filter((l) => l.score >= 60).length,
      hot_leads: leads.filter((l) => l.temperature_key === "HOT").length,
      priority_leads: leads.filter((l) => l.temperature_key === "PRIORITY").length,
      appointments: leads.filter((l) => l.outcome === "Appointment Scheduled").length,
      opportunities: leads.filter((l) =>
        ["Qualified Opportunity", "Proposal", "Won"].includes(l.outcome ?? ""),
      ).length,
      wins: leads.filter((l) => l.outcome === "Won").length,
      invalid: leads.filter((l) => l.intelligence?.quality_gate === "REJECT").length,
      duplicates: leads.filter((l) => l.intelligence?.quality_gate === "DUPLICATE").length,
      contacted: leads.filter((l) =>
        ["Contacted", "Appointment", "Opportunity", "Won"].includes(
          l.pipeline_stage ?? "",
        ),
      ).length,
    });
  }, [leads]);

  const recommendations = useMemo(() => {
    const byChannel = new Map<string, { leads: number; qualified: number; appointments: number; opportunities: number }>();
    for (const lead of leads) {
      const ch = String(lead.attribution.ad_provider ?? lead.attribution.source ?? "direct");
      const row = byChannel.get(ch) ?? {
        leads: 0,
        qualified: 0,
        appointments: 0,
        opportunities: 0,
      };
      row.leads += 1;
      if (lead.score >= 60) row.qualified += 1;
      if (lead.outcome === "Appointment Scheduled") row.appointments += 1;
      if (["Qualified Opportunity", "Proposal", "Won"].includes(lead.outcome ?? "")) {
        row.opportunities += 1;
      }
      byChannel.set(ch, row);
    }
    return new CampaignOptimizationService().recommend({
      organizationId: null,
      campaignId: campaigns[0]?.id ?? null,
      channels: Array.from(byChannel.entries()).map(([channel, stats]) => ({
        channel,
        ...stats,
      })),
      invalidRate: quality.invalid_rate,
      topSegment: "Florida business owners with 11–50 employees",
    });
  }, [leads, campaigns, quality.invalid_rate]);

  const avgResponse =
    leads
      .map((l) => l.sla?.time_to_first_view_ms)
      .filter((n): n is number => typeof n === "number")
      .reduce((a, b, _, arr) => a + b / arr.length, 0) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Lead quality analytics
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Is this campaign producing valuable opportunities?
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Lead Quality Score" value={String(quality.quality_score)} />
        <Metric
          label="Qualified Rate"
          value={`${Math.round((quality.qualified_leads / Math.max(quality.raw_leads, 1)) * 100)}%`}
        />
        <Metric
          label="Appointment Rate"
          value={`${Math.round(quality.appointment_rate * 100)}%`}
        />
        <Metric
          label="Invalid Rate"
          value={`${Math.round(quality.invalid_rate * 100)}%`}
        />
        <Metric
          label="Duplicate Rate"
          value={`${Math.round(quality.duplicate_rate * 100)}%`}
        />
        <Metric
          label="Avg Response"
          value={
            avgResponse != null ? `${Math.round(avgResponse / 60000)} min` : "Not Enough Data"
          }
        />
        <Metric label="Cost / Qualified" value="Not Enough Data" />
        <Metric label="Cost / Opportunity" value="Not Enough Data" />
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Funnel</h2>
        <ol className="mt-4 space-y-2 text-sm">
          {[
            ["Campaign views", campaigns.reduce((s, c) => s + c.analytics.views, 0)],
            ["Assessments", campaigns.reduce((s, c) => s + c.analytics.assessment_starts, 0)],
            ["Leads", quality.raw_leads],
            ["Accepted", quality.accepted_leads],
            ["Qualified", quality.qualified_leads],
            ["Appointments", quality.appointments],
            ["Opportunities", quality.opportunities],
            ["Won", quality.wins],
          ].map(([label, value], i, arr) => {
            const prev = i === 0 ? null : Number(arr[i - 1]![1]);
            const conv =
              prev && prev > 0 ? Math.round((Number(value) / prev) * 100) : null;
            return (
              <li key={label as string} className="flex justify-between gap-3">
                <span>{label as string}</span>
                <span className="font-semibold">
                  {value as number}
                  {conv != null ? ` · ${conv}%` : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Optimization recommendations</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--altus-text-secondary)]">
          {recommendations.length === 0 ? (
            <li>Not Enough Data</li>
          ) : (
            recommendations.map((r) => <li key={r.id}>{r.message}</li>)
          )}
        </ul>
        <p className="mt-3 text-xs text-[var(--altus-text-secondary)]">
          Recommendations only — budgets are not automatically changed.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
      <div className="text-xl font-bold text-[var(--altus-blue)]">{value}</div>
      <div className="text-[11px] font-semibold uppercase text-[var(--altus-text-secondary)]">
        {label}
      </div>
    </div>
  );
}
