import { randomUUID } from "crypto";
import { sha256Hex } from "@/domain/media/checksum";
import {
  buildMediaStorageKey,
  validateMediaUpload,
} from "@/domain/media/validation";
import type { MediaAsset } from "@/domain/media/types";
import { SupabaseMediaAssetRepository } from "@/infrastructure/supabase/repositories/SupabaseMediaAssetRepository";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

/** In-memory store for simulation-mode unit/dev only — never used as supabase fallback. */
const simAssets = new Map<string, MediaAsset>();

function toPublic(asset: MediaAsset) {
  return {
    id: asset.id,
    organization_id: asset.organization_id,
    original_filename: asset.original_filename,
    mime_type: asset.mime_type,
    media_type: asset.media_type,
    size_bytes: asset.size_bytes,
    width: asset.width,
    height: asset.height,
    duration_seconds: asset.duration_seconds,
    checksum_sha256: asset.checksum_sha256,
    status: asset.status,
    created_by: asset.created_by,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  };
}

export type CreateMediaAssetInput = {
  organizationId: string;
  createdBy: string | null;
  filename: string;
  mimeType: string | null | undefined;
  bytes: Buffer;
};

export class MediaAssetService {
  private readonly repo = new SupabaseMediaAssetRepository();

  async createMediaAsset(input: CreateMediaAssetInput) {
    const validation = validateMediaUpload({
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
    });
    if (!validation.ok) {
      const err = new Error(validation.error);
      (err as Error & { code?: string }).code = validation.code;
      throw err;
    }

    const assetId = randomUUID();
    const checksum = sha256Hex(input.bytes);
    const storageKey = buildMediaStorageKey({
      organizationId: input.organizationId,
      assetId,
      safeFilename: validation.safeFilename,
    });
    const now = new Date().toISOString();
    const asset: MediaAsset = {
      id: assetId,
      organization_id: input.organizationId,
      original_filename: input.filename.replace(/\\/g, "/").split("/").pop() ||
        validation.safeFilename,
      storage_key: storageKey,
      mime_type: validation.mimeType,
      media_type: validation.mediaType,
      size_bytes: input.bytes.byteLength,
      width: null,
      height: null,
      duration_seconds: null,
      checksum_sha256: checksum,
      status: "ACTIVE",
      created_by: input.createdBy,
      created_at: now,
      updated_at: now,
    };

    if (!isSupabaseDataMode()) {
      simAssets.set(asset.id, asset);
      return {
        asset: toPublic(asset),
        duplicateChecksumCount: [...simAssets.values()].filter(
          (a) =>
            a.organization_id === input.organizationId &&
            a.checksum_sha256 === checksum &&
            a.id !== asset.id,
        ).length,
      };
    }

    // Durable path: upload original first, then metadata. Clean up on metadata failure.
    await this.repo.uploadObject({
      storageKey,
      bytes: input.bytes,
      mimeType: validation.mimeType,
    });
    try {
      const saved = await this.repo.insertMetadata(asset);
      const siblings = await this.repo.listForOrg(input.organizationId, {
        includeArchived: true,
      });
      const duplicateChecksumCount = siblings.filter(
        (a) => a.checksum_sha256 === checksum && a.id !== saved.id,
      ).length;
      return { asset: toPublic(saved), duplicateChecksumCount };
    } catch (e) {
      await this.repo.removeObject(storageKey);
      throw e;
    }
  }

  async getMediaAsset(organizationId: string, assetId: string) {
    if (!isSupabaseDataMode()) {
      const asset = simAssets.get(assetId);
      if (!asset || asset.organization_id !== organizationId) return null;
      return toPublic(asset);
    }
    const asset = await this.repo.getByIdForOrg(assetId, organizationId);
    return asset ? toPublic(asset) : null;
  }

  async listMediaAssets(
    organizationId: string,
    options?: { includeArchived?: boolean },
  ) {
    if (!isSupabaseDataMode()) {
      return [...simAssets.values()]
        .filter(
          (a) =>
            a.organization_id === organizationId &&
            (options?.includeArchived || a.status === "ACTIVE"),
        )
        .map(toPublic);
    }
    const rows = await this.repo.listForOrg(organizationId, options);
    return rows.map(toPublic);
  }

  async archiveMediaAsset(organizationId: string, assetId: string) {
    if (!isSupabaseDataMode()) {
      const asset = simAssets.get(assetId);
      if (!asset || asset.organization_id !== organizationId) return null;
      asset.status = "ARCHIVED";
      asset.updated_at = new Date().toISOString();
      simAssets.set(assetId, asset);
      return toPublic(asset);
    }
    const archived = await this.repo.archiveForOrg(assetId, organizationId);
    return archived ? toPublic(archived) : null;
  }

  async getMediaAccessUrl(organizationId: string, assetId: string) {
    if (!isSupabaseDataMode()) {
      const asset = simAssets.get(assetId);
      if (!asset || asset.organization_id !== organizationId) {
        throw new DataModeError("Media asset not found.");
      }
      // Simulation: no real signed URL — return opaque placeholder for tests
      return {
        url: `sim://campaign-media/${asset.storage_key}`,
        expiresInSeconds: 600,
      };
    }
    const asset = await this.repo.getByIdForOrg(assetId, organizationId);
    if (!asset) {
      throw new DataModeError("Media asset not found.");
    }
    const url = await this.repo.createSignedUrl(asset.storage_key);
    return { url, expiresInSeconds: 600 };
  }
}

/** Test helper — clear simulation media store between cases. */
export function resetSimMediaAssets() {
  simAssets.clear();
}
