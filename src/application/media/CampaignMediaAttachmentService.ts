import { randomUUID } from "crypto";
import type {
  CampaignMediaAttachment,
  CampaignMediaAttachmentPublic,
} from "@/domain/media/attachments";
import type {
  CreativeAttachmentRole,
  CreativeDestination,
} from "@/domain/media/destinations";
import {
  computeCreativeReadiness,
  evaluateCreativeCompatibility,
  type CompatibilityResult,
  type ConnectionUsability,
} from "@/domain/media/creativeCompatibility";
import type { MediaAsset } from "@/domain/media/types";
import {
  MediaAssetService,
  resetSimMediaAssets,
} from "@/application/media/MediaAssetService";
import { SupabaseCampaignMediaAttachmentRepository } from "@/infrastructure/supabase/repositories/SupabaseCampaignMediaAttachmentRepository";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

type SimCampaign = { id: string; organization_id: string; name: string };

const simAttachments = new Map<string, CampaignMediaAttachment>();
const simCampaigns = new Map<string, SimCampaign>();
/** media mirror for attachment joins in simulation — keyed by id */
const simMediaMirror = new Map<string, MediaAsset>();

function toPublicAttachment(
  row: CampaignMediaAttachment,
  media: MediaAsset,
): CampaignMediaAttachmentPublic {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    media_asset_id: row.media_asset_id,
    destination: row.destination,
    role: row.role,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media: {
      id: media.id,
      original_filename: media.original_filename,
      mime_type: media.mime_type,
      media_type: media.media_type,
      size_bytes: media.size_bytes,
      width: media.width,
      height: media.height,
      duration_seconds: media.duration_seconds,
      status: media.status,
      created_at: media.created_at,
    },
  };
}

export class CampaignMediaAttachmentService {
  private readonly repo = new SupabaseCampaignMediaAttachmentRepository();
  private readonly mediaService = new MediaAssetService();

  /** Test/sim helper — register a campaign for attachment FK checks. */
  ensureSimCampaign(campaign: SimCampaign) {
    simCampaigns.set(campaign.id, campaign);
  }

  /** Test/sim helper — register media for attach joins. */
  registerSimMedia(asset: MediaAsset) {
    simMediaMirror.set(asset.id, asset);
  }

  async listAttachments(
    organizationId: string,
    campaignId: string,
  ): Promise<CampaignMediaAttachmentPublic[]> {
    if (!isSupabaseDataMode()) {
      const campaign = simCampaigns.get(campaignId);
      if (!campaign || campaign.organization_id !== organizationId) {
        throw new DataModeError("Campaign not found.");
      }
      const rows = [...simAttachments.values()]
        .filter(
          (a) =>
            a.organization_id === organizationId &&
            a.campaign_id === campaignId,
        )
        .sort((a, b) => a.sort_order - b.sort_order);
      const out: CampaignMediaAttachmentPublic[] = [];
      for (const row of rows) {
        const media =
          (await this.loadSimMedia(organizationId, row.media_asset_id)) ||
          simMediaMirror.get(row.media_asset_id);
        if (!media || media.organization_id !== organizationId) continue;
        out.push(toPublicAttachment(row, media));
      }
      return out;
    }

    const campaign = await this.repo.getCampaignOrg(campaignId, organizationId);
    if (!campaign) throw new DataModeError("Campaign not found.");

    const rows = await this.repo.listForCampaign(campaignId, organizationId);
    const out: CampaignMediaAttachmentPublic[] = [];
    for (const row of rows) {
      const media = await this.repo.getMediaForOrg(
        row.media_asset_id,
        organizationId,
      );
      if (!media) continue;
      out.push(toPublicAttachment(row, media));
    }
    return out;
  }

  async attachMedia(input: {
    organizationId: string;
    campaignId: string;
    mediaAssetId: string;
    destination?: CreativeDestination | null;
    role?: CreativeAttachmentRole;
    sortOrder?: number;
  }): Promise<CampaignMediaAttachmentPublic> {
    const role = input.role ?? "PRIMARY";
    const destination = input.destination ?? null;
    const sortOrder = input.sortOrder ?? 0;

    if (!isSupabaseDataMode()) {
      const campaign = simCampaigns.get(input.campaignId);
      if (!campaign || campaign.organization_id !== input.organizationId) {
        throw Object.assign(new Error("Campaign not found."), {
          code: "NOT_FOUND",
        });
      }
      const media =
        simMediaMirror.get(input.mediaAssetId) ||
        (await this.loadSimMedia(input.organizationId, input.mediaAssetId));
      if (!media || media.organization_id !== input.organizationId) {
        throw Object.assign(new Error("Media asset not found."), {
          code: "NOT_FOUND",
        });
      }
      if (media.status !== "ACTIVE") {
        throw Object.assign(new Error("Archived media cannot be attached."), {
          code: "ARCHIVED_MEDIA",
        });
      }
      const duplicate = [...simAttachments.values()].find(
        (a) =>
          a.campaign_id === input.campaignId &&
          a.media_asset_id === input.mediaAssetId &&
          a.role === role &&
          (a.destination || "") === (destination || ""),
      );
      if (duplicate) {
        throw Object.assign(new Error("Attachment already exists."), {
          code: "DUPLICATE",
        });
      }
      const now = new Date().toISOString();
      const row: CampaignMediaAttachment = {
        id: randomUUID(),
        organization_id: input.organizationId,
        campaign_id: input.campaignId,
        media_asset_id: input.mediaAssetId,
        destination,
        role,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
      };
      simAttachments.set(row.id, row);
      simMediaMirror.set(media.id, media);
      return toPublicAttachment(row, media);
    }

    const campaign = await this.repo.getCampaignOrg(
      input.campaignId,
      input.organizationId,
    );
    if (!campaign) {
      throw Object.assign(new Error("Campaign not found."), { code: "NOT_FOUND" });
    }
    const media = await this.repo.getMediaForOrg(
      input.mediaAssetId,
      input.organizationId,
    );
    if (!media) {
      throw Object.assign(new Error("Media asset not found."), {
        code: "NOT_FOUND",
      });
    }
    if (media.status !== "ACTIVE") {
      throw Object.assign(new Error("Archived media cannot be attached."), {
        code: "ARCHIVED_MEDIA",
      });
    }

    try {
      const row = await this.repo.insert({
        id: randomUUID(),
        organization_id: input.organizationId,
        campaign_id: input.campaignId,
        media_asset_id: input.mediaAssetId,
        destination,
        role,
        sort_order: sortOrder,
      });
      return toPublicAttachment(row, media);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Attach failed";
      if (/unique|duplicate/i.test(msg)) {
        throw Object.assign(new Error("Attachment already exists."), {
          code: "DUPLICATE",
        });
      }
      if (/organization_id mismatch|null organization/i.test(msg)) {
        throw Object.assign(new Error("Cross-tenant attachment blocked."), {
          code: "TENANT_VIOLATION",
        });
      }
      throw e;
    }
  }

  async detachMedia(input: {
    organizationId: string;
    attachmentId: string;
  }): Promise<boolean> {
    if (!isSupabaseDataMode()) {
      const row = simAttachments.get(input.attachmentId);
      if (!row || row.organization_id !== input.organizationId) return false;
      simAttachments.delete(input.attachmentId);
      return true;
    }
    return this.repo.deleteForOrg(input.attachmentId, input.organizationId);
  }

  async evaluateAttachments(input: {
    organizationId: string;
    campaignId: string;
    selectedDestinations: CreativeDestination[];
    connectionByProvider?: Partial<
      Record<"META" | "LINKEDIN" | "TIKTOK", string>
    >;
  }): Promise<{
    attachments: CampaignMediaAttachmentPublic[];
    compatibility: Array<{
      attachmentId: string;
      destination: CreativeDestination;
      result: CompatibilityResult;
    }>;
    readiness: ReturnType<typeof computeCreativeReadiness>;
  }> {
    const attachments = await this.listAttachments(
      input.organizationId,
      input.campaignId,
    );
    const compatibility: Array<{
      attachmentId: string;
      destination: CreativeDestination;
      result: CompatibilityResult;
    }> = [];

    for (const att of attachments) {
      for (const destination of input.selectedDestinations) {
        if (att.destination && att.destination !== destination) continue;
        const provider =
          destination === "FACEBOOK" || destination === "INSTAGRAM"
            ? "META"
            : destination === "LINKEDIN"
              ? "LINKEDIN"
              : "TIKTOK";
        const result = evaluateCreativeCompatibility({
          mediaAsset: att.media,
          destination,
          connectionStatus:
            input.connectionByProvider?.[provider] ?? "NOT_CONNECTED",
        });
        compatibility.push({
          attachmentId: att.id,
          destination,
          result,
        });
      }
    }

    const readiness = computeCreativeReadiness({
      selectedDestinations: input.selectedDestinations,
      attachments: attachments.map((a) => ({
        destination: a.destination,
        media: a.media,
      })),
    });

    return { attachments, compatibility, readiness };
  }

  async ensureDurableDraftCampaign(input: {
    organizationId: string;
    name: string;
    campaignId?: string | null;
    createdBy?: string | null;
  }): Promise<string> {
    if (!isSupabaseDataMode()) {
      const id = input.campaignId || randomUUID();
      this.ensureSimCampaign({
        id,
        organization_id: input.organizationId,
        name: input.name,
      });
      return id;
    }
    const ensured = await this.repo.ensureDraftCampaign({
      id: input.campaignId,
      organizationId: input.organizationId,
      name: input.name,
      createdBy: input.createdBy,
    });
    return ensured.id;
  }

  private async loadSimMedia(organizationId: string, mediaAssetId: string) {
    const listed = await this.mediaService.listMediaAssets(organizationId, {
      includeArchived: true,
    });
    const pub = listed.find((a) => a.id === mediaAssetId);
    if (!pub) return null;
    // Reconstruct minimal MediaAsset for mirror (storage_key omitted publicly)
    const asset: MediaAsset = {
      id: pub.id,
      organization_id: organizationId,
      original_filename: pub.original_filename,
      storage_key: `sim/${organizationId}/${pub.id}`,
      mime_type: pub.mime_type,
      media_type: pub.media_type,
      size_bytes: pub.size_bytes,
      width: pub.width,
      height: pub.height,
      duration_seconds: pub.duration_seconds,
      checksum_sha256: pub.checksum_sha256,
      status: pub.status,
      created_by: pub.created_by,
      created_at: pub.created_at,
      updated_at: pub.updated_at,
    };
    simMediaMirror.set(asset.id, asset);
    return asset;
  }
}

export function resetSimCampaignMediaAttachments() {
  simAttachments.clear();
  simCampaigns.clear();
  simMediaMirror.clear();
}

/** Keep media sim store reset helpers co-located for tests. */
export { resetSimMediaAssets };

export type { ConnectionUsability };
