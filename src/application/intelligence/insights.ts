import type {
  CampaignQualityMetrics,
  OptimizationRecommendation,
} from "@/domain/types/lead-intelligence";
import { randomUUID } from "crypto";

export class CampaignQualityService {
  compute(input: {
    raw_leads: number;
    accepted_leads: number;
    qualified_leads: number;
    hot_leads: number;
    priority_leads: number;
    appointments: number;
    opportunities: number;
    wins: number;
    invalid: number;
    duplicates: number;
    contacted: number;
  }): CampaignQualityMetrics {
    const raw = Math.max(input.raw_leads, 1);
    const accepted = Math.max(input.accepted_leads, 0);
    const invalid_rate = input.invalid / raw;
    const duplicate_rate = input.duplicates / raw;
    const contact_rate = input.contacted / raw;
    const appointment_rate = input.appointments / raw;
    const opportunity_rate = input.opportunities / raw;
    const win_rate = input.wins / raw;

    const quality_score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (accepted / raw) * 25 +
            (input.qualified_leads / raw) * 25 +
            appointment_rate * 100 * 0.2 +
            opportunity_rate * 100 * 0.15 +
            win_rate * 100 * 0.1 +
            (1 - invalid_rate) * 5,
        ),
      ),
    );

    return {
      raw_leads: input.raw_leads,
      accepted_leads: input.accepted_leads,
      qualified_leads: input.qualified_leads,
      hot_leads: input.hot_leads,
      priority_leads: input.priority_leads,
      appointments: input.appointments,
      opportunities: input.opportunities,
      wins: input.wins,
      invalid_rate,
      duplicate_rate,
      contact_rate,
      appointment_rate,
      opportunity_rate,
      win_rate,
      quality_score,
    };
  }
}

export class CampaignOptimizationService {
  recommend(input: {
    organizationId: string | null;
    campaignId: string | null;
    channels: Array<{
      channel: string;
      leads: number;
      qualified: number;
      appointments: number;
      opportunities: number;
    }>;
    invalidRate: number;
    topSegment?: string | null;
  }): OptimizationRecommendation[] {
    const recs: OptimizationRecommendation[] = [];
    const now = new Date().toISOString();

    const ranked = [...input.channels].sort((a, b) => {
      const aq = a.leads ? a.opportunities / a.leads : 0;
      const bq = b.leads ? b.opportunities / b.leads : 0;
      return bq - aq;
    });

    if (ranked.length >= 2 && ranked[0] && ranked[1] && ranked[1].leads > 0) {
      const best = ranked[0];
      const other = ranked[1];
      const bestRate = best.leads ? best.opportunities / best.leads : 0;
      const otherRate = other.opportunities / other.leads;
      if (otherRate > 0 && bestRate / otherRate >= 1.5) {
        recs.push({
          id: randomUUID(),
          organization_id: input.organizationId,
          campaign_id: input.campaignId,
          message: `${best.channel} is generating fewer or comparable leads but ${(bestRate / otherRate).toFixed(1)}× more qualified opportunities than ${other.channel}.`,
          severity: "info",
          created_at: now,
        });
      }
    }

    if (input.invalidRate >= 0.12) {
      recs.push({
        id: randomUUID(),
        organization_id: input.organizationId,
        campaign_id: input.campaignId,
        message: "This campaign has a high invalid-contact rate. Review creative targeting and form validation.",
        severity: "warning",
        created_at: now,
      });
    }

    if (input.topSegment) {
      recs.push({
        id: randomUUID(),
        organization_id: input.organizationId,
        campaign_id: input.campaignId,
        message: `${input.topSegment} are producing stronger appointment rates.`,
        severity: "info",
        created_at: now,
      });
    }

    return recs;
  }
}

export class LeadInsightProvider {
  summarize(input: {
    firstName: string;
    businessName: string;
    state: string;
    strategies: string[];
    timeline?: string;
    appointmentRequested: boolean;
    industryHint?: string;
  }): string {
    const primary = input.strategies[0] ?? "business strategy";
    const secondary = input.strategies[1];
    const parts = [
      `${input.firstName} is associated with ${input.businessName}${input.state ? ` in ${input.state}` : ""}.`,
      `Primary interest appears to be ${primary}${secondary ? `, with ${secondary} as a secondary concern` : ""}.`,
    ];
    if (input.timeline) parts.push(`Timeline indicated: ${input.timeline}.`);
    if (input.appointmentRequested) parts.push("Contact was requested.");
    return parts.join(" ");
  }

  preCallBrief(input: {
    firstName: string;
    lastName: string;
    businessName: string;
    strategies: string[];
    timeline?: string;
    source?: string | null;
    recommendedAction: string;
    highlights: string[];
  }) {
    return {
      who: `${input.firstName} ${input.lastName}`,
      business: input.businessName,
      primary_need: input.strategies[0] ?? "Unclassified",
      secondary_need: input.strategies[1] ?? null,
      timeline: input.timeline ?? "Not specified",
      assessment_highlights: input.highlights,
      campaign_source: input.source ?? "Campaign",
      recommended_next_action: input.recommendedAction,
    };
  }
}
