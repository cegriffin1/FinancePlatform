/**
 * Null-safe view helpers for workspace pages when durable Supabase rows
 * omit simulation-only nested objects (e.g. campaign.analytics).
 */

export type CampaignAnalyticsLike = {
  leads?: number | null;
  hot_leads?: number | null;
  qualified_leads?: number | null;
  appointments?: number | null;
};

export function safeCampaignAnalytics(
  campaign:
    | { analytics?: CampaignAnalyticsLike | null }
    | null
    | undefined,
): {
  leads: number;
  hot_leads: number;
  qualified_leads: number;
  appointments: number;
} {
  const a = campaign?.analytics;
  return {
    leads: Number(a?.leads ?? 0),
    hot_leads: Number(a?.hot_leads ?? 0),
    qualified_leads: Number(a?.qualified_leads ?? 0),
    appointments: Number(a?.appointments ?? 0),
  };
}

export function leadShortName(lead: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const first = (lead.first_name ?? "").trim() || "Lead";
  const initial = (lead.last_name ?? "").trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

export function leadFullName(lead: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const first = (lead.first_name ?? "").trim();
  const last = (lead.last_name ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ");
  return name || "Lead";
}
