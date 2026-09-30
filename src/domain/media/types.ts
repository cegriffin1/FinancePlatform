/** Tenant-owned campaign media asset (metadata only — binaries live in Storage). */

export const MEDIA_TYPES = ["IMAGE", "VIDEO", "DOCUMENT"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_ASSET_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export type MediaAsset = {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  media_type: MediaType;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  checksum_sha256: string;
  status: MediaAssetStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Safe API response — never includes storage credentials. */
export type MediaAssetPublic = Omit<MediaAsset, "storage_key"> & {
  storage_key: undefined;
};
