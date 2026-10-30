/**
 * Marketing foundation module registry.
 * Statuses are honest: nothing is claimed operational until provider APIs are
 * connected and tested in LIVE with approvals.
 */

export type MarketingModuleStatus =
  | "ui_ready"
  | "simulation_partial"
  | "requires_oauth"
  | "requires_provider_approval"
  | "planned";

export type MarketingFoundationModule = {
  key: string;
  title: string;
  description: string;
  href: string;
  status: MarketingModuleStatus;
  dependsOn: string[];
};

export const MARKETING_FOUNDATION_MODULES: MarketingFoundationModule[] = [
  {
    key: "connected_accounts",
    title: "Connected Accounts",
    description:
      "Connect Facebook, Instagram, TikTok, and LinkedIn business accounts with org-scoped OAuth.",
    href: "/app/marketing/connected-accounts",
    status: "simulation_partial",
    dependsOn: ["integrations.manage"],
  },
  {
    key: "content_calendar",
    title: "Content Calendar",
    description:
      "Plan organic posts across connected platforms. Scheduling is not live until publishing APIs are approved.",
    href: "/app/marketing/content-calendar",
    status: "ui_ready",
    dependsOn: ["connected_accounts", "organic_publish_api"],
  },
  {
    key: "post_scheduling",
    title: "Post Scheduling",
    description:
      "Queue approved organic content. Placeholder until Meta/LinkedIn/TikTok publish scopes are LIVE-tested.",
    href: "/app/marketing/content-calendar",
    status: "planned",
    dependsOn: ["content_calendar", "requires_provider_approval"],
  },
  {
    key: "campaign_analytics",
    title: "Campaign Analytics",
    description:
      "Normalize impressions, clicks, spend, and leads from connected ad accounts.",
    href: "/app/marketing/analytics",
    status: "simulation_partial",
    dependsOn: ["connected_accounts", "metrics_sync"],
  },
  {
    key: "paid_ads_connections",
    title: "Paid Advertising Accounts",
    description:
      "Link ad accounts after OAuth. Spend remains gated by PROVIDER_MODE and ALLOW_LIVE_AD_PUBLISH.",
    href: "/app/marketing/connected-accounts",
    status: "requires_oauth",
    dependsOn: ["provider_app_review", "ALLOW_LIVE_AD_PUBLISH"],
  },
  {
    key: "lead_source_attribution",
    title: "Lead-Source Attribution",
    description:
      "UTM, source_channel, and ad_provider already flow into ALTUS lead intake and webhooks.",
    href: "/app/marketing/analytics",
    status: "simulation_partial",
    dependsOn: ["native_webhooks"],
  },
  {
    key: "conversion_reporting",
    title: "Conversion Reporting",
    description:
      "Map appointments and qualified leads back to platform campaigns. Dashboard shell only.",
    href: "/app/marketing/analytics",
    status: "planned",
    dependsOn: ["campaign_analytics", "lead_source_attribution"],
  },
  {
    key: "cross_platform_dashboard",
    title: "Cross-Platform Performance",
    description:
      "Unified performance view across Facebook, Instagram, TikTok, and LinkedIn.",
    href: "/app/marketing/analytics",
    status: "ui_ready",
    dependsOn: ["campaign_analytics"],
  },
];

export function listMarketingFoundationModules(): MarketingFoundationModule[] {
  return MARKETING_FOUNDATION_MODULES;
}
