import { describe, expect, it, beforeEach } from "vitest";
import { resetIntegrationStore } from "@/application/integrations/integrationStore";
import { resetOauthStateStore } from "@/application/integrations/oauthStateStore";
import {
  beginSocialOauthConnect,
  disconnectSocialProvider,
  completeSocialOauthCallback,
  reconnectSocialPlatform,
  createTestOauthState,
  LIVE_SOCIAL_OAUTH_ENABLED,
} from "@/application/integrations/SocialOAuthService";
import { listConnectedAccountCards } from "@/application/integrations/ConnectedAccountsService";
import { openTokenBundle } from "@/infrastructure/security/credentialVault";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  resetIntegrationStore();
  resetOauthStateStore();
  process.env.PROVIDER_MODE = "SIMULATION";
  process.env.ALLOW_LIVE_AD_PUBLISH = "false";
  process.env.ALTUS_DATA_MODE = "simulation";
});

describe("Connected Accounts simulation", () => {
  it("keeps LIVE social OAuth hard-disabled in foundation", () => {
    expect(LIVE_SOCIAL_OAUTH_ENABLED).toBe(false);
  });

  it("lists four platform cards", async () => {
    const cards = await listConnectedAccountCards(ORG_A);
    expect(cards.map((c) => c.platform)).toEqual([
      "facebook",
      "instagram",
      "tiktok",
      "linkedin",
    ]);
    expect(cards.every((c) => c.status === "NOT_CONNECTED")).toBe(true);
  });

  it("connects facebook and instagram via shared meta provider", async () => {
    const fb = await beginSocialOauthConnect({
      organizationId: ORG_A,
      platform: "facebook",
    });
    expect(fb.redirect).toBe("none");
    expect(fb.simulationOnly).toBe(true);
    if (fb.redirect !== "none") return;
    expect(fb.connection.provider).toBe("meta");
    expect(fb.connection).not.toHaveProperty("credential_ref");

    const cards = await listConnectedAccountCards(ORG_A);
    expect(cards.find((c) => c.platform === "facebook")?.status).toBe("CONNECTED");
    expect(cards.find((c) => c.platform === "instagram")?.status).toBe("CONNECTED");
    expect(cards.find((c) => c.platform === "facebook")?.authorizedAssets.length).toBeGreaterThan(
      0,
    );
  });

  it("blocks LIVE provider redirects even when PROVIDER_MODE=LIVE", async () => {
    process.env.PROVIDER_MODE = "LIVE";
    process.env.ALLOW_LIVE_AD_PUBLISH = "true";
    process.env.META_APP_ID = "app";
    process.env.META_APP_SECRET = "secret";
    process.env.META_REDIRECT_URI = "https://example.com/callback";
    const result = await beginSocialOauthConnect({
      organizationId: ORG_A,
      platform: "facebook",
    });
    expect(result.redirect).toBe("blocked");
    expect(result.simulationOnly).toBe(true);
    if (result.redirect === "blocked") {
      expect(result.code).toBe("LIVE_OAUTH_NOT_ENABLED");
    }
    expect(JSON.stringify(result)).not.toMatch(/authorizeUrl|access_token|secret/);
  });

  it("enforces tenant isolation on disconnect", async () => {
    const connected = await beginSocialOauthConnect({
      organizationId: ORG_A,
      platform: "linkedin",
    });
    expect(connected.redirect).toBe("none");
    if (connected.redirect !== "none") return;
    const connectionId = connected.connection.id!;

    const cross = await disconnectSocialProvider({
      organizationId: ORG_B,
      provider: "linkedin",
      connectionId,
    });
    expect(cross.ok).toBe(false);

    const ok = await disconnectSocialProvider({
      organizationId: ORG_A,
      provider: "linkedin",
      connectionId,
    });
    expect(ok.ok).toBe(true);
    expect(
      (await listConnectedAccountCards(ORG_A)).find((c) => c.platform === "linkedin")
        ?.status,
    ).toBe("NOT_CONNECTED");
  });

  it("never returns sealed tokens in public views", async () => {
    const result = await beginSocialOauthConnect({
      organizationId: ORG_A,
      platform: "tiktok",
    });
    expect(result.redirect).toBe("none");
    if (result.redirect !== "none") return;
    expect(result.connection).not.toHaveProperty("credential_ref");
    expect(JSON.stringify(result.connection)).not.toMatch(
      /sim_access|access_token|refresh_token/,
    );
  });

  it("keeps vaulted tokens openable only server-side after connect", async () => {
    await beginSocialOauthConnect({ organizationId: ORG_A, platform: "tiktok" });
    const { getIntegrationStore } = await import(
      "@/application/integrations/integrationStore"
    );
    const conn = getIntegrationStore().connections.find(
      (c) => c.organization_id === ORG_A && c.provider === "tiktok",
    );
    expect(conn?.credential_ref).toBeTruthy();
    const opened = openTokenBundle(conn!.credential_ref);
    expect(opened.access_token).toContain("sim_access");
  });

  it("reconnect replaces the prior connection", async () => {
    const first = await beginSocialOauthConnect({
      organizationId: ORG_A,
      platform: "tiktok",
    });
    expect(first.redirect).toBe("none");
    if (first.redirect !== "none") return;
    const firstId = first.connection.id;
    const second = await reconnectSocialPlatform({
      organizationId: ORG_A,
      platform: "tiktok",
    });
    expect(second.redirect).toBe("none");
    if (second.redirect !== "none") return;
    expect(second.connection.id).not.toBe(firstId);
  });
});

describe("OAuth LIVE callback fail-closed", () => {
  it("discards codes without exchanging tokens", async () => {
    const { state } = createTestOauthState({
      organizationId: ORG_A,
      provider: "meta",
      platform: "facebook",
      profileId: "user-1",
    });
    const result = await completeSocialOauthCallback({
      state,
      code: "provider_code_should_not_be_logged",
      expectedProfileId: "user-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("LIVE_OAUTH_NOT_ENABLED");
    }
    const store = (await import("@/application/integrations/integrationStore")).getIntegrationStore();
    expect(store.connections).toHaveLength(0);
  });

  it("rejects tampered callback state", async () => {
    const result = await completeSocialOauthCallback({
      state: "not-a-valid-state",
      code: "abc",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects user-mismatched callback", async () => {
    const { state } = createTestOauthState({
      organizationId: ORG_A,
      provider: "meta",
      platform: "facebook",
      profileId: "user-1",
    });
    const result = await completeSocialOauthCallback({
      state,
      code: "abc",
      expectedProfileId: "user-2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STATE_USER_MISMATCH");
  });
});

describe("secret leakage checks", () => {
  it("public connection JSON never contains sealed material", async () => {
    const result = await beginSocialOauthConnect({
      organizationId: ORG_A,
      platform: "linkedin",
      profileId: "profile-x",
    });
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/credential_ref|sim_access_|sim_refresh_|META_APP_SECRET|Bearer /i);
  });
});
