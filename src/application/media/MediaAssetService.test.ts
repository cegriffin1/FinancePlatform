import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MediaAssetService,
  resetSimMediaAssets,
} from "@/application/media/MediaAssetService";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("MediaAssetService (simulation mode)", () => {
  beforeEach(() => {
    resetSimMediaAssets();
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
  });
  afterEach(() => {
    resetSimMediaAssets();
    vi.unstubAllEnvs();
  });

  it("creates, lists, gets, archives within one org", async () => {
    const svc = new MediaAssetService();
    const created = await svc.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user-a",
      filename: "hero.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from("fake-jpeg-bytes"),
    });
    expect(created.asset.organization_id).toBe(ORG_A);
    expect(created.asset.media_type).toBe("IMAGE");
    expect(created.asset.checksum_sha256).toHaveLength(64);
    expect(
      (created.asset as { storage_key?: string }).storage_key,
    ).toBeUndefined();

    const listed = await svc.listMediaAssets(ORG_A);
    expect(listed).toHaveLength(1);

    const got = await svc.getMediaAsset(ORG_A, created.asset.id);
    expect(got?.id).toBe(created.asset.id);

    const access = await svc.getMediaAccessUrl(ORG_A, created.asset.id);
    expect(access.url).toContain("sim://campaign-media/");

    const archived = await svc.archiveMediaAsset(ORG_A, created.asset.id);
    expect(archived?.status).toBe("ARCHIVED");
    expect(await svc.listMediaAssets(ORG_A)).toHaveLength(0);
    expect(
      await svc.listMediaAssets(ORG_A, { includeArchived: true }),
    ).toHaveLength(1);
  });

  it("blocks cross-tenant metadata read / archive / access", async () => {
    const svc = new MediaAssetService();
    const created = await svc.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user-a",
      filename: "secret.png",
      mimeType: "image/png",
      bytes: Buffer.from("png"),
    });

    expect(await svc.getMediaAsset(ORG_B, created.asset.id)).toBeNull();
    expect(await svc.listMediaAssets(ORG_B)).toHaveLength(0);
    expect(await svc.archiveMediaAsset(ORG_B, created.asset.id)).toBeNull();
    await expect(
      svc.getMediaAccessUrl(ORG_B, created.asset.id),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects forged org by never using client org outside caller args", async () => {
    const svc = new MediaAssetService();
    const created = await svc.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user-a",
      filename: "ok.webp",
      mimeType: "image/webp",
      bytes: Buffer.from("webp"),
    });
    // Caller must pass auth org — forging B cannot see A's asset
    expect(await svc.getMediaAsset(ORG_B, created.asset.id)).toBeNull();
  });

  it("reports informational duplicate checksum count", async () => {
    const svc = new MediaAssetService();
    const bytes = Buffer.from("same-bytes");
    await svc.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user-a",
      filename: "a.jpg",
      mimeType: "image/jpeg",
      bytes,
    });
    const second = await svc.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user-a",
      filename: "b.jpg",
      mimeType: "image/jpeg",
      bytes,
    });
    expect(second.duplicateChecksumCount).toBe(1);
  });

  it("rejects invalid uploads before persistence", async () => {
    const svc = new MediaAssetService();
    await expect(
      svc.createMediaAsset({
        organizationId: ORG_A,
        createdBy: "user-a",
        filename: "x.exe",
        mimeType: "application/octet-stream",
        bytes: Buffer.from("x"),
      }),
    ).rejects.toThrow(/Unsupported|not allowed|extension/i);
  });
});

describe("MediaAssetService supabase mode safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not silently succeed via simulation when supabase mode fails", async () => {
    vi.stubEnv("ALTUS_DATA_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    // Missing service role → repository cannot upload; must throw, not invent sim asset
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { DataModeError } = await import("@/lib/dataMode");
    const svc = new MediaAssetService();
    await expect(
      svc.createMediaAsset({
        organizationId: ORG_A,
        createdBy: "user-a",
        filename: "hero.jpg",
        mimeType: "image/jpeg",
        bytes: Buffer.from("bytes"),
      }),
    ).rejects.toBeInstanceOf(DataModeError);
  });
});
