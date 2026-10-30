import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function authMock(organizationId: string, permissionOk = true) {
  return {
    requireOrgAuth: vi.fn(async () =>
      permissionOk
        ? {
            ok: true as const,
            ctx: {
              configured: true,
              session: null,
              userId: "user-1",
              profileId: "profile-1",
              organizationId,
              memberId: "member-1",
              roleKeys: ["admin"],
              permissions: ["integrations.view", "integrations.manage"],
            },
          }
        : {
            ok: false as const,
            response: Response.json(
              { error: "Forbidden", code: "AUTHORIZATION_ERROR" },
              { status: 403 },
            ),
          },
    ),
  };
}

describe("connected-accounts API tenant isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PROVIDER_MODE = "SIMULATION";
    process.env.ALLOW_LIVE_AD_PUBLISH = "false";
  });

  it("scopes connections to the authenticated organization", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { resetIntegrationStore } = await import(
      "@/application/integrations/integrationStore"
    );
    resetIntegrationStore();

    const { POST, GET } = await import(
      "@/app/api/marketing/connected-accounts/route"
    );

    const connect = await POST(
      new Request("http://localhost/api/marketing/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", platform: "facebook" }),
      }),
    );
    expect(connect.status).toBe(200);

    const listA = await GET();
    const jsonA = await listA.json();
    expect(jsonA.platforms.find((p: { platform: string }) => p.platform === "facebook").status).toBe(
      "CONNECTED",
    );

    vi.resetModules();
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_B));
    const { GET: GET_B } = await import(
      "@/app/api/marketing/connected-accounts/route"
    );
    const listB = await GET_B();
    const jsonB = await listB.json();
    expect(
      jsonB.platforms.find((p: { platform: string }) => p.platform === "facebook").status,
    ).toBe("NOT_CONNECTED");
  });

  it("denies manage without permission", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () =>
      authMock(ORG_A, false),
    );
    const { POST } = await import(
      "@/app/api/marketing/connected-accounts/route"
    );
    const res = await POST(
      new Request("http://localhost/api/marketing/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", platform: "linkedin" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("connect response never leaks secrets or authorize URLs", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { resetIntegrationStore } = await import(
      "@/application/integrations/integrationStore"
    );
    resetIntegrationStore();
    const { POST } = await import(
      "@/app/api/marketing/connected-accounts/route"
    );
    const res = await POST(
      new Request("http://localhost/api/marketing/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", platform: "tiktok" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const blob = JSON.stringify(json);
    expect(json.simulationOnly).toBe(true);
    expect(blob).not.toMatch(/authorizeUrl|credential_ref|access_token|sim_access_/i);
  });
});
