import { describe, expect, it, beforeEach } from "vitest";
import {
  createOauthState,
  consumeOauthState,
  resetOauthStateStore,
} from "@/application/integrations/oauthStateStore";

beforeEach(() => {
  resetOauthStateStore();
  delete process.env.OAUTH_STATE_SIGNING_SECRET;
  delete process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
});

describe("oauthStateStore", () => {
  it("creates and consumes a valid state once", () => {
    const { state, payload } = createOauthState({
      organizationId: "org-a",
      provider: "meta",
      platform: "facebook",
      profileId: "profile-1",
    });
    expect(payload.organizationId).toBe("org-a");
    const first = consumeOauthState(state);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.payload.platform).toBe("facebook");
      expect(first.payload.profileId).toBe("profile-1");
    }
    const replay = consumeOauthState(state);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.code).toMatch(/STATE_/);
  });

  it("rejects tampered state signatures", () => {
    const { state } = createOauthState({
      organizationId: "org-a",
      provider: "linkedin",
      platform: "linkedin",
    });
    const tampered = state.replace(/\.[^.]+$/, ".AAAAAAAAAAAAAAAAAAAAAA");
    const result = consumeOauthState(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STATE_TAMPERED");
  });

  it("rejects expired state", () => {
    const { state } = createOauthState({
      organizationId: "org-a",
      provider: "tiktok",
      platform: "tiktok",
      ttlMs: -1,
    });
    const result = consumeOauthState(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STATE_EXPIRED");
  });

  it("enforces organization and user binding", () => {
    const { state } = createOauthState({
      organizationId: "org-a",
      provider: "meta",
      platform: "facebook",
      profileId: "user-1",
    });
    const wrongOrg = consumeOauthState(state, { expectedOrganizationId: "org-b" });
    expect(wrongOrg.ok).toBe(false);
    if (!wrongOrg.ok) expect(wrongOrg.code).toBe("STATE_ORG_MISMATCH");

    const { state: state2 } = createOauthState({
      organizationId: "org-a",
      provider: "meta",
      platform: "instagram",
      profileId: "user-1",
    });
    const wrongUser = consumeOauthState(state2, { expectedProfileId: "user-2" });
    expect(wrongUser.ok).toBe(false);
    if (!wrongUser.ok) expect(wrongUser.code).toBe("STATE_USER_MISMATCH");
  });

  it("handles concurrent consumption safely (only one winner)", async () => {
    const { state } = createOauthState({
      organizationId: "org-a",
      provider: "meta",
      platform: "facebook",
      profileId: "user-1",
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        Promise.resolve(consumeOauthState(state, { expectedOrganizationId: "org-a" })),
      ),
    );
    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(19);
    expect(losses.every((r) => !r.ok && r.code.startsWith("STATE_"))).toBe(true);
  });
});
