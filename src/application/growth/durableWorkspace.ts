/**
 * Helpers for durable (Supabase) workspace payloads used by Home / CRM / Campaigns.
 * Keep simulation-only nested shapes optional; never assume analytics JSON exists.
 */

export const ACTIVE_CAMPAIGN_STATUSES = [
  "active_simulation",
  "approved",
  "active",
  "scheduled",
  "published",
] as const;

/** Fine-grained temperatures that count as "hot" for Home CRM metrics. */
export const CRM_HOT_TEMPERATURES = [
  "HOT",
  "VERY_HOT",
  "READY_NOW",
  "PRIORITY",
] as const;

export type DurableLeadLike = {
  id?: string;
  campaign_id?: string | null;
  organization_id?: string | null;
  temperature_key?: string | null;
  operational_temperature?: string | null;
  opportunity_score?: number | null;
  score?: number | null;
  assessment_answers?: Record<string, unknown> | null;
  attribution?: Record<string, unknown> | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  [key: string]: unknown;
};

export type DurableCampaignLike = {
  id: string;
  organization_id?: string | null;
  status?: string | null;
  analytics?: {
    leads?: number | null;
    hot_leads?: number | null;
    qualified_leads?: number | null;
    appointments?: number | null;
  } | null;
  [key: string]: unknown;
};

export function isActiveCampaignStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ACTIVE_CAMPAIGN_STATUSES as readonly string[]).includes(String(status));
}

export function isCrmHotTemperature(key: string | null | undefined): boolean {
  if (!key) return false;
  return (CRM_HOT_TEMPERATURES as readonly string[]).includes(key);
}

export type MappedDurableLead = DurableLeadLike & {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  score: number;
  assessment_answers: Record<string, unknown>;
  attribution: Record<string, unknown>;
  temperature_key: string | null;
};

/** Map a durable leads row into Command Center / Home expectations. */
export function mapDurableLead(lead: DurableLeadLike): MappedDurableLead {
  return {
    ...lead,
    operational_temperature: lead.operational_temperature ?? undefined,
    temperature_key: lead.temperature_key ?? lead.operational_temperature ?? null,
    score: lead.opportunity_score ?? lead.score ?? 0,
    assessment_answers:
      lead.assessment_answers && typeof lead.assessment_answers === "object"
        ? lead.assessment_answers
        : {},
    attribution:
      lead.attribution && typeof lead.attribution === "object"
        ? lead.attribution
        : {},
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
  };
}

export function deriveCampaignAnalytics(
  campaignId: string,
  leads: DurableLeadLike[],
  existing?: DurableCampaignLike["analytics"] | null,
): {
  leads: number;
  hot_leads: number;
  qualified_leads: number;
  appointments: number;
} {
  const forCampaign = leads.filter((l) => l.campaign_id === campaignId);
  const derivedLeads = forCampaign.length;
  const derivedHot = forCampaign.filter((l) =>
    isCrmHotTemperature(l.temperature_key ?? null),
  ).length;

  // Lead/hot counts always come from the org-scoped leads array (durable source of truth).
  // Preserve optional sim-only appointment/qualified fields when present.
  return {
    leads: derivedLeads,
    hot_leads: derivedHot,
    qualified_leads: Number(existing?.qualified_leads ?? derivedLeads),
    appointments: Number(existing?.appointments ?? 0),
  };
}

export function enrichCampaignsWithLeadCounts<C extends DurableCampaignLike>(
  campaigns: C[],
  leads: DurableLeadLike[],
): Array<C & { analytics: ReturnType<typeof deriveCampaignAnalytics> }> {
  return campaigns.map((campaign) => ({
    ...campaign,
    analytics: deriveCampaignAnalytics(campaign.id, leads, campaign.analytics),
  }));
}

export function countActiveCampaigns(
  campaigns: Array<{ status?: string | null }>,
): number {
  return campaigns.filter((c) => isActiveCampaignStatus(c.status)).length;
}
