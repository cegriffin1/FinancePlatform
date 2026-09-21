"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import { cn } from "@/lib/cn";
import { SpeedToLeadService } from "@/application/crm/SpeedToLeadService";

const SECTIONS = [
  { key: "NEW", label: "NEW" },
  { key: "CONTACTING", label: "CONTACTING" },
  { key: "CONNECTED", label: "CONNECTED" },
  { key: "VERIFYING", label: "VERIFYING" },
  { key: "APPOINTMENT_READY", label: "APPOINTMENT READY" },
  { key: "FOLLOW_UP", label: "FOLLOW-UP" },
] as const;

function sectionFor(lead: SimLead): (typeof SECTIONS)[number]["key"] {
  if (lead.pipeline_stage === "APPOINTMENT_SET") return "APPOINTMENT_READY";
  if (lead.pipeline_stage === "SETTER_REVIEW" || lead.pipeline_stage === "VERIFIED") {
    return "VERIFYING";
  }
  const attempts = lead.contact_attempts ?? [];
  const connected = attempts.some((a) =>
    (a.result ?? "").toLowerCase().includes("connected"),
  );
  if (connected) return "CONNECTED";
  if (attempts.length > 0) return "CONTACTING";
  if ((lead.follow_ups ?? []).some((f) => f.status === "open")) return "FOLLOW_UP";
  return "NEW";
}

function tempLabel(lead: SimLead) {
  return (
    lead.operational_temperature ??
    lead.qualification?.temperature.temperature ??
    lead.temperature_key
  );
}

export default function SetterQueuePage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => {
        setLeads(json.leads ?? []);
        setLoading(false);
      });
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, SimLead[]> = Object.fromEntries(
      SECTIONS.map((s) => [s.key, [] as SimLead[]]),
    );
    const sorted = [...leads].sort(
      (a, b) =>
        (b.qualification?.setter_priority ?? b.score) -
        (a.qualification?.setter_priority ?? a.score),
    );
    for (const lead of sorted) {
      if (lead.qualification?.commercial_status === "ASSIGNED") continue;
      map[sectionFor(lead)]!.push(lead);
    }
    return map;
  }, [leads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Setter Workspace
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Contact, verify, and schedule — pre-call brief on every lead.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--altus-text-secondary)]">Loading queue…</p>
      ) : null}

      {SECTIONS.map((section) => (
        <section key={section.key} className="space-y-3">
          <h2 className="text-sm font-bold tracking-[0.12em] text-[var(--altus-blue)]">
            {section.label}
            <span className="ml-2 text-[var(--altus-text-secondary)]">
              ({grouped[section.key]?.length ?? 0})
            </span>
          </h2>
          {(grouped[section.key] ?? []).length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[var(--altus-border)] bg-white p-4 text-sm text-[var(--altus-text-secondary)]">
              No leads in this queue.
            </p>
          ) : (
            <div className="grid gap-3">
              {(grouped[section.key] ?? []).map((lead) => {
                const q = lead.qualification;
                const countdown = new SpeedToLeadService().formatCountdown(lead);
                return (
                  <article
                    key={lead.id}
                    className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
                            {tempLabel(lead)}
                          </span>
                          <span className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
                            {lead.attribution.ad_provider ??
                              lead.attribution.source ??
                              "Campaign"}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-bold text-[var(--altus-text)]">
                          {lead.first_name} {lead.last_name}
                        </h3>
                        <p className="text-sm text-[var(--altus-text-secondary)]">
                          Score {q?.opportunity.opportunity_score ?? lead.score} ·{" "}
                          {q?.asset.repositionable_asset_band ??
                            lead.assessment_answers.repositionable_assets ??
                            "—"}{" "}
                          · {lead.assessment_answers.decision_timeline ?? "—"}
                        </p>
                        <p className="mt-1 text-xs font-semibold">{countdown}</p>
                        <p className="text-xs text-[var(--altus-text-secondary)]">
                          Attempts: {lead.contact_attempts?.length ?? 0}
                        </p>
                      </div>
                      <Link
                        href={`/setter/leads/${lead.id}`}
                        className={cn(
                          "min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white",
                        )}
                      >
                        Open
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
