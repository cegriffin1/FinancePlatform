import { describe, expect, it, beforeEach } from "vitest";
import {
  resetIntegrationStore,
  upsertSimConnection,
  getIntegrationStore,
  publicConnectionView,
} from "@/application/integrations/integrationStore";
import { CampaignPublishingService } from "@/application/integrations/CampaignPublishingService";
import {
  normalizeProviderMetrics,
  CampaignMetricsSyncService,
} from "@/application/integrations/CampaignMetricsSyncService";
import {
  ingestNativeProviderLead,
  verifyWebhookSignature,
} from "@/application/integrations/nativeLeadIngestion";
import {
  createSimCampaign,
  launchSimCampaign,
} from "@/application/growth/campaignService";
import { resetSimStore } from "@/application/growth/simulationStore";
import { CHANNEL_CAPABILITIES } from "@/domain/types/social-integrations";
import { MetaAdsProvider } from "@/infrastructure/providers/channels/mockChannelProviders";
import { enqueueJob, resetJobQueue, drainJobs } from "@/infrastructure/jobs/jobQueue";
import { ensureIntegrationJobHandlers } from "@/application/integrations/registerJobs";
import { openTokenBundle } from "@/infrastructure/security/credentialVault";
import { hasPermission } from "@/domain/permissions/keys";

const ORG = "20000000-0000-4000-8000-000000000003";

beforeEach(() => {
  resetIntegrationStore();
  resetSimStore();
  resetJobQueue();
  ensureIntegrationJobHandlers();
});

describe("provider capabilities", () => {
  it("exposes normalized capability flags per provider", () => {
    expect(CHANNEL_CAPABILITIES.meta.supportsPlacements).toBe(true);
    expect(CHANNEL_CAPABILITIES.linkedin.supportsCompanyTargeting).toBe(true);
    expect(CHANNEL_CAPABILITIES.google.supportsSearchKeywords).toBe(true);
    expect(MetaAdsProvider.capabilities.supportsNativeLeadCapture).toBe(true);
  });
});

describe("credential vault", () => {
  it("does not expose credential_ref in public connection view", () => {
    const conn = upsertSimConnection({
      organizationId: ORG,
      provider: "meta",
      accountName: "Test Ads",
    });
    const publicView = publicConnectionView(conn);
    expect(publicView).not.toHaveProperty("credential_ref");
    const opened = openTokenBundle(conn.credential_ref);
    expect(opened.access_token).toContain("sim_access");
  });
});

describe("metrics normalization", () => {
  it("maps provider raw fields into ALTUS metrics", () => {
    const normalized = normalizeProviderMetrics({
      impressions: 1000,
      clicks: 50,
      spend_cents: 2500,
      leads: 4,
    });
    expect(normalized.impressions).toBe(1000);
    expect(normalized.clicks).toBe(50);
    expect(normalized.spend_cents).toBe(2500);
    expect(normalized.leads).toBe(4);
  });
});

describe("publishing idempotency + permissions", () => {
  it("requires confirmation and publish permissions", async () => {
    const service = new CampaignPublishingService();
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: ORG,
      organization_id: ORG,
      organization_slug: "demo-org",
      name: "Publish Test",
      description: "",
      goal: "generate_leads",
      strategy: "Tax Strategy",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 50000,
      template_id: null,
      branding: { organization_name: "Demo" },
      qualification_template_key: "business-growth-assessment-v1",
      distribution_config: {},
    });
    launchSimCampaign(campaign.id);

    const denied = await service.publish({
      organizationId: ORG,
      campaign: { ...campaign, organization_id: ORG },
      channelConfigs: [
        {
          provider: "meta",
          config: {
            placements: ["facebook"],
            objective: "OUTCOME_LEADS",
            daily_budget_cents: 5000,
            cta: "LEARN_MORE",
          },
        },
      ],
      approvedBy: null,
      confirmationAccepted: false,
      permissions: [],
    });
    expect(denied.status).toBe("publish_failed");

    upsertSimConnection({
      organizationId: ORG,
      provider: "meta",
      accountName: "Demo Meta",
    });

    const first = await service.publish({
      organizationId: ORG,
      campaign: { ...campaign, organization_id: ORG },
      channelConfigs: [
        {
          provider: "meta",
          config: {
            placements: ["facebook", "instagram"],
            objective: "OUTCOME_LEADS",
            daily_budget_cents: 5000,
            cta: "LEARN_MORE",
          },
        },
      ],
      approvedBy: null,
      confirmationAccepted: true,
      permissions: ["campaigns.publish", "campaigns.approve"],
    });
    expect(first.status).toBe("active");
    const externalId = first.runs[0]?.external_campaign_id;
    expect(externalId).toBeTruthy();

    const second = await service.publish({
      organizationId: ORG,
      campaign: { ...campaign, organization_id: ORG },
      channelConfigs: [
        {
          provider: "meta",
          config: {
            placements: ["facebook"],
            objective: "OUTCOME_LEADS",
            daily_budget_cents: 5000,
            cta: "LEARN_MORE",
          },
        },
      ],
      approvedBy: null,
      confirmationAccepted: true,
      permissions: ["campaigns.publish", "campaigns.approve"],
    });
    expect(second.runs[0]?.external_campaign_id).toBe(externalId);
    expect(getIntegrationStore().publishes.filter((p) => p.status === "published")).toHaveLength(1);
  });
});

describe("native lead ingestion", () => {
  it("deduplicates webhook events and preserves attribution", async () => {
    expect(verifyWebhookSignature("meta", "{}", null)).toBe(true);

    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: ORG,
      organization_id: ORG,
      organization_slug: "demo-org",
      name: "Ingest Test",
      description: "",
      goal: "generate_leads",
      strategy: "Tax Strategy",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 50000,
      template_id: null,
      branding: { organization_name: "Demo" },
      qualification_template_key: "business-growth-assessment-v1",
      distribution_config: {},
    });
    launchSimCampaign(campaign.id);

    const store = getIntegrationStore();
    store.mappings.push({
      id: crypto.randomUUID(),
      organization_id: ORG,
      provider: "meta",
      internal_entity_type: "campaign",
      internal_entity_id: campaign.id,
      external_entity_type: "campaign",
      external_entity_id: "meta_ext_1",
      account_id: "acct",
      created_at: new Date().toISOString(),
      last_synced_at: null,
    });

    const first = await ingestNativeProviderLead({
      provider: "meta",
      external_event_id: "evt_1",
      external_campaign_id: "meta_ext_1",
      contact: {
        firstName: "Jordan",
        lastName: "Blake",
        businessName: "Blake Co",
        email: "jordan.blake@example.com",
        phone: "3055550199",
        state: "FL",
      },
    });
    expect(first.duplicate).toBe(false);
    expect(first.lead?.attribution.ad_provider).toBe("meta");
    expect(first.lead?.attribution.external_campaign_id).toBe("meta_ext_1");
    expect(first.lead?.score).toBeGreaterThan(0);

    const second = await ingestNativeProviderLead({
      provider: "meta",
      external_event_id: "evt_1",
      external_campaign_id: "meta_ext_1",
      contact: {
        firstName: "Jordan",
        lastName: "Blake",
        email: "jordan.blake@example.com",
      },
    });
    expect(second.duplicate).toBe(true);
  });
});

describe("metrics sync + jobs", () => {
  it("stores daily snapshots via job queue", async () => {
    const conn = upsertSimConnection({
      organizationId: ORG,
      provider: "linkedin",
      accountName: "LI",
    });
    enqueueJob({
      type: "sync_metrics",
      organization_id: ORG,
      payload: {
        campaignId: "10000000-0000-4000-8000-000000000099",
        provider: "linkedin",
        connectionId: conn.id,
      },
    });
    await drainJobs(5);
    expect(getIntegrationStore().metrics.length).toBeGreaterThan(0);
    const rollup = new CampaignMetricsSyncService().getCampaignRollup(
      "10000000-0000-4000-8000-000000000099",
      ORG,
    );
    expect(rollup.linkedin?.clicks).toBeGreaterThan(0);
  });
});

describe("budget permissions", () => {
  it("includes new campaign budget and publish permissions", () => {
    expect(hasPermission(["campaigns.budget.manage"], "campaigns.budget.manage")).toBe(
      true,
    );
    expect(hasPermission(["campaigns.approve"], "campaigns.approve")).toBe(true);
    expect(hasPermission(["campaigns.view"], "campaigns.publish")).toBe(false);
  });
});
