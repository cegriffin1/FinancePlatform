import { NextResponse } from "next/server";
import { z } from "zod";
import { getSimStore } from "@/application/growth/simulationStore";
import {
  getLifecycleConfig,
  updateLifecycleConfig,
  LeadLifecycleJob,
  LeadLifecycleAgingService,
  LeadRecyclingEligibilityService,
  LeadOwnershipReleaseService,
  LeadEngagementService,
  LeadTemperatureTransitionService,
} from "@/application/lifecycle/LeadLifecycleService";
import { LeadInventoryService } from "@/application/inventory/LeadInventoryService";
import { CampaignHealthService } from "@/application/analytics/CampaignHealthService";

function requireAdmin(request: Request) {
  return request.headers.get("x-altus-role") === "admin";
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const store = getSimStore();
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "config";

  if (view === "inventory") {
    const buckets = new LeadInventoryService().adminBuckets(store.leads);
    return NextResponse.json({
      buckets,
      lifecycle_config: getLifecycleConfig(),
      notification_preferences: store.notification_preferences,
    });
  }

  if (view === "health") {
    const health = new CampaignHealthService();
    const campaigns = store.campaigns.map((c) =>
      health.campaignSummary(c, store.leads),
    );
    return NextResponse.json({
      campaigns,
      channels: health.channelComparison(),
      lead_quality: health.leadQuality(store.leads),
    });
  }

  return NextResponse.json({
    lifecycle_config: getLifecycleConfig(),
    notification_preferences: store.notification_preferences,
    ownership_config: store.ownership_config,
    pricing_config: store.pricing_config,
  });
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const action = body.action as string;
  const store = getSimStore();

  if (action === "update_lifecycle_config") {
    const parsed = z
      .object({
        hot_min_score: z.number().optional(),
        medium_min_score: z.number().optional(),
        cold_after_days: z.number().int().positive().optional(),
        recycle_after_days: z.number().int().positive().optional(),
        ownership_duration_days: z.number().int().positive().optional(),
        recycling_warning_days: z.array(z.number().int()).optional(),
        max_ownership_extensions_days: z.number().int().positive().optional(),
        version: z.string().optional(),
      })
      .parse(body.config ?? body);
    const config = updateLifecycleConfig(parsed);
    if (parsed.ownership_duration_days) {
      store.ownership_config = {
        ownership_period_days: parsed.ownership_duration_days,
      };
      store.inventory_config = {
        ...store.inventory_config,
        ownership_period_days: parsed.ownership_duration_days,
      };
    }
    return NextResponse.json({ ok: true, lifecycle_config: config });
  }

  if (action === "update_notification_preferences") {
    const parsed = z
      .object({
        organization_id: z.string(),
        recycling_warnings: z.boolean().optional(),
        temperature_changes: z.boolean().optional(),
        marketplace: z.boolean().optional(),
      })
      .parse(body);
    const existing = store.notification_preferences[parsed.organization_id] ?? {
      recycling_warnings: true,
      temperature_changes: true,
      marketplace: true,
    };
    store.notification_preferences[parsed.organization_id] = {
      recycling_warnings:
        parsed.recycling_warnings ?? existing.recycling_warnings,
      temperature_changes:
        parsed.temperature_changes ?? existing.temperature_changes,
      marketplace: parsed.marketplace ?? existing.marketplace,
    };
    return NextResponse.json({
      ok: true,
      notification_preferences: store.notification_preferences,
    });
  }

  if (action === "run_lifecycle_job") {
    const now = typeof body.now === "number" ? body.now : Date.now();
    const results = new LeadLifecycleJob().runAll(now);
    return NextResponse.json({ ok: true, results });
  }

  if (action === "evaluate_eligibility") {
    const lead = store.leads.find((l) => l.id === body.lead_id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const eligibility = new LeadRecyclingEligibilityService().evaluate(
      lead,
      typeof body.now === "number" ? body.now : Date.now(),
    );
    return NextResponse.json({ ok: true, eligibility });
  }

  if (action === "release_ownership") {
    const lead = store.leads.find((l) => l.id === body.lead_id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = new LeadOwnershipReleaseService().releaseIfEligible(
      lead,
      body.reason ?? "admin_release",
      typeof body.now === "number" ? body.now : Date.now(),
    );
    return NextResponse.json({ ok: true, result, lead });
  }

  if (action === "record_engagement") {
    const lead = store.leads.find((l) => l.id === body.lead_id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const engagement = new LeadEngagementService();
    if (body.meaningful === false) {
      engagement.recordSystemActivity(lead, body.type ?? "agent_opened_lead");
    } else {
      new LeadLifecycleAgingService().reheat(
        lead,
        body.type ?? "prospect_replied_sms",
        typeof body.now === "number" ? body.now : Date.now(),
      );
    }
    return NextResponse.json({ ok: true, lead });
  }

  if (action === "seed_temperature") {
    const lead = store.leads.find((l) => l.id === body.lead_id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    new LeadTemperatureTransitionService().seedInitial(
      lead,
      body.temperature_score ?? lead.score,
      body.fine_grained ?? lead.temperature_key,
      body.reason ?? "admin seed",
    );
    return NextResponse.json({ ok: true, lead });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
