import { NextResponse } from "next/server";
import { z } from "zod";
import { CampaignPublishingService } from "@/application/integrations/CampaignPublishingService";
import { CampaignMetricsSyncService } from "@/application/integrations/CampaignMetricsSyncService";
import { getIntegrationStore } from "@/application/integrations/integrationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { runQueuedIntegrationJobs } from "@/application/integrations/registerJobs";
import type { ChannelProviderConfig } from "@/domain/types/social-integrations";
import { enforceInternalApiAccess } from "@/infrastructure/security/internalApiGate";

const DEMO_ORG = "20000000-0000-4000-8000-000000000003";

export async function POST(request: Request) {
  const denied = await enforceInternalApiAccess();
  if (denied) return denied;

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "publish") {
      const parsed = z
        .object({
          campaignId: z.string().uuid(),
          confirmationAccepted: z.literal(true),
          channelConfigs: z.array(z.any()).min(1),
          permissions: z
            .array(z.string())
            .default([
              "campaigns.publish",
              "campaigns.approve",
              "campaigns.budget.manage",
            ]),
        })
        .parse(body);

      const campaign = getSimStore().campaigns.find((c) => c.id === parsed.campaignId);
      if (!campaign) throw new Error("Campaign not found");
      if (
        campaign.organization_id &&
        campaign.organization_id !== DEMO_ORG &&
        campaign.owner_type === "SUBSCRIBER_CAMPAIGN"
      ) {
        // tenant isolation
        throw new Error("Campaign does not belong to this organization");
      }

      const service = new CampaignPublishingService();
      const result = await service.publish({
        organizationId: DEMO_ORG,
        campaign: {
          ...campaign,
          organization_id: campaign.organization_id ?? DEMO_ORG,
          status: campaign.status === "active_simulation" ? "approved" : campaign.status,
        },
        channelConfigs: parsed.channelConfigs as ChannelProviderConfig[],
        approvedBy: null,
        confirmationAccepted: parsed.confirmationAccepted,
        permissions: parsed.permissions,
      });

      if (result.status === "active" || result.status === "publishing") {
        campaign.status = "active";
        campaign.launched_at = new Date().toISOString();
      }

      await runQueuedIntegrationJobs(10);
      return NextResponse.json({ ok: true, result });
    }

    if (action === "sync_metrics") {
      const parsed = z
        .object({
          campaignId: z.string().uuid(),
          provider: z.enum(["meta", "linkedin", "google"]),
        })
        .parse(body);
      const store = getIntegrationStore();
      const connection = store.connections.find(
        (c) =>
          c.organization_id === DEMO_ORG &&
          c.provider === parsed.provider &&
          c.status === "CONNECTED",
      );
      if (!connection) throw new Error("Provider not connected");
      const metrics = await new CampaignMetricsSyncService().syncCampaignChannel({
        organizationId: DEMO_ORG,
        campaignId: parsed.campaignId,
        provider: parsed.provider,
        connectionId: connection.id,
      });
      return NextResponse.json({ ok: true, metrics });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
