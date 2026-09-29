import { NextResponse } from "next/server";
import { getSimStore } from "@/application/growth/simulationStore";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

export async function GET() {
  const auth = await requireOrgAuth({ permission: "leads.view_own" });
  if (!auth.ok) return auth.response;

  // Durable org-scoped leads when in supabase mode
  if (isSupabaseDataMode() && auth.ctx.organizationId) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data: leads, error } = await supabase
        .from("leads")
        .select("*")
        .eq("organization_id", auth.ctx.organizationId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("*")
        .eq("organization_id", auth.ctx.organizationId)
        .limit(200);

      return NextResponse.json({
        campaigns: campaigns ?? [],
        leads: (leads ?? []).map((l) => ({
          ...l,
          // Map durable columns into Command Center expectations
          operational_temperature: l.operational_temperature,
          temperature_key: l.temperature_key ?? l.operational_temperature,
          score: l.opportunity_score ?? l.score,
          assessment_answers: l.assessment_answers ?? {},
          attribution: l.attribution ?? {},
        })),
        events: [],
        notifications: [],
        organizations: [
          {
            id: auth.ctx.organizationId,
            slug: "org",
            name: "Organization",
            tier: "growth",
          },
        ],
        dataMode: "supabase",
      });
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Failed to load org workspace state", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      return NextResponse.json(
        { error: "Unable to load workspace data", code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
  }

  const store = getSimStore();
  const orgId = auth.ctx.organizationId;
  const leads = orgId
    ? store.leads.filter(
        (l) =>
          l.organization_id === orgId ||
          l.assigned_organization_id === orgId ||
          !l.organization_id,
      )
    : store.leads;
  const campaigns = orgId
    ? store.campaigns.filter(
        (c) => c.organization_id === orgId || !c.organization_id,
      )
    : store.campaigns;

  return NextResponse.json({
    campaigns,
    leads,
    events: store.events.filter(
      (e) => !orgId || e.organization_id === orgId || !e.organization_id,
    ),
    notifications: store.notifications.filter(
      (n) => !orgId || n.organization_id === orgId,
    ),
    organizations: store.organizations.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      tier: o.tier,
    })),
    dataMode: "simulation",
  });
}
