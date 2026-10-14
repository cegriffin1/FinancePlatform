import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetSimCampaignMediaAttachments } from "@/application/media/CampaignMediaAttachmentService";
import { resetSimMediaAssets } from "@/application/media/MediaAssetService";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMPAIGN_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function authMock(orgId: string, permissionOk = true) {
  return {
    requireOrgAuth: vi.fn(async () =>
      permissionOk
        ? {
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
                "campaigns.view",
                "campaigns.create",
                "campaigns.update",
              ],
            },
          }
        : {
            ok: false as const,
            response: NextResponse.json(
              { error: "Authentication required", code: "AUTH_REQUIRED" },
              { status: 401 },
            ),
          },
    ),
  };
}

describe("campaign media attachment API", () => {
  beforeEach(() => {
    resetSimMediaAssets();
    resetSimCampaignMediaAttachments();
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
  });

  afterEach(() => {
    resetSimMediaAssets();
    resetSimCampaignMediaAttachments();
    vi.resetModules();
    vi.unmock("@/infrastructure/security/requireOrgAuth");
    vi.unstubAllEnvs();
  });

  it("blocks unauthenticated list/attach", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () =>
      authMock(ORG_A, false),
    );
    const { GET, POST } = await import("@/app/api/campaigns/[id]/media/route");
    expect(
      (
        await GET(new Request("http://localhost/api/campaigns/x/media"), {
          params: Promise.resolve({ id: "x" }),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await POST(
          new Request("http://localhost/api/campaigns/x/media", {
            method: "POST",
            body: JSON.stringify({ media_asset_id: "m" }),
          }),
          { params: Promise.resolve({ id: "x" }) },
        )
      ).status,
    ).toBe(401);
  });

  it("attaches and lists for authenticated org", async () => {
    vi.doMock("@/infrastructure/security/requireOrgAuth", () => authMock(ORG_A));
    const { POST, GET } = await import("@/app/api/campaigns/[id]/media/route");
    const { CampaignMediaAttachmentService: Svc } = await import(
      "@/application/media/CampaignMediaAttachmentService"
    );
    const { MediaAssetService: MediaSvc } = await import(
      "@/application/media/MediaAssetService"
    );
    const svc = new Svc();
    svc.ensureSimCampaign({
      id: CAMPAIGN_A,
      organization_id: ORG_A,
      name: "A",
    });
    const media = await new MediaSvc().createMediaAsset({
      organizationId: ORG_A,
      createdBy: "u",
      filename: "a.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from("jpg"),
    });

    const attached = await POST(
      new Request("http://localhost/api/campaigns/" + CAMPAIGN_A + "/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_asset_id: media.asset.id,
          organization_id: "forged-org",
        }),
      }),
      { params: Promise.resolve({ id: CAMPAIGN_A }) },
    );
    expect(attached.status).toBe(200);
    const body = await attached.json();
    expect(body.attachment.media_asset_id).toBe(media.asset.id);

    const listed = await GET(
      new Request(
        "http://localhost/api/campaigns/" +
          CAMPAIGN_A +
          "/media?destination=FACEBOOK",
      ),
      { params: Promise.resolve({ id: CAMPAIGN_A }) },
    );
    expect(listed.status).toBe(200);
    const listBody = await listed.json();
    expect(listBody.attachments).toHaveLength(1);
    expect(listBody.readiness).toBeTruthy();
  });
});
