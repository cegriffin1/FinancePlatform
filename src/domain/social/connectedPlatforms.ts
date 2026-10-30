/**
 * Consumer-facing Connected Accounts platforms.
 * Facebook + Instagram share one Meta business OAuth connection.
 * Tokens are never exposed to the browser.
 */

export const CONNECTED_PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
] as const;

export type ConnectedPlatform = (typeof CONNECTED_PLATFORMS)[number];

/** Server-side OAuth / credential providers that back platform cards. */
export const SOCIAL_OAUTH_PROVIDERS = ["meta", "linkedin", "tiktok"] as const;
export type SocialOauthProvider = (typeof SOCIAL_OAUTH_PROVIDERS)[number];

export type ApiCapabilityStatus =
  | "simulation_ready"
  | "requires_developer_app"
  | "requires_provider_approval"
  | "planned"
  | "not_available";

export type ConnectedPlatformDefinition = {
  platform: ConnectedPlatform;
  label: string;
  subtitle: string;
  /** Underlying OAuth provider key. */
  oauthProvider: SocialOauthProvider;
  /** Least-privilege scopes for connection (organic + ads where applicable). */
  requestedScopes: string[];
  organicPublishing: ApiCapabilityStatus;
  advertising: ApiCapabilityStatus;
  analytics: ApiCapabilityStatus;
  leadAttribution: ApiCapabilityStatus;
  /** Human-readable setup notes — not a claim of live readiness. */
  setupNotes: string[];
};

export const CONNECTED_PLATFORM_CATALOG: Record<
  ConnectedPlatform,
  ConnectedPlatformDefinition
> = {
  facebook: {
    platform: "facebook",
    label: "Facebook",
    subtitle: "Meta Business — Pages & placements",
    oauthProvider: "meta",
    requestedScopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "ads_read",
      "ads_management",
      "leads_retrieval",
      "business_management",
    ],
    organicPublishing: "requires_provider_approval",
    advertising: "requires_provider_approval",
    analytics: "requires_developer_app",
    leadAttribution: "simulation_ready",
    setupNotes: [
      "Uses Meta Marketing API + Facebook Login for Business.",
      "Facebook and Instagram share one Meta connection.",
      "Ads spend requires Meta App Review and ALLOW_LIVE_AD_PUBLISH.",
    ],
  },
  instagram: {
    platform: "instagram",
    label: "Instagram",
    subtitle: "Meta Business — IG professional account",
    oauthProvider: "meta",
    requestedScopes: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
      "ads_read",
      "ads_management",
      "leads_retrieval",
      "business_management",
    ],
    organicPublishing: "requires_provider_approval",
    advertising: "requires_provider_approval",
    analytics: "requires_developer_app",
    leadAttribution: "simulation_ready",
    setupNotes: [
      "Requires a linked Instagram professional account under a Meta Business.",
      "Shares the Meta OAuth connection with Facebook.",
    ],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    subtitle: "TikTok for Business / Content Posting",
    oauthProvider: "tiktok",
    requestedScopes: [
      "user.info.basic",
      "video.list",
      "video.publish",
      "biz.brand.elevate",
    ],
    organicPublishing: "requires_provider_approval",
    advertising: "requires_provider_approval",
    analytics: "planned",
    leadAttribution: "planned",
    setupNotes: [
      "Organic Content Posting API and Marketing API are separate TikTok products.",
      "Each requires TikTok developer app approval before LIVE tokens work.",
      "Simulation connect is available for UI/tenant isolation testing only.",
    ],
  },
  linkedin: {
    platform: "linkedin",
    label: "LinkedIn",
    subtitle: "Company Page & Campaign Manager",
    oauthProvider: "linkedin",
    requestedScopes: [
      "r_organization_social",
      "w_organization_social",
      "rw_organization_admin",
      "r_ads",
      "rw_ads",
      "r_ads_reporting",
      "r_marketing_leadgen_automation",
    ],
    organicPublishing: "requires_provider_approval",
    advertising: "requires_provider_approval",
    analytics: "requires_developer_app",
    leadAttribution: "simulation_ready",
    setupNotes: [
      "Organic Community Management and Ads APIs use LinkedIn developer products.",
      "Lead Gen Forms webhooks map into ALTUS attribution when LIVE is approved.",
    ],
  },
};

export function platformToOauthProvider(
  platform: ConnectedPlatform,
): SocialOauthProvider {
  return CONNECTED_PLATFORM_CATALOG[platform].oauthProvider;
}

export function platformsForOauthProvider(
  provider: SocialOauthProvider,
): ConnectedPlatform[] {
  return CONNECTED_PLATFORMS.filter(
    (p) => CONNECTED_PLATFORM_CATALOG[p].oauthProvider === provider,
  );
}

export function isConnectedPlatform(value: string): value is ConnectedPlatform {
  return (CONNECTED_PLATFORMS as readonly string[]).includes(value);
}

export function isSocialOauthProvider(
  value: string,
): value is SocialOauthProvider {
  return (SOCIAL_OAUTH_PROVIDERS as readonly string[]).includes(value);
}
