import { NextResponse } from "next/server";
import { getSimStore } from "@/application/growth/simulationStore";

export async function GET() {
  const store = getSimStore();
  return NextResponse.json({
    campaigns: store.campaigns,
    leads: store.leads,
    events: store.events,
    notifications: store.notifications,
    organizations: store.organizations.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      tier: o.tier,
    })),
  });
}
