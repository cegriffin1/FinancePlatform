import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import {
  CAMPAIGN_MEDIA_BUCKET,
  MEDIA_SIGNED_URL_TTL_SECONDS,
} from "@/domain/media/limits";
import type {
  MediaAsset,
  MediaAssetStatus,
  MediaType,
} from "@/domain/media/types";
import { DataModeError } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

type MediaAssetRow = {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  media_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  checksum_sha256: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    organization_id: row.organization_id,
    original_filename: row.original_filename,
    storage_key: row.storage_key,
    mime_type: row.mime_type,
    media_type: row.media_type as MediaType,
    size_bytes: Number(row.size_bytes),
    width: row.width,
    height: row.height,
    duration_seconds: row.duration_seconds,
    checksum_sha256: row.checksum_sha256,
    status: row.status as MediaAssetStatus,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class SupabaseMediaAssetRepository {
  private client() {
    try {
      return createSupabaseServiceClient();
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Media repository unavailable", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      throw new DataModeError("Media storage is unavailable.");
    }
  }

  async insertMetadata(asset: MediaAsset): Promise<MediaAsset> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        id: asset.id,
        organization_id: asset.organization_id,
        original_filename: asset.original_filename,
        storage_key: asset.storage_key,
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
      })
      .select("*")
      .single();
    if (error || !data) {
      logAltusError("DATABASE_ERROR", "Media metadata insert failed", {
        message: error?.message,
      });
      throw new DataModeError("Unable to persist media asset.");
    }
    return mapRow(data as MediaAssetRow);
  }

  async getByIdForOrg(
    assetId: string,
    organizationId: string,
  ): Promise<MediaAsset | null> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", assetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) {
      logAltusError("DATABASE_ERROR", "Media get failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to load media asset.");
    }
    return data ? mapRow(data as MediaAssetRow) : null;
  }

  async listForOrg(
    organizationId: string,
    options?: { includeArchived?: boolean },
  ): Promise<MediaAsset[]> {
    const supabase = this.client();
    let query = supabase
      .from("media_assets")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (!options?.includeArchived) {
      query = query.eq("status", "ACTIVE");
    }
    const { data, error } = await query;
    if (error) {
      logAltusError("DATABASE_ERROR", "Media list failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to list media assets.");
    }
    return (data as MediaAssetRow[] | null)?.map(mapRow) ?? [];
  }

  async archiveForOrg(
    assetId: string,
    organizationId: string,
  ): Promise<MediaAsset | null> {
    const supabase = this.client();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("media_assets")
      .update({ status: "ARCHIVED", updated_at: now })
      .eq("id", assetId)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    if (error) {
      logAltusError("DATABASE_ERROR", "Media archive failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to archive media asset.");
    }
    return data ? mapRow(data as MediaAssetRow) : null;
  }

  async uploadObject(input: {
    storageKey: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<void> {
    const supabase = this.client();
    const { error } = await supabase.storage
      .from(CAMPAIGN_MEDIA_BUCKET)
      .upload(input.storageKey, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (error) {
      logAltusError("DATABASE_ERROR", "Media object upload failed", {
        message: error.message,
      });
      throw new DataModeError("Unable to store media file.");
    }
  }

  async removeObject(storageKey: string): Promise<void> {
    const supabase = this.client();
    const { error } = await supabase.storage
      .from(CAMPAIGN_MEDIA_BUCKET)
      .remove([storageKey]);
    if (error) {
      logAltusError("DATABASE_ERROR", "Media orphan cleanup failed", {
        message: error.message,
      });
      // Best-effort — caller already failed the request
    }
  }

  async createSignedUrl(storageKey: string): Promise<string> {
    const supabase = this.client();
    const { data, error } = await supabase.storage
      .from(CAMPAIGN_MEDIA_BUCKET)
      .createSignedUrl(storageKey, MEDIA_SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      logAltusError("DATABASE_ERROR", "Media signed URL failed", {
        message: error?.message,
      });
      throw new DataModeError("Unable to create media access URL.");
    }
    return data.signedUrl;
  }
}
