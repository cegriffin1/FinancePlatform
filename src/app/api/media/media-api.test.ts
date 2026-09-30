import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

describe("media API auth gate", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("@/infrastructure/security/requireOrgAuth");
    vi.unstubAllEnvs();
  });

  it("blocks unauthenticated upload", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => ({
      requireOrgAuth: vi.fn(async () => ({
        ok: false as const,
        response: NextResponse.json(
          { error: "Authentication required", code: "AUTH_REQUIRED" },
          { status: 401 },
        ),
      })),
    }));
    const { POST } = await import("@/app/api/media/route");
    const res = await POST(
      new Request("http://localhost/api/media", { method: "POST" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("blocks unauthenticated list", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => ({
      requireOrgAuth: vi.fn(async () => ({
        ok: false as const,
        response: NextResponse.json(
          { error: "Authentication required", code: "AUTH_REQUIRED" },
          { status: 401 },
        ),
      })),
    }));
    const { GET } = await import("@/app/api/media/route");
    const res = await GET(new Request("http://localhost/api/media"));
    expect(res.status).toBe(401);
  });

  it("uses authenticated organization context (ignores forged org body)", async () => {
    const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => ({
      requireOrgAuth: vi.fn(async () => ({
        ok: true as const,
        ctx: {
          configured: true,
          session: null,
          userId: "user-a",
          profileId: "user-a",
          organizationId: ORG_A,
          memberId: "member-a",
          roleKeys: ["marketing"],
          permissions: ["campaigns.create", "campaigns.view", "campaigns.update"],
        },
      })),
    }));

    const { POST, GET } = await import("@/app/api/media/route");
    const form = new FormData();
    form.append(
      "file",
      new File([Buffer.from("jpeg-bytes")], "ad.jpg", { type: "image/jpeg" }),
    );
    form.append("organization_id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const created = await POST(
      new Request("http://localhost/api/media", { method: "POST", body: form }),
    );
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.asset.organization_id).toBe(ORG_A);

    const listed = await GET(new Request("http://localhost/api/media"));
    const listBody = await listed.json();
    expect(listBody.assets[0].organization_id).toBe(ORG_A);
  });
});
