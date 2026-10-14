import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CampaignMediaAttachmentService,
  resetSimCampaignMediaAttachments,
} from "@/application/media/CampaignMediaAttachmentService";
import {
  MediaAssetService,
  resetSimMediaAssets,
} from "@/application/media/MediaAssetService";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAMPAIGN_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CAMPAIGN_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("CampaignMediaAttachmentService (simulation)", () => {
  beforeEach(() => {
    resetSimMediaAssets();
    resetSimCampaignMediaAttachments();
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
  });
  afterEach(() => {
    resetSimMediaAssets();
    resetSimCampaignMediaAttachments();
    vi.unstubAllEnvs();
  });

  async function seedActiveImage(orgId: string) {
    const media = new MediaAssetService();
    const created = await media.createMediaAsset({
      organizationId: orgId,
      createdBy: "user",
      filename: "hero.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from("jpeg-bytes"),
    });
    return created.asset;
  }

  it("attaches active same-org asset and lists on reload", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const asset = await seedActiveImage(ORG_A);
    const attached = await svc.attachMedia({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_A,
      mediaAssetId: asset.id,
      destination: null,
    });
    expect(attached.media_asset_id).toBe(asset.id);
    const listed = await svc.listAttachments(ORG_A, CAMPAIGN_A);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(attached.id);
  });

  it("rejects archived asset attach", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const media = new MediaAssetService();
    const created = await media.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user",
      filename: "old.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from("jpeg"),
    });
    await media.archiveMediaAsset(ORG_A, created.asset.id);
    await expect(
      svc.attachMedia({
        organizationId: ORG_A,
        campaignId: CAMPAIGN_A,
        mediaAssetId: created.asset.id,
      }),
    ).rejects.toMatchObject({ code: "ARCHIVED_MEDIA" });
  });

  it("rejects cross-org asset attach", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const assetB = await seedActiveImage(ORG_B);
    await expect(
      svc.attachMedia({
        organizationId: ORG_A,
        campaignId: CAMPAIGN_A,
        mediaAssetId: assetB.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("detaches without deleting media original", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const asset = await seedActiveImage(ORG_A);
    const attached = await svc.attachMedia({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_A,
      mediaAssetId: asset.id,
    });
    expect(await svc.detachMedia({ organizationId: ORG_A, attachmentId: attached.id })).toBe(
      true,
    );
    const media = await new MediaAssetService().getMediaAsset(ORG_A, asset.id);
    expect(media?.id).toBe(asset.id);
    expect(await svc.listAttachments(ORG_A, CAMPAIGN_A)).toHaveLength(0);
  });

  it("supports multiple assets and destination-specific attachments", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const a1 = await seedActiveImage(ORG_A);
    const a2 = await new MediaAssetService().createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user",
      filename: "clip.mp4",
      mimeType: "video/mp4",
      bytes: Buffer.from("mp4"),
    });
    await svc.attachMedia({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_A,
      mediaAssetId: a1.id,
      destination: "FACEBOOK",
    });
    await svc.attachMedia({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_A,
      mediaAssetId: a2.asset.id,
      destination: "TIKTOK",
    });
    const listed = await svc.listAttachments(ORG_A, CAMPAIGN_A);
    expect(listed).toHaveLength(2);
  });

  it("blocks org B from listing org A attachments", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    svc.ensureSimCampaign({
      id: CAMPAIGN_B,
      organization_id: ORG_B,
      name: "B",
    });
    const asset = await seedActiveImage(ORG_A);
    await svc.attachMedia({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_A,
      mediaAssetId: asset.id,
    });
    await expect(svc.listAttachments(ORG_B, CAMPAIGN_A)).rejects.toThrow(
      /not found/i,
    );
  });

  it("preserves historical attachment when media is later archived", async () => {
    const svc = new CampaignMediaAttachmentService();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const mediaSvc = new MediaAssetService();
    const created = await mediaSvc.createMediaAsset({
      organizationId: ORG_A,
      createdBy: "user",
      filename: "keep.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from("jpeg"),
    });
    await svc.attachMedia({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_A,
      mediaAssetId: created.asset.id,
    });
    await mediaSvc.archiveMediaAsset(ORG_A, created.asset.id);
    // re-register archived media into mirror via list path
    const listed = await svc.listAttachments(ORG_A, CAMPAIGN_A);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.media.status).toBe("ARCHIVED");
  });
});
