/**
 * Meta (Facebook + Instagram) OAuth orchestration for Connected Accounts.
 *
 * LIVE redirects remain gated by LIVE_SOCIAL_OAUTH_ENABLED in SocialOAuthService.
 * This module implements authorize URL, code exchange, long-lived tokens,
 * asset discovery, health checks, and revoke — without requiring live calls in tests.
 */
import type { ConnectedPlatform } from "@/domain/social/connectedPlatforms";
import {
  META_CONNECT_SCOPES,
  buildMetaAuthorizeUrl,
  debugMetaToken,
  discoverMetaBusinessAssets,
  exchangeMetaAuthorizationCode,
  exchangeMetaLongLivedToken,
  expiresAtFromSeconds,
  metaAppCredentials,
  revokeMetaUserPermissions,
  type MetaDiscoveredAssets,
} from "@/infrastructure/providers/meta/metaGraph";
import {
  sealLiveTokenBundle,
  openTokenBundle,
  hasAesCredentialEncryption,
  isAesGcmCredentialRef,
} from "@/infrastructure/security/credentialVault";
import {
  getDurableConnection,
  upsertDurableConnection,
  disconnectDurableConnection,
  isDurableIntegrationConnectionsEnabled,
} from "@/application/integrations/IntegrationConnectionRepository";
import { publicConnectionView } from "@/application/integrations/integrationStore";
import {
  createOauthStateAsync,
  isDurableOauthStateStoreEnabled,
} from "@/application/integrations/oauthStateStore";
import { logAltusError } from "@/lib/observability";

export type MetaAuthorizeStartResult =
  | {
      ok: true;
      authorizeUrl: string;
      state: string;
      scopes: readonly string[];
    }
  | { ok: false; code: string; message: string; missingEnv: string[] };

export type MetaExchangeResult =
  | {
      ok: true;
      organizationId: string;
      platform: ConnectedPlatform;
      connectionId: string;
      connection: ReturnType<typeof publicConnectionView>;
      assets: MetaDiscoveredAssets;
    }
  | { ok: false; code: string; message: string };

export function metaConnectMissingEnv(): string[] {
  const required = [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_REDIRECT_URI",
    "PROVIDER_CREDENTIAL_ENCRYPTION_KEY",
  ];
  return required.filter((k) => !process.env[k]?.trim());
}

function allowMetaUnitTestMemory(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.META_OAUTH_UNIT_TEST === "1"
  );
}

export function assertMetaLivePersistenceReady():
  | { ok: true }
  | { ok: false; code: string; message: string } {
  if (!hasAesCredentialEncryption()) {
    return {
      ok: false,
      code: "META_ENCRYPTION_REQUIRED",
      message:
        "PROVIDER_CREDENTIAL_ENCRYPTION_KEY is required before LIVE Meta tokens can be stored.",
    };
  }
  if (allowMetaUnitTestMemory()) {
    return { ok: true };
  }
  if (
    !isDurableOauthStateStoreEnabled() ||
    !isDurableIntegrationConnectionsEnabled()
  ) {
    return {
      ok: false,
      code: "META_DURABLE_REQUIRED",
      message:
        "Durable OAuth state and integration_connections persistence are required for LIVE Meta OAuth.",
    };
  }
  return { ok: true };
}

export async function startMetaOauthAuthorization(input: {
  organizationId: string;
  platform: ConnectedPlatform;
  profileId?: string | null;
}): Promise<MetaAuthorizeStartResult> {
  if (input.platform !== "facebook" && input.platform !== "instagram") {
    return {
      ok: false,
      code: "PLATFORM_INVALID",
      message: "Meta OAuth supports Facebook and Instagram only.",
      missingEnv: [],
    };
  }
  const missing = metaConnectMissingEnv();
  if (missing.length || !metaAppCredentials()) {
    return {
      ok: false,
      code: "META_ENV_MISSING",
      message: "Meta application credentials are not configured.",
      missingEnv: missing.length ? missing : metaConnectMissingEnv(),
    };
  }
  const persistence = assertMetaLivePersistenceReady();
  if (!persistence.ok) {
    return {
      ok: false,
      code: persistence.code,
      message: persistence.message,
      missingEnv: missing,
    };
  }

  try {
    const { state } = await createOauthStateAsync({
      organizationId: input.organizationId,
      provider: "meta",
      platform: input.platform,
      profileId: input.profileId,
      requireDurable: true,
    });
    const authorizeUrl = buildMetaAuthorizeUrl({
      state,
      scopes: META_CONNECT_SCOPES,
    });
    return {
      ok: true,
      authorizeUrl,
      state,
      scopes: META_CONNECT_SCOPES,
    };
  } catch (e) {
    logAltusError("AUTHORIZATION_ERROR", "Meta authorize start failed", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return {
      ok: false,
      code: "META_AUTHORIZE_START_FAILED",
      message: "Unable to start Meta authorization.",
      missingEnv: [],
    };
  }
}

export async function completeMetaOauthExchange(input: {
  organizationId: string;
  platform: ConnectedPlatform;
  code: string;
  profileId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<MetaExchangeResult> {
  const persistence = assertMetaLivePersistenceReady();
  if (!persistence.ok) {
    return {
      ok: false,
      code: persistence.code,
      message: persistence.message,
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;

  const short = await exchangeMetaAuthorizationCode(input.code, fetchImpl);
  if (!short.ok) {
    return { ok: false, code: short.code, message: short.message };
  }

  // Prefer long-lived user token; fall back to short-lived if exchange fails.
  let accessToken = short.token.access_token;
  let expiresAt = expiresAtFromSeconds(short.token.expires_in);
  const longLived = await exchangeMetaLongLivedToken(accessToken, fetchImpl);
  if (longLived.ok) {
    accessToken = longLived.token.access_token;
    expiresAt =
      expiresAtFromSeconds(longLived.token.expires_in) ?? expiresAt;
  }

  const debug = await debugMetaToken(accessToken, fetchImpl);
  if (!debug.ok) {
    return { ok: false, code: debug.code, message: debug.message };
  }
  if (debug.data.is_valid === false) {
    return {
      ok: false,
      code: "META_TOKEN_INVALID",
      message: "Meta reported the access token as invalid.",
    };
  }

  const scopes =
    debug.data.scopes && debug.data.scopes.length
      ? debug.data.scopes
      : [...META_CONNECT_SCOPES];

  const assetsResult = await discoverMetaBusinessAssets(accessToken, fetchImpl);
  if (!assetsResult.ok) {
    return { ok: false, code: assetsResult.code, message: assetsResult.message };
  }
  const assets = assetsResult.assets;

  if (input.platform === "instagram" && assets.instagramAccounts.length === 0) {
    return {
      ok: false,
      code: "META_IG_NOT_FOUND",
      message:
        "No Instagram professional account was found linked to your Facebook Pages. Link an IG professional account, then reconnect.",
    };
  }
  if (input.platform === "facebook" && assets.pages.length === 0) {
    return {
      ok: false,
      code: "META_PAGE_NOT_FOUND",
      message:
        "No Facebook Pages were found for this Meta user. Grant Page access and try again.",
    };
  }

  let credentialRef: string;
  try {
    credentialRef = sealLiveTokenBundle({
      access_token: accessToken,
      refresh_token: null,
      expires_at: expiresAt,
      scopes,
    });
  } catch {
    return {
      ok: false,
      code: "META_ENCRYPTION_REQUIRED",
      message:
        "Unable to encrypt Meta credentials. Check PROVIDER_CREDENTIAL_ENCRYPTION_KEY.",
    };
  }
  if (!isAesGcmCredentialRef(credentialRef)) {
    return {
      ok: false,
      code: "META_ENCRYPTION_REQUIRED",
      message: "Meta credentials must be AES-GCM sealed before persistence.",
    };
  }

  const accountName =
    input.platform === "instagram"
      ? assets.instagramAccounts[0]?.username
        ? `@${assets.instagramAccounts[0].username}`
        : assets.instagramAccounts[0]?.name || assets.user.name || "Instagram"
      : assets.pages[0]?.name || assets.user.name || "Facebook";

  try {
    const connection = await upsertDurableConnection({
      organizationId: input.organizationId,
      provider: "meta",
      accountName,
      accountId: assets.user.id,
      businessId: undefined,
      scopes,
      permissionsSummary: scopes.slice(0, 6),
      authorizedAssets: assets.authorizedAssetLabels,
      connectedBy: input.profileId ?? null,
      platformHint: input.platform,
      mode: "LIVE",
      status: "CONNECTED",
      credentialRef,
      tokenExpiresAt: expiresAt,
    });

    return {
      ok: true,
      organizationId: input.organizationId,
      platform: input.platform,
      connectionId: connection.id,
      connection: publicConnectionView(connection),
      assets,
    };
  } catch {
    return {
      ok: false,
      code: "META_PERSIST_FAILED",
      message: "Meta authorization succeeded but saving the connection failed.",
    };
  }
}

export async function inspectMetaConnectionHealth(input: {
  organizationId: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  status: "CONNECTED" | "EXPIRED" | "ERROR" | "NOT_CONNECTED";
  message: string;
  tokenExpiresAt: string | null;
  authorizedAssets: string[];
}> {
  const conn = await getDurableConnection(input.organizationId, "meta");
  if (!conn || conn.status === "disconnected" || !conn.credential_ref) {
    return {
      status: "NOT_CONNECTED",
      message: "Meta is not connected.",
      tokenExpiresAt: null,
      authorizedAssets: [],
    };
  }

  // Never call Meta for SIMULATION connections.
  if (conn.mode !== "LIVE") {
    return {
      status: "CONNECTED",
      message: "Simulation Meta connection (no live provider health check).",
      tokenExpiresAt: conn.token_expires_at,
      authorizedAssets: conn.authorized_assets ?? [],
    };
  }

  try {
    const bundle = openTokenBundle(conn.credential_ref);
    const debug = await debugMetaToken(
      bundle.access_token,
      input.fetchImpl ?? fetch,
    );
    if (!debug.ok || debug.data.is_valid === false) {
      return {
        status: "EXPIRED",
        message: "Meta access expired or was revoked. Please reconnect.",
        tokenExpiresAt: conn.token_expires_at,
        authorizedAssets: conn.authorized_assets ?? [],
      };
    }
    return {
      status: "CONNECTED",
      message: "Meta connection is healthy.",
      tokenExpiresAt: conn.token_expires_at,
      authorizedAssets: conn.authorized_assets ?? [],
    };
  } catch {
    return {
      status: "ERROR",
      message: "Unable to verify Meta connection health.",
      tokenExpiresAt: conn.token_expires_at,
      authorizedAssets: conn.authorized_assets ?? [],
    };
  }
}

export async function disconnectMetaConnection(input: {
  organizationId: string;
  connectionId: string;
  profileId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const conn = await getDurableConnection(input.organizationId, "meta");
  // Best-effort Meta revoke only for LIVE connections — never for simulation.
  if (conn?.credential_ref && conn.mode === "LIVE") {
    try {
      const bundle = openTokenBundle(conn.credential_ref);
      await revokeMetaUserPermissions(
        bundle.access_token,
        input.fetchImpl ?? fetch,
      );
    } catch {
      // best-effort revoke
    }
  }
  const result = await disconnectDurableConnection({
    organizationId: input.organizationId,
    provider: "meta",
    connectionId: input.connectionId,
    profileId: input.profileId,
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.error,
    };
  }
  return { ok: true };
}
