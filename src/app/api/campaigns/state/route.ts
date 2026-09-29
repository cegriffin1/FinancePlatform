import { NextResponse } from "next/server";
import { getSimStore } from "@/application/growth/simulationStore";
import { enforceInternalApiAccess } from "@/infrastructure/security/internalApiGate";

export async function GET() {
  const denied = await enforceInternalApiAccess();
  if (denied) return denied;

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
