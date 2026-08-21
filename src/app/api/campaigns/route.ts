import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSimCampaign,
  launchSimCampaign,
  updateCampaignStatus,
  duplicateCampaign,
} from "@/application/growth/campaignService";
import type { CampaignOwnerType } from "@/domain/types/campaign-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "create_and_launch") {
      const draft = z
        .object({
          owner_type: z.enum(["ALTUS_PLATFORM_CAMPAIGN", "SUBSCRIBER_CAMPAIGN"]),
          name: z.string().min(2),
          description: z.string().optional().default(""),
          goal: z.string(),
          strategy: z.string(),
          secondary_strategies: z.array(z.string()).optional().default([]),
          audience: z.record(z.any()),
          territories: z.array(z.string()).min(1),
          channels: z.array(z.string()).min(1),
          destination: z.string(),
          budget_cents: z.number().nullable(),
          budget_mode: z.enum(["daily", "total"]).optional(),
          start_date: z.string().nullable().optional(),
          end_date: z.string().nullable().optional(),
          target_lead_count: z.number().nullable().optional(),
          landing_headline: z.string().optional(),
          landing_support: z.string().optional(),
          branding: z.record(z.any()).optional(),
          organization_slug: z.string().optional(),
        })
        .parse(body.draft);

      const orgSlug =
        draft.organization_slug ??
        (draft.owner_type === "ALTUS_PLATFORM_CAMPAIGN" ? "altus" : "demo-org");

      const campaign = createSimCampaign({
        owner_type: draft.owner_type as CampaignOwnerType,
        owner_id: "20000000-0000-4000-8000-000000000099",
        organization_id:
          draft.owner_type === "SUBSCRIBER_CAMPAIGN"
            ? "20000000-0000-4000-8000-000000000003"
            : null,
        organization_slug: orgSlug,
        name: draft.name,
        description: draft.description,
        goal: draft.goal as never,
        strategy: draft.strategy,
        audience: draft.audience as never,
        territories: draft.territories,
        channels: draft.channels as never,
        destination: draft.destination as never,
        budget_cents: draft.budget_cents,
        template_id: null,
        branding: (draft.branding as never) ?? {
          organization_name: "ALTUS",
          custom_cta: "Start Assessment",
        },
        qualification_template_key: "business-growth-assessment-v1",
        distribution_config:
          draft.owner_type === "ALTUS_PLATFORM_CAMPAIGN"
            ? { method: "priority_tier", preferPremierForPriority: true }
            : { method: "campaign_owner" },
        secondary_strategies: draft.secondary_strategies,
        budget_mode: draft.budget_mode,
        start_date: draft.start_date,
        end_date: draft.end_date,
        target_lead_count: draft.target_lead_count,
        landing_headline: draft.landing_headline,
        landing_support: draft.landing_support,
      });

      const launched = launchSimCampaign(campaign.id);
      return NextResponse.json({
        ok: true,
        campaign: launched,
        publicPath: `/c/${launched.organization_slug}/${launched.slug}`,
      });
    }

    if (action === "status") {
      const parsed = z
        .object({
          campaignId: z.string().uuid(),
          status: z.enum(["paused", "active_simulation", "archived"]),
        })
        .parse(body);
      const campaign = updateCampaignStatus(parsed.campaignId, parsed.status);
      return NextResponse.json({ ok: true, campaign });
    }

    if (action === "duplicate") {
      const parsed = z.object({ campaignId: z.string().uuid() }).parse(body);
      const campaign = duplicateCampaign(parsed.campaignId);
      return NextResponse.json({ ok: true, campaign });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
