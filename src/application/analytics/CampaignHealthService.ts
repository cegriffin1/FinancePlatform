/**
 * Campaign health — cohort-aware lead quality.
 * Cold leads on aged cohorts do not alone mark a campaign unhealthy.
 */

import type { SimCampaign, SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import {
  toOperationalTemperature,
  type OperationalTemperature,
} from "@/domain/types/lead-lifecycle";
import { getLifecycleConfig } from "@/application/lifecycle/LeadLifecycleService";

export type ChannelHealthRow = {
  channel: string;
  spend_cents: number;
  leads: number;
  hot: number;
  medium: number;
  cold: number;
  asset_250k_plus: number;
  avg_opportunity_score: number;
  appointments: number;
  opportunities: number;
  recycled: number;
  resold: number;
  cost_per_qualified_opportunity: number | null;
};

export type CohortTemperaturePoint = {
  day: number;
  hot: number;
  medium: number;
  cold: number;
};

export class CampaignHealthService {
  leadQuality(leads: SimLead[]) {
    const config = getLifecycleConfig();
    const bucket = (t: OperationalTemperature) =>
      leads.filter(
        (l) =>
          (l.operational_temperature ??
            toOperationalTemperature(l.temperature_key, config)) === t,
      ).length;

    return {
      hot: bucket("HOT"),
      medium: bucket("MEDIUM"),
      cold: bucket("COLD"),
      qualified_250k_plus: leads.filter((l) => {
        const band = l.assessment_answers.repositionable_assets ?? "";
        return /\$250K|\$500K|\$750K|\$1M|\$2M|\$5M/i.test(band);
      }).length,
      setter_confirmed: leads.filter(
        (l) =>
          l.qualification?.asset.verification_status === "SETTER_CONFIRMED" ||
          l.setter_verification?.asset_verification_status === "SETTER_CONFIRMED",
      ).length,
      appointments: leads.filter((l) => (l.appointments?.length ?? 0) > 0).length,
      recycled: leads.filter((l) => l.recycled).length,
    };
  }

  campaignSummary(campaign: SimCampaign, leads: SimLead[]) {
    const cohort = leads.filter((l) => l.campaign_id === campaign.id);
    const quality = this.leadQuality(cohort);
    const ageDays =
      cohort.length === 0
        ? 0
        : Math.floor(
            (Date.now() -
              Math.min(
                ...cohort.map((l) => new Date(l.created_at).getTime()),
              )) /
              (24 * 60 * 60 * 1000),
          );

    // Do not flag unhealthy merely because older leads cooled
    const coldRatio =
      cohort.length === 0 ? 0 : quality.cold / Math.max(1, cohort.length);
    const expectedColdFloor = ageDays >= 45 ? 0.55 : ageDays >= 30 ? 0.4 : 0.25;
    const unhealthyFromCold = coldRatio > expectedColdFloor + 0.25;

    return {
      campaign_id: campaign.id,
      name: campaign.name,
      cohort_age_days: ageDays,
      lead_quality: quality,
      analytics: {
        fresh_leads: campaign.analytics.leads,
        hot_leads: campaign.analytics.hot_leads,
        medium_leads: campaign.analytics.medium_leads ?? quality.medium,
        cold_leads: campaign.analytics.cold_leads ?? quality.cold,
        recycled_leads: campaign.analytics.recycled_leads ?? quality.recycled,
        marketplace_eligible: campaign.analytics.marketplace_eligible ?? 0,
        resold_leads: campaign.analytics.resold_leads ?? 0,
        original_lead_revenue_cents:
          campaign.analytics.original_lead_revenue_cents ?? 0,
        recycled_lead_revenue_cents:
          campaign.analytics.recycled_lead_revenue_cents ?? 0,
      },
      unhealthy_from_cold_alone: unhealthyFromCold,
      note: "Campaign health considers cohort age; older cohorts naturally accumulate cold leads.",
    };
  }

  channelComparison(campaignId?: string): ChannelHealthRow[] {
    const store = getSimStore();
    const leads = campaignId
      ? store.leads.filter((l) => l.campaign_id === campaignId)
      : store.leads;
    const channels = ["facebook", "instagram", "linkedin", "tiktok"];

    return channels.map((channel) => {
      const subset = leads.filter((l) => {
        const src = (
          l.attribution.ad_provider ??
          l.attribution.source ??
          l.attribution.utm_source ??
          ""
        ).toLowerCase();
        return src.includes(channel) || src.includes(channel.slice(0, 2));
      });
      const quality = this.leadQuality(subset);
      const opportunities = subset.filter(
        (l) =>
          l.outcome === "Qualified Opportunity" ||
          l.pipeline_stage === "OPPORTUNITY",
      ).length;
      const avg =
        subset.length === 0
          ? 0
          : Math.round(
              subset.reduce(
                (s, l) => s + (l.aging?.original_score ?? l.score),
                0,
              ) / subset.length,
            );
      const spend = 0; // spend wiring is campaign-budget driven; placeholder
      return {
        channel,
        spend_cents: spend,
        leads: subset.length,
        hot: quality.hot,
        medium: quality.medium,
        cold: quality.cold,
        asset_250k_plus: quality.qualified_250k_plus,
        avg_opportunity_score: avg,
        appointments: quality.appointments,
        opportunities,
        recycled: quality.recycled,
        resold: subset.filter((l) => (l.purchase_history?.length ?? 0) > 0)
          .length,
        cost_per_qualified_opportunity:
          opportunities > 0 && spend > 0 ? Math.round(spend / opportunities) : null,
      };
    });
  }

  /**
   * Cohort temperature trajectory using temperature_snapshots + test clock days.
   */
  cohortTemperatureTrajectory(
    leads: SimLead[],
    days: number[] = [0, 7, 14, 30, 45, 60],
  ): CohortTemperaturePoint[] {
    return days.map((day) => {
      let hot = 0;
      let medium = 0;
      let cold = 0;
      for (const lead of leads) {
        const snaps = lead.temperature_snapshots ?? [];
        const created = new Date(lead.created_at).getTime();
        const cutoff = created + day * 24 * 60 * 60 * 1000;
        const atDay =
          [...snaps]
            .reverse()
            .find((s) => new Date(s.calculated_at).getTime() <= cutoff) ??
          snaps[0];
        const t =
          atDay?.temperature ??
          lead.operational_temperature ??
          "MEDIUM";
        if (t === "HOT") hot += 1;
        else if (t === "COLD") cold += 1;
        else medium += 1;
      }
      return { day, hot, medium, cold };
    });
  }
}
