"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type { LeadEvent } from "@/domain/types";

type Payload = {
  leads: SimLead[];
  events: LeadEvent[];
  campaigns: Array<{ id: string; name: string }>;
  organizations: Array<{ id: string; name: string }>;
};

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [lead, setLead] = useState<SimLead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      const res = await fetch("/api/campaigns/state");
      const json = (await res.json()) as Payload & {
        events?: LeadEvent[];
      };
      // events may not be in state API yet — extend
      const stateRes = await fetch("/api/leads/" + id);
      if (stateRes.ok) {
        const detail = await stateRes.json();
        setLead(detail.lead);
        setEvents(detail.events ?? []);
        setCampaignName(detail.campaignName ?? "");
        setOrgName(detail.organizationName ?? "");
        return;
      }
      const found = json.leads.find((l) => l.id === id) ?? null;
      setLead(found);
    })();
  }, [params]);

  if (!lead) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading lead…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/leads" className="text-sm font-semibold text-[var(--altus-blue)]">
            ← Leads
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-[var(--altus-text)]">
            {lead.business_name}
          </h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            {lead.first_name} {lead.last_name} · {lead.email} · {lead.phone}
          </p>
        </div>
        <div className="rounded-[12px] border border-[var(--altus-border)] bg-white px-5 py-4 text-center shadow-[var(--altus-shadow)]">
          <div className="text-3xl font-bold text-[var(--altus-blue)]">{lead.score}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
            {lead.temperature_key}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Contact & business">
          <Row label="Business" value={lead.business_name} />
          <Row label="State" value={lead.state} />
          <Row label="Preferred contact" value={lead.preferred_contact} />
          <Row label="Consent" value={lead.consent ? "Yes" : "No"} />
        </Card>
        <Card title="Campaign source">
          <Row label="Campaign" value={campaignName || lead.campaign_id.slice(0, 8)} />
          <Row label="Owner type" value={lead.owner_type} />
          <Row label="UTM source" value={lead.attribution.utm_source ?? "—"} />
          <Row label="Landing page" value={lead.attribution.landing_page ?? "—"} />
          <Row label="Captured" value={new Date(lead.attribution.captured_at).toLocaleString()} />
        </Card>
        <Card title="Assignment">
          <Row label="Organization" value={orgName || lead.assigned_organization_id?.slice(0, 8) || "Unassigned pool"} />
          <Row label="Advisor" value={lead.assigned_agent_label ?? "—"} />
          <Row label="Distribution" value={lead.distribution_status} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Score breakdown">
          <Row label="Fit" value={String(lead.fit_score)} />
          <Row label="Intent" value={String(lead.intent_score)} />
          <Row label="Engagement" value={String(lead.engagement_score)} />
          <Row label="Version" value={lead.score_version} />
          <p className="mt-3 text-sm text-[var(--altus-text-secondary)]">
            {lead.score_breakdown.explanation}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-[var(--altus-text-secondary)]">
            {lead.score_breakdown.factors.map((f) => (
              <li key={f.key}>
                +{f.points} {f.reason}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Strategy classification">
          {lead.classifications.map((c) => (
            <div key={c.id} className="mb-3 rounded-[8px] border border-[var(--altus-border)] p-3">
              <div className="font-semibold text-[var(--altus-text)]">{c.strategy_category}</div>
              <div className="text-xs text-[var(--altus-text-secondary)]">
                Confidence {(c.strategy_confidence * 100).toFixed(0)}% · {c.classification_reason}
              </div>
            </div>
          ))}
          <p className="text-xs text-[var(--altus-text-secondary)]">
            Internal CRM labels only — not consumer financial advice.
          </p>
        </Card>
      </div>

      <Card title="Assessment responses">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(lead.assessment_answers).map(([key, value]) => (
            <Row key={key} label={key.replaceAll("_", " ")} value={value} />
          ))}
        </div>
      </Card>

      <Card title="Event timeline">
        <ol className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="w-40 shrink-0 text-xs text-[var(--altus-text-secondary)]">
                {new Date(event.occurred_at).toLocaleTimeString()}
              </span>
              <span className="font-medium text-[var(--altus-text)]">{event.event_type}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
      <h2 className="text-lg font-bold text-[var(--altus-text)]">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--altus-text-secondary)]">{label}</span>
      <span className="text-right font-medium text-[var(--altus-text)]">{value}</span>
    </div>
  );
}
