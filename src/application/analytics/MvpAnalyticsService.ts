import type { SimCampaign, SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";

function safeDiv(num: number, den: number) {
  if (!den || den <= 0) return null;
  return Math.round(num / den);
}

function assetMinCents(lead: SimLead): number {
  return lead.qualification?.asset.repositionable_min_cents ?? 0;
}

export type ExecutiveMetrics = {
  ad_spend_cents: number | null;
  clicks: number | null;
  assessment_starts: number;
  completed_profiles: number;
  qualified_250k_plus: number;
  setter_verified: number;
  appointments: number;
  opportunities: number;
  won: number;
  lost: number;
  cost_per_assessment_cents: number | null;
  cost_per_qualified_opportunity_cents: number | null;
  cost_per_verified_opportunity_cents: number | null;
  cost_per_appointment_cents: number | null;
  /** Primary KPI */
  primary_kpi: "COST_PER_QUALIFIED_OPPORTUNITY";
  spend_data_available: boolean;
};

export type ChannelComparisonRow = {
  channel: string;
  clicks: number | null;
  completion: number;
  asset_250k: number;
  asset_500k: number;
  asset_1m: number;
  high_priority: number;
  setter_verified: number;
  appointments: number;
  opportunities: number;
  wins: number;
  spend_cents: number | null;
  cost_per_qualified_opportunity_cents: number | null;
};

/**
 * Never fabricates advertising data — null when spend/clicks unavailable.
 */
export class MvpAnalyticsService {
  buildExecutive(leads: SimLead[], campaigns: SimCampaign[]): ExecutiveMetrics {
    const spendParts = campaigns.map((c) => (c as { spend_cents?: number }).spend_cents);
    const spendAvailable = spendParts.some((s) => typeof s === "number" && s > 0);
    const ad_spend_cents = spendAvailable
      ? spendParts.reduce<number>((sum, s) => sum + (typeof s === "number" ? s : 0), 0)
      : null;

    const clicksParts = campaigns.map((c) => c.analytics.views);
    const clicks =
      clicksParts.some((v) => v > 0) ? clicksParts.reduce((a, b) => a + b, 0) : null;

    const assessment_starts = campaigns.reduce(
      (s, c) => s + c.analytics.assessment_starts,
      0,
    );
    const completed_profiles = campaigns.reduce(
      (s, c) => s + c.analytics.assessment_completions,
      0,
    );
    const qualified_250k_plus = leads.filter(
      (l) => assetMinCents(l) >= 25_000_000,
    ).length;
    const setter_verified = leads.filter(
      (l) =>
        l.qualification?.asset.verification_status === "SETTER_CONFIRMED" ||
        l.setter_verification?.asset_verification_status === "SETTER_CONFIRMED",
    ).length;
    const appointments = leads.filter((l) => (l.appointments?.length ?? 0) > 0).length;
    const opportunities = leads.filter(
      (l) =>
        l.pipeline_stage === "OPPORTUNITY" ||
        l.outcome === "Qualified Opportunity" ||
        l.outcome === "Won",
    ).length;
    const won = leads.filter((l) => l.outcome === "Won").length;
    const lost = leads.filter(
      (l) =>
        l.outcome === "Lost" ||
        l.outcome === "Not Interested" ||
        l.outcome === "Wrong Fit",
    ).length;

    const qualifiedOpps = Math.max(qualified_250k_plus, opportunities);

    return {
      ad_spend_cents,
      clicks,
      assessment_starts: assessment_starts || completed_profiles,
      completed_profiles,
      qualified_250k_plus,
      setter_verified,
      appointments,
      opportunities,
      won,
      lost,
      cost_per_assessment_cents: safeDiv(ad_spend_cents ?? 0, completed_profiles || 0),
      cost_per_qualified_opportunity_cents: safeDiv(ad_spend_cents ?? 0, qualifiedOpps),
      cost_per_verified_opportunity_cents: safeDiv(ad_spend_cents ?? 0, setter_verified),
      cost_per_appointment_cents: safeDiv(ad_spend_cents ?? 0, appointments),
      primary_kpi: "COST_PER_QUALIFIED_OPPORTUNITY",
      spend_data_available: spendAvailable,
    };
  }

  compareChannels(leads: SimLead[], campaigns: SimCampaign[]): ChannelComparisonRow[] {
    const channels = ["meta", "instagram", "google", "linkedin"] as const;
    return channels.map((channel) => {
      const channelCampaigns = campaigns.filter((c) =>
        c.channels.some((ch) => ch.toLowerCase().includes(channel === "instagram" ? "meta" : channel) ||
          (channel === "instagram" && ch.toLowerCase().includes("instagram"))),
      );
      const channelLeads = leads.filter((l) => {
        const src = (
          l.attribution.ad_provider ??
          l.attribution.source ??
          ""
        ).toLowerCase();
        if (channel === "instagram") {
          return src.includes("instagram") || src.includes("meta");
        }
        return src.includes(channel);
      });

      const spendParts = channelCampaigns.map(
        (c) => (c as { spend_cents?: number }).spend_cents,
      );
      const spendAvailable = spendParts.some((s) => typeof s === "number" && s > 0);
      const spend_cents = spendAvailable
        ? spendParts.reduce<number>((sum, s) => sum + (typeof s === "number" ? s : 0), 0)
        : null;

      const completion = channelLeads.length;
      const asset_250k = channelLeads.filter((l) => assetMinCents(l) >= 25_000_000).length;
      const asset_500k = channelLeads.filter((l) => assetMinCents(l) >= 50_000_000).length;
      const asset_1m = channelLeads.filter((l) => assetMinCents(l) >= 100_000_000).length;
      const high_priority = channelLeads.filter(
        (l) =>
          (l.qualification?.opportunity.opportunity_score ?? l.score) >= 80 ||
          ["HOT", "VERY_HOT", "READY_NOW", "PRIORITY"].includes(
            l.qualification?.temperature.temperature ?? l.temperature_key,
          ),
      ).length;
      const setter_verified = channelLeads.filter(
        (l) =>
          l.qualification?.asset.verification_status === "SETTER_CONFIRMED",
      ).length;
      const appointments = channelLeads.filter(
        (l) => (l.appointments?.length ?? 0) > 0,
      ).length;
      const opportunities = channelLeads.filter(
        (l) => l.pipeline_stage === "OPPORTUNITY" || l.outcome === "Won",
      ).length;
      const wins = channelLeads.filter((l) => l.outcome === "Won").length;
      const clicks = channelCampaigns.some((c) => c.analytics.views > 0)
        ? channelCampaigns.reduce((s, c) => s + c.analytics.views, 0)
        : null;

      return {
        channel,
        clicks,
        completion,
        asset_250k,
        asset_500k,
        asset_1m,
        high_priority,
        setter_verified,
        appointments,
        opportunities,
        wins,
        spend_cents,
        cost_per_qualified_opportunity_cents: safeDiv(
          spend_cents ?? 0,
          Math.max(asset_250k, opportunities),
        ),
      };
    });
  }

  fromStore() {
    const store = getSimStore();
    return {
      executive: this.buildExecutive(store.leads, store.campaigns),
      channels: this.compareChannels(store.leads, store.campaigns),
    };
  }
}
