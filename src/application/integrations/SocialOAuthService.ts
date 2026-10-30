/**
 * Secure social OAuth orchestration for Connected Accounts.
 *
 * LIVE Meta OAuth implementation exists but is gated by LIVE_SOCIAL_OAUTH_ENABLED.
 * Default remains false — no external provider redirects or token exchange in production
 * until explicitly approved.
 */
import {
  CONNECTED_PLATFORM_CATALOG,
  type ConnectedPlatform,
  type SocialOauthProvider,
  isConnectedPlatform,
  platformToOauthProvider,
} from "@/domain/social/connectedPlatforms";
import {
  createOauthState,
  createOauthStateAsync,
  consumeOauthStateAsync,
} from "@/application/integrations/oauthStateStore";
import { publicConnectionView } from "@/application/integrations/integrationStore";
import {
  disconnectDurableConnection,
  getDurableConnection,
  upsertDurableConnection,
} from "@/application/integrations/IntegrationConnectionRepository";
import { getProviderMode } from "@/infrastructure/security/credentialVault";
import {
  completeMetaOauthExchange,
  disconnectMetaConnection,
  startMetaOauthAuthorization,
} from "@/application/integrations/MetaOauthService";

/**
 * Master gate for LIVE provider redirects + token exchange.
 * Keep false until staging Meta credentials + E2E approval.
 */
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
      redirect: "external";
      simulationOnly: false;
      authorizeUrl: string;
      /** Opaque CSRF state — required by provider; not a secret token. */
      state: string;
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
      return [
        "META_APP_ID",
        "META_APP_SECRET",
        "META_REDIRECT_URI",
        "PROVIDER_CREDENTIAL_ENCRYPTION_KEY",
      ];
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
  const provider = platformToOauthProvider(input.platform);

  // LIVE path — Meta only for now; still requires explicit feature flag.
  if (LIVE_SOCIAL_OAUTH_ENABLED) {
    if (provider !== "meta") {
      return {
        mode: "LIVE",
        redirect: "blocked",
        simulationOnly: true,
        error: `${provider} LIVE OAuth is not implemented yet.`,
        code: "PROVIDER_LIVE_NOT_IMPLEMENTED",
        missingEnv: missingOauthEnv(provider),
      };
    }
    const started = await startMetaOauthAuthorization(input);
    if (!started.ok) {
      return {
        mode: "LIVE",
        redirect: "blocked",
        simulationOnly: true,
        error: started.message,
        code: started.code,
        missingEnv: started.missingEnv,
      };
    }
    return {
      mode: "LIVE",
      redirect: "external",
      simulationOnly: false,
      authorizeUrl: started.authorizeUrl,
      state: started.state,
      message: "Redirecting to Meta to authorize Facebook / Instagram access.",
    };
  }

  // Fail closed if someone sets PROVIDER_MODE=LIVE without the feature flag.
  if (getProviderMode() === "LIVE") {
    return {
      mode: "LIVE",
      redirect: "blocked",
      simulationOnly: true,
      error:
        "LIVE social OAuth is disabled. Set LIVE_SOCIAL_OAUTH_ENABLED only after Meta staging approval.",
      code: "LIVE_OAUTH_NOT_ENABLED",
      missingEnv: missingOauthEnv(provider),
    };
  }

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
  fetchImpl?: typeof fetch;
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
      error: "The provider denied authorization. You can try connecting again.",
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

  const { payload } = consumed;
  if (!isConnectedPlatform(payload.platform)) {
    return { ok: false, error: "Unknown platform in state", code: "PLATFORM_INVALID" };
  }
  if (payload.provider !== "meta") {
    return {
      ok: false,
      error: "LIVE OAuth for this provider is not implemented.",
      code: "PROVIDER_LIVE_NOT_IMPLEMENTED",
    };
  }

  const exchanged = await completeMetaOauthExchange({
    organizationId: payload.organizationId,
    platform: payload.platform,
    code: input.code,
    profileId: payload.profileId,
    fetchImpl: input.fetchImpl,
  });
  if (!exchanged.ok) {
    return { ok: false, error: exchanged.message, code: exchanged.code };
  }

  return {
    ok: true,
    organizationId: exchanged.organizationId,
    platform: exchanged.platform,
    connectionId: exchanged.connectionId,
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
  if (input.provider === "meta") {
    const result = await disconnectMetaConnection(input);
    if (!result.ok) {
      return { ok: false, error: result.message, code: result.code };
    }
    return { ok: true };
  }
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
    await disconnectSocialProvider({
      organizationId: input.organizationId,
      provider,
      connectionId: existing.id,
      profileId: input.profileId,
    });
  }
  return beginSocialOauthConnect(input);
}
