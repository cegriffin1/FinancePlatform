import { randomUUID } from "crypto";
import { getIntegrationStore } from "@/application/integrations/integrationStore";
import { getChannelProvider } from "@/infrastructure/providers/channels/mockChannelProviders";
import type { LiveAdProvider, NormalizedCampaignMetrics } from "@/domain/types/social-integrations";

export function normalizeProviderMetrics(
  raw: Record<string, unknown>,
): NormalizedCampaignMetrics {
  const num = (...keys: string[]) => {
    for (const key of keys) {
      const v = raw[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
        return Number(v);
      }
    }
    return 0;
  };

  let spend_cents = num("spend_cents");
  if (!spend_cents && raw.cost_micros != null) {
    spend_cents = Math.round(num("cost_micros") / 10_000);
  } else if (!spend_cents && raw.spend != null) {
    spend_cents = Math.round(num("spend") * 100);
  }

  let revenue_cents = num("revenue_cents");
  if (!revenue_cents && raw.revenue != null) {
    revenue_cents = Math.round(num("revenue") * 100);
  }

  return {
    impressions: num("impressions", "impression", "imps"),
    reach: num("reach", "unique_reach"),
    clicks: num("clicks", "link_clicks", "click"),
    spend_cents,
    leads: num("leads", "lead_count", "conversions_lead"),
    qualified_leads: num("qualified_leads", "qualified"),
    appointments: num("appointments"),
    conversions: num("conversions", "conversion"),
    revenue_cents,
    raw,
  };
}

export class CampaignMetricsSyncService {
  async syncCampaignChannel(input: {
    organizationId: string;
    campaignId: string;
    provider: LiveAdProvider;
    connectionId: string;
  }) {
    const adapter = getChannelProvider(input.provider);
    const metrics = await adapter.getCampaignMetrics({
      id: randomUUID(),
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      provider: input.provider,
      connected_account_id: input.connectionId,
      external_campaign_id: null,
      status: "live",
      metrics: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      updated_by: null,
    });

    const store = getIntegrationStore();
    const date = new Date().toISOString().slice(0, 10);
    store.metrics.push({
      id: randomUUID(),
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      provider: input.provider,
      date,
      metrics,
    });

    const connection = store.connections.find(
      (c) => c.id === input.connectionId && c.organization_id === input.organizationId,
    );
    if (connection) connection.last_synced_at = new Date().toISOString();

    return metrics;
  }

  getCampaignRollup(campaignId: string, organizationId: string) {
    const store = getIntegrationStore();
    const snaps = store.metrics.filter(
      (m) => m.campaign_id === campaignId && m.organization_id === organizationId,
    );
    const byProvider: Record<string, NormalizedCampaignMetrics> = {};
    for (const snap of snaps) {
      const prev = byProvider[snap.provider] ?? {
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend_cents: 0,
        leads: 0,
        qualified_leads: 0,
        appointments: 0,
        conversions: 0,
        revenue_cents: 0,
      };
      byProvider[snap.provider] = {
        impressions: prev.impressions + snap.metrics.impressions,
        reach: prev.reach + snap.metrics.reach,
        clicks: prev.clicks + snap.metrics.clicks,
        spend_cents: prev.spend_cents + snap.metrics.spend_cents,
        leads: prev.leads + snap.metrics.leads,
        qualified_leads: prev.qualified_leads + snap.metrics.qualified_leads,
        appointments: prev.appointments + snap.metrics.appointments,
        conversions: prev.conversions + snap.metrics.conversions,
        revenue_cents: prev.revenue_cents + snap.metrics.revenue_cents,
      };
    }
    return byProvider;
  }
}
