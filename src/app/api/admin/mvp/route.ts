import { NextResponse } from "next/server";
import { getSimStore } from "@/application/growth/simulationStore";
import { MvpAnalyticsService } from "@/application/analytics/MvpAnalyticsService";
import { LeadPendingRecoveryService } from "@/application/ops/LeadPendingRecoveryService";
import { LeadInventoryService } from "@/application/inventory/LeadInventoryService";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";

export async function GET() {
  const auth = await requireOrgAuth({ permission: "reports.view_all" });
  if (!auth.ok) return auth.response;

  const store = getSimStore();
  const analytics = new MvpAnalyticsService().fromStore();
  const pending = new LeadPendingRecoveryService().listPending();
  const inventory = new LeadInventoryService().adminBuckets(store.leads);

  const scoringFailures = pending.SCORING_PENDING.length;
  const distributionFailures = store.leads.filter(
    (l) =>
      l.status === "distribution_pending" ||
      !l.assigned_organization_id ||
      l.distribution_status === "pending",
  ).length;

  return NextResponse.json({
    ok: true,
    pending,
    inventory,
    ops: {
      scoring_failures: scoringFailures,
      distribution_failures: distributionFailures,
      marketplace_listed: store.leads.filter((l) => l.marketplace_listed).length,
    },
    analytics,
  });
}

export async function POST(request: Request) {
  const auth = await requireOrgAuth({ permission: "reports.view_all" });
  if (!auth.ok) return auth.response;

  const body = await request.json();
  if (body.action === "reprocess_pending") {
    const results = await new LeadPendingRecoveryService().reprocessAll();
    return NextResponse.json({ ok: true, results });
  }
  if (body.action === "refresh_inventory") {
    const store = getSimStore();
    const inventory = new LeadInventoryService();
    for (const lead of store.leads) inventory.refreshLifecycle(lead);
    return NextResponse.json({
      ok: true,
      buckets: inventory.adminBuckets(store.leads),
    });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
