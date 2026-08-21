import { NextResponse } from "next/server";
import { getSimStore } from "@/application/growth/simulationStore";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
) {
  const { id } = await context.params;
  const store = getSimStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = store.campaigns.find((c) => c.id === lead.campaign_id);
  const org = store.organizations.find(
    (o) => o.id === lead.assigned_organization_id,
  );
  const events = store.events
    .filter((e) => e.lead_id === id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  return NextResponse.json({
    lead,
    events,
    campaignName: campaign?.name ?? null,
    organizationName: org?.name ?? null,
  });
}
