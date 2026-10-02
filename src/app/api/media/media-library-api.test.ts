import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetSimMediaAssets } from "@/application/media/MediaAssetService";
import {
  emptyStateCopy,
  filterMediaAssets,
  mapMediaUploadError,
  type MediaLibraryAsset,
} from "@/application/media/mediaLibraryUi";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function authMock(orgId: string) {
  return {
    requireOrgAuth: vi.fn(async () => ({
      ok: true as const,
      ctx: {
        configured: true,
        session: null,
        userId: "user-a",
        profileId: "user-a",
        organizationId: orgId,
        memberId: "member-a",
        roleKeys: ["admin"],
        permissions: [
          "campaigns.create",
          "campaigns.view",
          "campaigns.update",
        ],
      },
    })),
  };
}

describe("Media Library API integration (Slice B)", () => {
  beforeEach(() => {
    resetSimMediaAssets();
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
  });

  afterEach(() => {
    resetSimMediaAssets();
    vi.resetModules();
    vi.unmock("@/infrastructure/security/requireOrgAuth");
    vi.unstubAllEnvs();
  });

  it("authenticated library lists IMAGE / VIDEO / DOCUMENT assets", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { POST, GET } = await import("@/app/api/media/route");

    for (const [name, type, bytes] of [
      ["hero.jpg", "image/jpeg", "jpeg"],
      ["clip.mp4", "video/mp4", "mp4bytes"],
      ["brief.pdf", "application/pdf", "%PDF-1.4"],
    ] as const) {
      const form = new FormData();
      form.append("file", new File([Buffer.from(bytes)], name, { type }));
      const res = await POST(
        new Request("http://localhost/api/media", { method: "POST", body: form }),
      );
      expect(res.status).toBe(200);
    }

    const listed = await GET(
      new Request("http://localhost/api/media?includeArchived=1"),
    );
    expect(listed.status).toBe(200);
    const body = await listed.json();
    const assets = body.assets as MediaLibraryAsset[];
    expect(assets).toHaveLength(3);
    expect(new Set(assets.map((a) => a.media_type))).toEqual(
      new Set(["IMAGE", "VIDEO", "DOCUMENT"]),
    );
    for (const a of assets) {
      expect((a as { storage_key?: string }).storage_key).toBeUndefined();
      expect(a.organization_id).toBe(ORG_A);
    }

    const active = filterMediaAssets(assets, "ALL", "ACTIVE");
    expect(active).toHaveLength(3);
    expect(emptyStateCopy("ALL", "ACTIVE", active.length > 0).title).not.toBe(
      "Your media library is ready.",
    );
  });

  it("upload validation failure returns safe mapped UX copy", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { POST } = await import("@/app/api/media/route");
    const form = new FormData();
    form.append(
      "file",
      new File([Buffer.from("nope")], "malware.exe", { type: "application/octet-stream" }),
    );
    const res = await POST(
      new Request("http://localhost/api/media", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    const msg = mapMediaUploadError(res.status, body);
    expect(msg).toMatch(/Unsupported file type|extension|failed/i);
  });

  it("archive success removes from ACTIVE and appears in ARCHIVED", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { POST, GET } = await import("@/app/api/media/route");
    const { PATCH } = await import("@/app/api/media/[id]/route");

    const form = new FormData();
    form.append(
      "file",
      new File([Buffer.from("png")], "keep.png", { type: "image/png" }),
    );
    const created = await POST(
      new Request("http://localhost/api/media", { method: "POST", body: form }),
    );
    const { asset } = await created.json();

    const archived = await PATCH(
      new Request("http://localhost/api/media/" + asset.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", organization_id: ORG_B }),
      }),
      { params: Promise.resolve({ id: asset.id }) },
    );
    expect(archived.status).toBe(200);
    const archivedBody = await archived.json();
    expect(archivedBody.asset.status).toBe("ARCHIVED");

    const activeList = await GET(new Request("http://localhost/api/media"));
    const activeBody = await activeList.json();
    expect(
      filterMediaAssets(activeBody.assets, "ALL", "ACTIVE").find(
        (a) => a.id === asset.id,
      ),
    ).toBeUndefined();

    const all = await GET(
      new Request("http://localhost/api/media?includeArchived=1"),
    );
    const allBody = await all.json();
    expect(
      filterMediaAssets(allBody.assets, "ALL", "ARCHIVED").some(
        (a) => a.id === asset.id,
      ),
    ).toBe(true);
  });

  it("signed preview access works for owner org", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { POST } = await import("@/app/api/media/route");
    const { GET: getAccess } = await import("@/app/api/media/[id]/access/route");

    const form = new FormData();
    form.append(
      "file",
      new File([Buffer.from("img")], "p.webp", { type: "image/webp" }),
    );
    const created = await POST(
      new Request("http://localhost/api/media", { method: "POST", body: form }),
    );
    const { asset } = await created.json();

    const access = await getAccess(
      new Request("http://localhost/api/media/" + asset.id + "/access"),
      { params: Promise.resolve({ id: asset.id }) },
    );
    expect(access.status).toBe(200);
    const body = await access.json();
    expect(body.url).toContain("sim://campaign-media/");
    expect(body.expiresInSeconds).toBeGreaterThan(0);
  });

  it("cross-tenant asset access is unavailable", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { POST } = await import("@/app/api/media/route");
    const createdMod = await import("@/app/api/media/route");
    const form = new FormData();
    form.append(
      "file",
      new File([Buffer.from("img")], "secret.jpg", { type: "image/jpeg" }),
    );
    const created = await createdMod.POST(
      new Request("http://localhost/api/media", { method: "POST", body: form }),
    );
    const { asset } = await created.json();

    vi.resetModules();
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_B));
    const { GET } = await import("@/app/api/media/[id]/route");
    const { GET: getAccess } = await import("@/app/api/media/[id]/access/route");
    const { PATCH } = await import("@/app/api/media/[id]/route");

    const detail = await GET(
      new Request("http://localhost/api/media/" + asset.id),
      { params: Promise.resolve({ id: asset.id }) },
    );
    expect(detail.status).toBe(404);

    const access = await getAccess(
      new Request("http://localhost/api/media/" + asset.id + "/access"),
      { params: Promise.resolve({ id: asset.id }) },
    );
    expect([404, 400, 503]).toContain(access.status);

    const archive = await PATCH(
      new Request("http://localhost/api/media/" + asset.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      }),
      { params: Promise.resolve({ id: asset.id }) },
    );
    expect(archive.status).toBe(404);

    // silence unused
    void POST;
  });

  it("unauthenticated media library APIs stay blocked", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => ({
      requireOrgAuth: vi.fn(async () => ({
        ok: false as const,
        response: NextResponse.json(
          { error: "Authentication required", code: "AUTH_REQUIRED" },
          { status: 401 },
        ),
      })),
    }));
    const { GET, POST } = await import("@/app/api/media/route");
    const { PATCH } = await import("@/app/api/media/[id]/route");
    expect((await GET(new Request("http://localhost/api/media"))).status).toBe(
      401,
    );
    expect(
      (
        await POST(
          new Request("http://localhost/api/media", { method: "POST" }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await PATCH(
          new Request("http://localhost/api/media/x", {
            method: "PATCH",
            body: JSON.stringify({ action: "archive" }),
          }),
          { params: Promise.resolve({ id: "x" }) },
        )
      ).status,
    ).toBe(401);
  });
});
