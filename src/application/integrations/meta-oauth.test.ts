import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetIntegrationStore } from "@/application/integrations/integrationStore";
import { resetOauthStateStore } from "@/application/integrations/oauthStateStore";
import {
  META_CONNECT_SCOPES,
  META_FUTURE_SCOPES,
  META_GRAPH_API_VERSION,
  META_OAUTH_DIALOG_BASE,
  assertMetaRedirectUri,
  buildMetaAuthorizeUrl,
  discoverMetaBusinessAssets,
  exchangeMetaAuthorizationCode,
  exchangeMetaLongLivedToken,
  isMetaAuthorizeUrl,
  mapMetaProviderError,
} from "@/infrastructure/providers/meta/metaGraph";
import {
  assertMetaLivePersistenceReady,
  completeMetaOauthExchange,
  disconnectMetaConnection,
  inspectMetaConnectionHealth,
  metaConnectMissingEnv,
  startMetaOauthAuthorization,
} from "@/application/integrations/MetaOauthService";
import {
  isAesGcmCredentialRef,
  openTokenBundle,
  resetCredentialVault,
  sealLiveTokenBundle,
} from "@/infrastructure/security/credentialVault";
import { getIntegrationStore } from "@/application/integrations/integrationStore";
import { LIVE_SOCIAL_OAUTH_ENABLED } from "@/application/integrations/SocialOAuthService";

const ORG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function setMetaEnv() {
  process.env.META_OAUTH_UNIT_TEST = "1";
  process.env.META_APP_ID = "meta_app_test_id";
  process.env.META_APP_SECRET = "meta_app_test_secret_value";
  process.env.META_REDIRECT_URI =
    "https://staging.example.com/api/marketing/oauth/callback";
  process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    "unit-test-meta-encryption-key-32b";
  process.env.PROVIDER_MODE = "SIMULATION";
  process.env.ALLOW_LIVE_AD_PUBLISH = "false";
  resetCredentialVault();
}

function mockFetchSequence(
  responses: Array<{
    ok?: boolean;
    status?: number;
    body: unknown;
  }>,
): typeof fetch {
  let i = 0;
  return vi.fn(async (url: RequestInfo | URL) => {
    const entry = responses[i++];
    if (!entry) {
      throw new Error(`Unexpected fetch: ${String(url)}`);
    }
    return {
      ok: entry.ok ?? true,
      status: entry.status ?? 200,
      json: async () => entry.body,
    } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  resetIntegrationStore();
  resetOauthStateStore();
  setMetaEnv();
  delete process.env.ALTUS_DATA_MODE;
});

describe("Meta Graph API helpers", () => {
  it("pins Graph API v26.0", () => {
    expect(META_GRAPH_API_VERSION).toBe("v26.0");
    expect(META_OAUTH_DIALOG_BASE).toContain("/v26.0/dialog/oauth");
  });

  it("requests only discovery scopes (no publish/ads/business)", () => {
    expect([...META_CONNECT_SCOPES]).toEqual([
      "pages_show_list",
      "instagram_basic",
    ]);
    const future = JSON.stringify(META_FUTURE_SCOPES);
    expect(future).toContain("ads_management");
    expect(future).toContain("instagram_content_publish");
    expect(future).toContain("leads_retrieval");
    expect(META_CONNECT_SCOPES as readonly string[]).not.toContain(
      "business_management",
    );
    expect(META_CONNECT_SCOPES as readonly string[]).not.toContain(
      "pages_read_engagement",
    );
  });

  it("validates redirect URI path and scheme", () => {
    expect(
      assertMetaRedirectUri(
        "https://app.example.com/api/marketing/oauth/callback",
      ).ok,
    ).toBe(true);
    expect(
      assertMetaRedirectUri(
        "http://localhost:3000/api/marketing/oauth/callback",
      ).ok,
    ).toBe(true);
    expect(assertMetaRedirectUri("https://evil.example/callback").ok).toBe(
      false,
    );
    expect(
      assertMetaRedirectUri("http://evil.example/api/marketing/oauth/callback")
        .ok,
    ).toBe(false);
  });

  it("builds authorize URL with least-privilege scopes and no secrets", () => {
    const url = buildMetaAuthorizeUrl({
      state: "opaque-state",
      scopes: META_CONNECT_SCOPES,
    });
    expect(isMetaAuthorizeUrl(url)).toBe(true);
    expect(url.startsWith(META_OAUTH_DIALOG_BASE)).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("client_id")).toBe("meta_app_test_id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("opaque-state");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      process.env.META_REDIRECT_URI,
    );
    expect(parsed.searchParams.get("scope")).toBe(
      "pages_show_list,instagram_basic",
    );
    expect(url).not.toContain("meta_app_test_secret");
    expect(url).not.toContain("client_secret");
    expect(url).not.toContain("ads_management");
  });

  it("maps Meta error codes to user-facing messages without raw dumps", () => {
    const expired = mapMetaProviderError({
      error: { message: "Error validating access token", code: 190 },
    });
    expect(expired.code).toBe("META_TOKEN_INVALID");
    expect(expired.message).toMatch(/reconnect/i);

    const denied = mapMetaProviderError({
      error: { message: "Permission denied", code: 200 },
    });
    expect(denied.code).toBe("META_PERMISSION_DENIED");
  });

  it("exchanges short and long-lived tokens via mocked Graph calls", async () => {
    const fetchImpl = mockFetchSequence([
      { body: { access_token: "short_token", expires_in: 3600 } },
      { body: { access_token: "long_token", expires_in: 5_184_000 } },
    ]);
    const short = await exchangeMetaAuthorizationCode("auth_code", fetchImpl);
    expect(short.ok).toBe(true);
    if (short.ok) expect(short.token.access_token).toBe("short_token");

    const long = await exchangeMetaLongLivedToken("short_token", fetchImpl);
    expect(long.ok).toBe(true);
    if (long.ok) expect(long.token.access_token).toBe("long_token");
  });

  it("discovers Pages and linked Instagram professional accounts", async () => {
    const fetchImpl = mockFetchSequence([
      { body: { id: "user_1", name: "Altus Admin" } },
      {
        body: {
          data: [
            {
              id: "page_1",
              name: "ALTUS Financial Group",
              access_token: "PAGE_TOKEN_MUST_NOT_LEAK",
              tasks: ["ANALYZE", "ADVERTISE"],
              instagram_business_account: {
                id: "ig_1",
                username: "altus_ig",
                name: "ALTUS IG",
              },
            },
          ],
        },
      },
    ]);
    const result = await discoverMetaBusinessAssets("user_token", fetchImpl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assets.pages).toHaveLength(1);
    expect(result.assets.pages[0]).not.toHaveProperty("access_token");
    expect(result.assets.instagramAccounts[0]?.username).toBe("altus_ig");
    const blob = JSON.stringify(result.assets);
    expect(blob).not.toContain("PAGE_TOKEN_MUST_NOT_LEAK");
    expect(blob).not.toContain("user_token");
  });
});

describe("credential vault LIVE sealing", () => {
  it("AES-GCM seals without raw tokens in credential_ref", () => {
    const sealed = sealLiveTokenBundle({
      access_token: "LONG_LIVE_TOKEN_VALUE",
      refresh_token: null,
      expires_at: new Date().toISOString(),
      scopes: [...META_CONNECT_SCOPES],
    });
    expect(isAesGcmCredentialRef(sealed)).toBe(true);
    expect(sealed).not.toContain("LONG_LIVE_TOKEN_VALUE");
    const opened = openTokenBundle(sealed);
    expect(opened.access_token).toBe("LONG_LIVE_TOKEN_VALUE");
  });

  it("refuses LIVE seal without encryption key", () => {
    delete process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    resetCredentialVault();
    expect(() =>
      sealLiveTokenBundle({
        access_token: "tok",
        scopes: [],
      }),
    ).toThrow(/PROVIDER_CREDENTIAL_ENCRYPTION_KEY/);
  });
});

describe("MetaOauthService (mocked Meta; no live network)", () => {
  it("keeps LIVE social OAuth hard-disabled at the gate", () => {
    expect(LIVE_SOCIAL_OAUTH_ENABLED).toBe(false);
  });

  it("reports missing Meta env without echoing secrets", () => {
    delete process.env.META_APP_SECRET;
    const missing = metaConnectMissingEnv();
    expect(missing).toContain("META_APP_SECRET");
    expect(JSON.stringify(missing)).not.toMatch(/secret_value|Bearer/i);
  });

  it("fails LIVE persistence when durable stores are unavailable outside unit harness", () => {
    delete process.env.META_OAUTH_UNIT_TEST;
    const ready = assertMetaLivePersistenceReady();
    expect(ready.ok).toBe(false);
    if (!ready.ok) expect(ready.code).toBe("META_DURABLE_REQUIRED");
  });

  it("starts Meta authorize URL generation with CSRF state", async () => {
    const started = await startMetaOauthAuthorization({
      organizationId: ORG,
      platform: "facebook",
      profileId: "profile-1",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(isMetaAuthorizeUrl(started.authorizeUrl)).toBe(true);
    expect(started.authorizeUrl).toContain("/v26.0/dialog/oauth");
    expect(started.state.length).toBeGreaterThan(20);
    expect(started.authorizeUrl).not.toContain("meta_app_test_secret");
    expect(started.scopes).toEqual([...META_CONNECT_SCOPES]);
  });

  it("completes code exchange, AES-seals tokens, and returns public connection only", async () => {
    const fetchImpl = mockFetchSequence([
      { body: { access_token: "SHORT_LIVE_TOKEN", expires_in: 3600 } },
      { body: { access_token: "LONG_LIVE_TOKEN", expires_in: 5_184_000 } },
      {
        body: {
          data: {
            app_id: "meta_app_test_id",
            is_valid: true,
            scopes: [...META_CONNECT_SCOPES],
            user_id: "user_1",
          },
        },
      },
      { body: { id: "user_1", name: "Altus Admin" } },
      {
        body: {
          data: [
            {
              id: "page_1",
              name: "ALTUS Financial Group",
              access_token: "PAGE_SECRET",
              instagram_business_account: {
                id: "ig_1",
                username: "altus_ig",
              },
            },
          ],
        },
      },
    ]);

    const result = await completeMetaOauthExchange({
      organizationId: ORG,
      platform: "facebook",
      code: "auth_code_from_meta",
      profileId: "profile-1",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.connection).not.toHaveProperty("credential_ref");
    expect(result.connection.provider).toBe("meta");
    expect(result.connection.mode).toBe("LIVE");
    expect(result.connection.display_account_name).toBe("ALTUS Financial Group");
    expect(result.assets.authorizedAssetLabels.some((l) => l.includes("Page:"))).toBe(
      true,
    );

    const publicBlob = JSON.stringify(result.connection);
    expect(publicBlob).not.toMatch(
      /LONG_LIVE_TOKEN|SHORT_LIVE_TOKEN|PAGE_SECRET|credential_ref|meta_app_test_secret/i,
    );

    const stored = getIntegrationStore().connections.find(
      (c) => c.organization_id === ORG && c.provider === "meta",
    );
    expect(stored?.credential_ref).toBeTruthy();
    expect(isAesGcmCredentialRef(stored!.credential_ref)).toBe(true);
    expect(stored!.credential_ref).not.toContain("LONG_LIVE_TOKEN");
    const opened = openTokenBundle(stored!.credential_ref);
    expect(opened.access_token).toBe("LONG_LIVE_TOKEN");
    expect(opened.expires_at).toBeTruthy();
  });

  it("requires Instagram professional account when connecting Instagram", async () => {
    const fetchImpl = mockFetchSequence([
      { body: { access_token: "tok", expires_in: 3600 } },
      { body: { access_token: "tok_long", expires_in: 5_184_000 } },
      {
        body: {
          data: {
            app_id: "meta_app_test_id",
            is_valid: true,
            scopes: ["instagram_basic"],
          },
        },
      },
      { body: { id: "user_1", name: "Altus Admin" } },
      {
        body: {
          data: [{ id: "page_1", name: "Page Only", access_token: "x" }],
        },
      },
    ]);
    const result = await completeMetaOauthExchange({
      organizationId: ORG,
      platform: "instagram",
      code: "code",
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("META_IG_NOT_FOUND");
      expect(result.message).toMatch(/Instagram professional/i);
    }
  });

  it("reports health and disconnects without Meta revoke for simulation, with revoke for LIVE", async () => {
    const connectFetch = mockFetchSequence([
      { body: { access_token: "tok", expires_in: 3600 } },
      { body: { access_token: "tok_long", expires_in: 5_184_000 } },
      {
        body: {
          data: {
            app_id: "meta_app_test_id",
            is_valid: true,
            scopes: [...META_CONNECT_SCOPES],
          },
        },
      },
      { body: { id: "user_1", name: "Altus Admin" } },
      {
        body: {
          data: [
            {
              id: "page_1",
              name: "ALTUS Page",
              access_token: "page",
              instagram_business_account: { id: "ig", username: "altus" },
            },
          ],
        },
      },
    ]);
    const connected = await completeMetaOauthExchange({
      organizationId: ORG,
      platform: "facebook",
      code: "c",
      fetchImpl: connectFetch,
    });
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;

    const healthFetch = mockFetchSequence([
      {
        body: {
          data: { app_id: "meta_app_test_id", is_valid: true },
        },
      },
    ]);
    const health = await inspectMetaConnectionHealth({
      organizationId: ORG,
      fetchImpl: healthFetch,
    });
    expect(health.status).toBe("CONNECTED");

    const revokeFetch = mockFetchSequence([{ ok: true, body: { success: true } }]);
    const disconnected = await disconnectMetaConnection({
      organizationId: ORG,
      connectionId: connected.connectionId,
      fetchImpl: revokeFetch,
    });
    expect(disconnected.ok).toBe(true);
    expect(revokeFetch).toHaveBeenCalled();
    const after = await inspectMetaConnectionHealth({ organizationId: ORG });
    expect(after.status).toBe("NOT_CONNECTED");
  });
});
