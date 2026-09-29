import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSimCampaign,
  launchSimCampaign,
  updateCampaignStatus,
  duplicateCampaign,
} from "@/application/growth/campaignService";
import type { CampaignOwnerType } from "@/domain/types/campaign-engine";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";

export async function POST(request: Request) {
  const auth = await requireOrgAuth({ permission: "campaigns.create" });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "save_draft") {
      const draft = z
        .object({
          owner_type: z.enum(["ALTUS_PLATFORM_CAMPAIGN", "SUBSCRIBER_CAMPAIGN"]),
          name: z.string().min(2),
          goal: z.string().optional(),
          channels: z.array(z.string()).optional(),
          locations: z.array(z.string()).optional(),
          budget: z.number().optional(),
          budget_mode: z.enum(["daily", "total"]).optional(),
        })
        .parse(body.draft);

      const existingId =
        typeof body.draftId === "string" && body.draftId.length > 0
          ? body.draftId
          : null;

      if (existingId) {
        const { getSimStore } = await import(
          "@/application/growth/simulationStore"
        );
        const store = getSimStore();
        const existing = store.campaigns.find((c) => c.id === existingId);
        if (existing && existing.status === "draft") {
          existing.name = draft.name;
          existing.updated_at = new Date().toISOString();
          if (draft.budget != null) {
            existing.budget_cents = Math.round(draft.budget * 100);
          }
          if (draft.budget_mode) existing.budget_mode = draft.budget_mode;
          return NextResponse.json({ ok: true, campaignId: existing.id });
        }
      }

      const orgSlug =
        draft.owner_type === "ALTUS_PLATFORM_CAMPAIGN" ? "altus" : "demo-org";
      const campaign = createSimCampaign({
        owner_type: draft.owner_type as CampaignOwnerType,
        owner_id: "20000000-0000-4000-8000-000000000099",
        organization_id:
          draft.owner_type === "SUBSCRIBER_CAMPAIGN"
            ? "20000000-0000-4000-8000-000000000003"
            : null,
        organization_slug: orgSlug,
        name: draft.name,
        description: "Draft campaign",
        goal: "generate_leads",
        strategy: "Retirement",
        audience: { personas: ["professional"] },
        territories: draft.locations?.includes("Nationwide")
          ? ["US"]
          : draft.locations?.length
            ? draft.locations
            : ["FL"],
        channels: (draft.channels?.length
          ? Array.from(
              new Set(
                draft.channels.map((c) =>
                  c === "facebook" || c === "instagram" ? "meta" : c,
                ),
              ),
            )
          : ["linkedin"]) as never,
        destination: "interactive_assessment",
        budget_cents:
          draft.budget != null ? Math.round(draft.budget * 100) : 300000,
        template_id: null,
        branding: {
          organization_name: "ALTUS",
          custom_cta: "Start Assessment",
        },
        qualification_template_key: "retirement-opportunity-v1",
        distribution_config: { method: "campaign_owner" },
        budget_mode: draft.budget_mode,
      });
      return NextResponse.json({ ok: true, campaignId: campaign.id });
    }

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
          qualification_template_key: z.string().optional(),
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
          custom_cta: "Start My Assessment",
        },
        qualification_template_key:
          draft.qualification_template_key ??
          (draft.strategy.toLowerCase().includes("retirement")
            ? "retirement-opportunity-v1"
            : "business-growth-assessment-v1"),
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
