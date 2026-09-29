import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import {
  LeadComplianceService,
  LeadInventoryService,
  LeadPricingService,
  MarketplacePurchaseService,
} from "@/application/inventory/LeadInventoryService";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";

export async function GET(request: Request) {
  const auth = await requireOrgAuth({ permission: "leads.view_team" });
  if (!auth.ok) return auth.response;

  const store = getSimStore();
  const inventory = new LeadInventoryService();
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "marketplace";

  // Refresh lifecycles
  for (const lead of store.leads) {
    inventory.refreshLifecycle(lead);
  }

  if (view === "admin") {
    const admin = await requireOrgAuth({ permission: "reports.view_all" });
    if (!admin.ok) return admin.response;
    return NextResponse.json({
      buckets: inventory.adminBuckets(store.leads),
      pricing_config: store.pricing_config,
      inventory_config: store.inventory_config,
      purchases: store.purchases,
    });
  }

  if (view === "pricing") {
    return NextResponse.json({ pricing_config: store.pricing_config });
  }

  const listed = store.leads.filter(
    (l) => l.inventory_status === "MARKETPLACE" && l.marketplace_listed,
  );
  const previews = listed.map((l) => inventory.toPreview(l));

  // Filters
  const state = url.searchParams.get("state");
  const assetTier = url.searchParams.get("asset_tier");
  const temp = url.searchParams.get("temperature");
  const objective = url.searchParams.get("objective");
  const minScore = Number(url.searchParams.get("min_score") ?? 0);
  const maxScore = Number(url.searchParams.get("max_score") ?? 100);
  const minAge = Number(url.searchParams.get("min_age") ?? 0);
  const maxAge = Number(url.searchParams.get("max_age") ?? 9999);
  const minPrice = Number(url.searchParams.get("min_price") ?? 0);
  const maxPrice = Number(url.searchParams.get("max_price") ?? 99999999);
  const leadType = url.searchParams.get("lead_type");

  const filtered = previews.filter((p) => {
    if (state && p.state !== state) return false;
    if (assetTier && p.asset_tier !== assetTier) return false;
    if (temp && p.current_temperature !== temp) return false;
    if (objective && p.primary_objective !== objective) return false;
    if (leadType && p.lead_type !== leadType) return false;
    if (p.original_opportunity_score < minScore || p.original_opportunity_score > maxScore)
      return false;
    if (p.lead_age_days < minAge || p.lead_age_days > maxAge) return false;
    if (p.price_cents < minPrice || p.price_cents > maxPrice) return false;
    return true;
  });

  return NextResponse.json({
    listings: filtered,
    // Ensure no PII leaked in listings payload
    meta: { count: filtered.length },
  });
}

export async function POST(request: Request) {
  const auth = await requireOrgAuth({ permission: "leads.view_team" });
  if (!auth.ok) return auth.response;

  const store = getSimStore();
  const body = await request.json();
  const action = body.action as string;
  const inventory = new LeadInventoryService();
  const compliance = new LeadComplianceService();
  const pricing = new LeadPricingService();
  const purchaseSvc = new MarketplacePurchaseService();

  const adminActions = new Set([
    "update_pricing_config",
    "update_inventory_config",
    "extend",
    "release",
    "list_marketplace",
    "suppress",
    "revoke_sharing",
  ]);
  if (adminActions.has(action)) {
    const admin = await requireOrgAuth({ permission: "reports.view_all" });
    if (!admin.ok) return admin.response;
  }

  try {
    if (action === "update_pricing_config") {
      const cfg = pricing.updateConfig(body.config ?? {});
      return NextResponse.json({ ok: true, pricing_config: cfg });
    }

    if (action === "update_inventory_config") {
      const parsed = z
        .object({
          ownership_period_days: z.number().int().positive().optional(),
          max_extension_days: z.number().int().positive().optional(),
          reservation_ttl_seconds: z.number().int().positive().optional(),
        })
        .parse(body);
      store.inventory_config = { ...store.inventory_config, ...parsed };
      if (parsed.ownership_period_days) {
        store.ownership_config = {
          ownership_period_days: parsed.ownership_period_days,
        };
      }
      return NextResponse.json({ ok: true, inventory_config: store.inventory_config });
    }

    const lead = store.leads.find((l) => l.id === body.lead_id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    if (action === "extend") {
      const parsed = z
        .object({
          days: z.number().int().positive(),
          reason: z.string().min(1),
        })
        .parse(body);
      const extension = inventory.extendOwnership(
        lead,
        parsed.days,
        parsed.reason,
        body.granted_by ?? "admin",
      );
      return NextResponse.json({ ok: true, lead, extension });
    }

    if (action === "release") {
      inventory.release(lead, body.reason ?? "manual_release");
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "list_marketplace") {
      inventory.listOnMarketplace(lead);
      return NextResponse.json({
        ok: true,
        lead,
        preview: inventory.toPreview(lead),
      });
    }

    if (action === "suppress") {
      compliance.suppress(lead, body.reason ?? "admin_suppression");
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "revoke_sharing") {
      compliance.revokeSharing(lead, body.note);
      return NextResponse.json({ ok: true, lead });
    }

    if (action === "reserve") {
      const parsed = z
        .object({
          buyer_organization_id: z.string().uuid(),
          buyer_agent_id: z.string().nullable().optional(),
        })
        .parse(body);
      const reservation = purchaseSvc.reserve({
        leadId: lead.id,
        buyerOrganizationId: parsed.buyer_organization_id,
        buyerAgentId: parsed.buyer_agent_id,
      });
      return NextResponse.json({ ok: true, reservation });
    }

    if (action === "purchase") {
      const parsed = z
        .object({
          reservation_id: z.string().uuid(),
          buyer_organization_id: z.string().uuid(),
          buyer_agent_id: z.string().nullable().optional(),
          buyer_label: z.string().nullable().optional(),
        })
        .parse(body);
      const purchase = purchaseSvc.purchase({
        leadId: lead.id,
        reservationId: parsed.reservation_id,
        buyerOrganizationId: parsed.buyer_organization_id,
        buyerAgentId: parsed.buyer_agent_id,
        buyerLabel: parsed.buyer_label,
      });
      return NextResponse.json({ ok: true, purchase, lead });
    }

    if (action === "refresh") {
      inventory.refreshLifecycle(lead);
      return NextResponse.json({ ok: true, lead });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
