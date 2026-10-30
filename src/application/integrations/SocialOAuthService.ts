/**
 * Secure social OAuth orchestration for Connected Accounts.
 *
 * FOUNDATION STATUS: SIMULATION ONLY
 * - Connect/disconnect operate on the in-memory integration store
 * - LIVE provider authorization redirects are hard-blocked
 * - LIVE token exchange is not implemented (fail closed)
 * - Never returns raw tokens to browser-facing payloads
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
  consumeOauthState,
} from "@/application/integrations/oauthStateStore";
import {
  appendAudit,
  getIntegrationStore,
  publicConnectionView,
  upsertSimConnection,
} from "@/application/integrations/integrationStore";
import { getProviderMode } from "@/infrastructure/security/credentialVault";

/** Hard gate: no external provider OAuth until durable nonce store + token exchange ship. */
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

/**
 * Start connect. Foundation always completes as SIMULATION (no external redirect).
 * LIVE provider authorization is hard-blocked regardless of PROVIDER_MODE until
 * LIVE_SOCIAL_OAUTH_ENABLED is flipped after durable state + token exchange land.
 */
export function beginSocialOauthConnect(input: {
  organizationId: string;
  platform: ConnectedPlatform;
  profileId?: string | null;
}): AuthorizeResult {
  if (!LIVE_SOCIAL_OAUTH_ENABLED) {
    // Even if PROVIDER_MODE=LIVE, do not redirect to Meta/LinkedIn/TikTok yet.
    if (getProviderMode() === "LIVE") {
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
  }

  const provider = platformToOauthProvider(input.platform);
  const connection = upsertSimConnection({
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
  });

  return {
    mode: "SIMULATION",
    redirect: "none",
    simulationOnly: true,
    connection: publicConnectionView(connection),
    message:
      "SIMULATION ONLY — connection stored in-memory. No live provider authorization, posting, or ad spend.",
  };
}

/**
 * LIVE callback handler. Always fails closed in this foundation.
 * Does not log authorization codes or tokens.
 */
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

  // Never enable exchange while foundation flag is off.
  if (!LIVE_SOCIAL_OAUTH_ENABLED) {
    // Still validate/consume state when present so replay tests exercise the store,
    // but never exchange or persist provider tokens.
    const consumed = consumeOauthState(input.state, {
      expectedOrganizationId: input.expectedOrganizationId,
      expectedProfileId: input.expectedProfileId,
    });
    if (!consumed.ok) {
      return { ok: false, error: consumed.error, code: consumed.code };
    }
    return {
      ok: false,
      error:
        "LIVE social OAuth is disabled. Authorization code was discarded without token exchange.",
      code: "LIVE_OAUTH_NOT_ENABLED",
    };
  }

  const consumed = consumeOauthState(input.state, {
    expectedOrganizationId: input.expectedOrganizationId,
    expectedProfileId: input.expectedProfileId,
  });
  if (!consumed.ok) {
    return { ok: false, error: consumed.error, code: consumed.code };
  }

  const { payload } = consumed;
  if (!isConnectedPlatform(payload.platform)) {
    return { ok: false, error: "Unknown platform in state", code: "PLATFORM_INVALID" };
  }

  if (getProviderMode() !== "LIVE") {
    return {
      ok: false,
      error: "LIVE OAuth callback rejected while PROVIDER_MODE is not LIVE",
      code: "LIVE_DISABLED",
    };
  }

  const missing = missingOauthEnv(payload.provider as SocialOauthProvider);
  if (missing.length) {
    return {
      ok: false,
      error: "OAuth credentials missing for token exchange",
      code: "OAUTH_ENV_MISSING",
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

export function disconnectSocialProvider(input: {
  organizationId: string;
  provider: SocialOauthProvider;
  connectionId: string;
  profileId?: string | null;
}): { ok: true } | { ok: false; error: string; code: string } {
  const store = getIntegrationStore();
  const idx = store.connections.findIndex(
    (c) =>
      c.id === input.connectionId &&
      c.organization_id === input.organizationId &&
      c.provider === input.provider,
  );
  if (idx < 0) {
    return { ok: false, error: "Connection not found for organization", code: "NOT_FOUND" };
  }
  const [removed] = store.connections.splice(idx, 1);
  appendAudit({
    organization_id: input.organizationId,
    actor_profile_id: input.profileId ?? null,
    action: "provider.disconnected",
    entity_type: "integration_connection",
    entity_id: removed?.id ?? input.connectionId,
    metadata: { provider: input.provider },
  });
  return { ok: true };
}

export function reconnectSocialPlatform(input: {
  organizationId: string;
  platform: ConnectedPlatform;
  profileId?: string | null;
}): AuthorizeResult {
  const provider = platformToOauthProvider(input.platform);
  const store = getIntegrationStore();
  const existing = store.connections.find(
    (c) => c.organization_id === input.organizationId && c.provider === provider,
  );
  if (existing) {
    disconnectSocialProvider({
      organizationId: input.organizationId,
      provider,
      connectionId: existing.id,
      profileId: input.profileId,
    });
  }
  return beginSocialOauthConnect(input);
}
