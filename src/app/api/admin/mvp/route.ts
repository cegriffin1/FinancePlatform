import { NextResponse } from "next/server";
import { getSimStore } from "@/application/growth/simulationStore";
import { MvpAnalyticsService } from "@/application/analytics/MvpAnalyticsService";
import { LeadPendingRecoveryService } from "@/application/ops/LeadPendingRecoveryService";
import { LeadInventoryService } from "@/application/inventory/LeadInventoryService";
import {
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
} from "@/domain/permissions/keys";
import {
  assertPermission,
  AuthorizationError,
} from "@/application/authorization";
import { enforceInternalApiAccess } from "@/infrastructure/security/internalApiGate";

/** Dev/sim auth: admin ops require reports.view_all (owner/admin). */
function grantedFromRequest(request: Request): PermissionKey[] {
  const role = request.headers.get("x-altus-role") ?? "admin";
  if (role === "setter") return DEFAULT_ROLE_PERMISSIONS.setter;
  if (role === "sales") return DEFAULT_ROLE_PERMISSIONS.sales;
  if (role === "manager") return DEFAULT_ROLE_PERMISSIONS.manager;
  if (role === "marketing") return DEFAULT_ROLE_PERMISSIONS.marketing;
  if (role === "admin" || role === "owner") return [...DEFAULT_ROLE_PERMISSIONS.admin];
  return DEFAULT_ROLE_PERMISSIONS.employee;
}

function authorizeAdmin(request: Request) {
  assertPermission(grantedFromRequest(request), "reports.view_all");
}

export async function GET(request: Request) {
  const denied = await enforceInternalApiAccess();
  if (denied) return denied;

  try {
    authorizeAdmin(request);
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }

  const store = getSimStore();
  const analytics = new MvpAnalyticsService().fromStore();
  const pending = new LeadPendingRecoveryService().listPending();
  const inventory = new LeadInventoryService().adminBuckets(store.leads);

  const scoringFailures = pending.SCORING_PENDING.length;
  const distributionFailures = pending.DISTRIBUTION_PENDING.length;
  const crmSyncFailures = pending.CRM_SYNC_PENDING.length;
  const setterBacklog = store.leads.filter(
    (l) =>
      l.qualification?.commercial_status === "SETTER_REVIEW" ||
      l.pipeline_stage === "SETTER_REVIEW",
  ).length;
  const appointments = store.leads.filter((l) => (l.appointments?.length ?? 0) > 0).length;
  const unassigned = store.leads.filter(
    (l) =>
      !l.assigned_organization_id ||
      l.distribution_status === "unassigned_pool" ||
      l.distribution_status === "pending",
  ).length;
  const partialRecoveries = store.leads.filter((l) => l.recovery?.is_partial).length;

  return NextResponse.json({
    health: {
      campaigns_active: store.campaigns.filter((c) =>
        ["active", "active_simulation", "published"].includes(String(c.status)),
      ).length,
      lead_ingestion_24h: store.leads.length,
      scoring_failures: scoringFailures,
      distribution_failures: distributionFailures,
      notification_pending: pending.NOTIFICATION_PENDING.length,
      crm_sync_failures: crmSyncFailures,
      setter_backlog: setterBacklog,
      appointments,
      unassigned_leads: unassigned,
      marketplace_inventory: inventory.marketplace.length,
      partial_recoveries: partialRecoveries,
    },
    pending,
    inventory_counts: Object.fromEntries(
      Object.entries(inventory).map(([k, v]) => [k, v.length]),
    ),
    analytics,
  });
}

export async function POST(request: Request) {
  const denied = await enforceInternalApiAccess();
  if (denied) return denied;

  try {
    authorizeAdmin(request);
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }

  const body = await request.json();
  if (body.action === "reprocess_pending") {
    const results = await new LeadPendingRecoveryService().reprocessAll();
    return NextResponse.json({ ok: true, results });
  }
  if (body.action === "reprocess_lead") {
    const lead = getSimStore().leads.find((l) => l.id === body.lead_id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await new LeadPendingRecoveryService().reprocessLead(lead);
    return NextResponse.json({ ok: true, result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
