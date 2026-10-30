/**
 * Secure social OAuth orchestration for Connected Accounts.
 *
 * FOUNDATION STATUS: SIMULATION ONLY for LIVE provider redirects.
 * Durable connection + OAuth nonce persistence is used when ALTUS_DATA_MODE=supabase.
 */
import {
  CONNECTED_PLATFORM_CATALOG,
  type ConnectedPlatform,
  type SocialOauthProvider,
  platformToOauthProvider,
} from "@/domain/social/connectedPlatforms";
import {
  createOauthState,
  createOauthStateAsync,
  consumeOauthStateAsync,
} from "@/application/integrations/oauthStateStore";
import {
  publicConnectionView,
} from "@/application/integrations/integrationStore";
import {
  disconnectDurableConnection,
  getDurableConnection,
  upsertDurableConnection,
} from "@/application/integrations/IntegrationConnectionRepository";
import { getProviderMode } from "@/infrastructure/security/credentialVault";

/** Hard gate: no external provider OAuth until token exchange ships. */
export const LIVE_SOCIAL_OAUTH_ENABLED = false;

export type AuthorizeResult =
  | {
      mode: "SIMULATION";
      redirect: "none";
      simulationOnly: true;
      connection: ReturnType<typeof publicConnectionView>;
      message: string;
    }
  | {
      mode: "LIVE";
      redirect: "blocked";
      simulationOnly: true;
      error: string;
      code: string;
      missingEnv: string[];
    };

function requiredEnv(provider: SocialOauthProvider): string[] {
  switch (provider) {
    case "meta":
      return ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"];
    case "linkedin":
      return [
        "LINKEDIN_CLIENT_ID",
        "LINKEDIN_CLIENT_SECRET",
        "LINKEDIN_REDIRECT_URI",
      ];
    case "tiktok":
      return ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"];
  }
}

export function missingOauthEnv(provider: SocialOauthProvider): string[] {
  return requiredEnv(provider).filter((k) => !process.env[k]?.trim());
}

export function oauthConfigured(provider: SocialOauthProvider): boolean {
  return missingOauthEnv(provider).length === 0;
}

function simAccountName(platform: ConnectedPlatform): string {
  switch (platform) {
    case "facebook":
      return "ALTUS Facebook Business (Simulation)";
    case "instagram":
      return "ALTUS Instagram Professional (Simulation)";
    case "tiktok":
      return "ALTUS TikTok Business (Simulation)";
    case "linkedin":
      return "ALTUS LinkedIn Company (Simulation)";
  }
}

function simAssets(platform: ConnectedPlatform): string[] {
  switch (platform) {
    case "facebook":
      return ["Page: ALTUS Financial Group", "Ad Account: act_sim_meta"];
    case "instagram":
      return [
        "IG Professional: @altus_sim",
        "Linked Facebook Page: ALTUS Financial Group",
      ];
    case "tiktok":
      return ["Advertiser: ALTUS Sim Advertiser", "Business Center: sim_bc"];
    case "linkedin":
      return ["Organization: ALTUS Sim Co", "Ad Account: urn:li:sponsoredAccount:sim"];
  }
}

function simPermissions(platform: ConnectedPlatform): string[] {
  return CONNECTED_PLATFORM_CATALOG[platform].requestedScopes.slice(0, 4);
}

export async function beginSocialOauthConnect(input: {
  organizationId: string;
  platform: ConnectedPlatform;
  profileId?: string | null;
}): Promise<AuthorizeResult> {
  if (!LIVE_SOCIAL_OAUTH_ENABLED && getProviderMode() === "LIVE") {
    return {
      mode: "LIVE",
      redirect: "blocked",
      simulationOnly: true,
      error:
        "LIVE social OAuth is disabled in this foundation. Durable OAuth state persistence and token exchange are required first.",
      code: "LIVE_OAUTH_NOT_ENABLED",
      missingEnv: missingOauthEnv(platformToOauthProvider(input.platform)),
    };
  }

  const provider = platformToOauthProvider(input.platform);
  const connection = await upsertDurableConnection({
    organizationId: input.organizationId,
    provider: provider === "tiktok" ? "tiktok" : provider,
    accountName: simAccountName(input.platform),
    accountId: `${provider}_${input.platform}_sim`,
    businessId: `${provider}_biz_sim`,
    scopes: CONNECTED_PLATFORM_CATALOG[input.platform].requestedScopes,
    permissionsSummary: simPermissions(input.platform),
    authorizedAssets: simAssets(input.platform),
    connectedBy: input.profileId ?? null,
    platformHint: input.platform,
    mode: "SIMULATION",
    status: "CONNECTED",
  });

  return {
    mode: "SIMULATION",
    redirect: "none",
    simulationOnly: true,
    connection: publicConnectionView(connection),
    message:
      "SIMULATION ONLY — connection persisted for the organization. No live provider authorization, posting, or ad spend.",
  };
}

export async function completeSocialOauthCallback(input: {
  state: string;
  code: string | null;
  error?: string | null;
  expectedOrganizationId?: string;
  expectedProfileId?: string | null;
}): Promise<
  | {
      ok: true;
      organizationId: string;
      platform: ConnectedPlatform;
      connectionId: string;
    }
  | { ok: false; error: string; code: string }
> {
  if (input.error) {
    return {
      ok: false,
      error: "Provider returned an authorization error",
      code: "PROVIDER_DENIED",
    };
  }
  if (!input.code) {
    return { ok: false, error: "Missing authorization code", code: "CODE_MISSING" };
  }

  const consumed = await consumeOauthStateAsync(input.state, {
    expectedOrganizationId: input.expectedOrganizationId,
    expectedProfileId: input.expectedProfileId,
  });
  if (!consumed.ok) {
    return { ok: false, error: consumed.error, code: consumed.code };
  }

  if (!LIVE_SOCIAL_OAUTH_ENABLED) {
    return {
      ok: false,
      error:
        "LIVE social OAuth is disabled. Authorization code was discarded without token exchange.",
      code: "LIVE_OAUTH_NOT_ENABLED",
    };
  }

  return {
    ok: false,
    error:
      "LIVE token exchange is not activated. Configure provider apps and implement exchange before connecting LIVE accounts.",
    code: "TOKEN_EXCHANGE_NOT_ACTIVATED",
  };
}

/** Test helper — builds signed state without enabling LIVE redirects. */
export function createTestOauthState(input: {
  organizationId: string;
  provider: string;
  platform: string;
  profileId?: string | null;
  ttlMs?: number;
}) {
  return createOauthState(input);
}

export async function createDurableTestOauthState(input: {
  organizationId: string;
  provider: string;
  platform: string;
  profileId?: string | null;
  ttlMs?: number;
}) {
  return createOauthStateAsync(input);
}

export async function disconnectSocialProvider(input: {
  organizationId: string;
  provider: SocialOauthProvider;
  connectionId: string;
  profileId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  return disconnectDurableConnection(input);
}

export async function reconnectSocialPlatform(input: {
  organizationId: string;
  platform: ConnectedPlatform;
  profileId?: string | null;
}): Promise<AuthorizeResult> {
  const provider = platformToOauthProvider(input.platform);
  const existing = await getDurableConnection(input.organizationId, provider);
  if (existing) {
    await disconnectDurableConnection({
      organizationId: input.organizationId,
      provider,
      connectionId: existing.id,
      profileId: input.profileId,
    });
  }
  return beginSocialOauthConnect(input);
}
