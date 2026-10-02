import type { MediaAssetStatus, MediaType } from "@/domain/media/types";
import { MEDIA_SIZE_LIMITS_BYTES } from "@/domain/media/limits";

/** Public list/detail shape from /api/media (storage_key intentionally omitted). */
export type MediaLibraryAsset = {
  id: string;
  organization_id: string;
  original_filename: string;
  mime_type: string;
  media_type: MediaType;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  status: MediaAssetStatus;
  created_at: string;
  updated_at: string;
};

export type MediaTypeFilter = "ALL" | MediaType;
export type MediaStatusFilter = MediaAssetStatus;

export type UploadUiState =
  | { phase: "idle" }
  | { phase: "selected"; fileName: string; sizeBytes: number }
  | { phase: "uploading"; fileName: string }
  | { phase: "success"; fileName: string }
  | { phase: "failed"; fileName: string; message: string };

export const MEDIA_ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.webp,.mp4,.pdf,image/jpeg,image/png,image/webp,video/mp4,application/pdf";

export const MEDIA_FORMAT_HINT =
  "ALTUS accepts JPG, JPEG, PNG, WEBP, MP4, and PDF. Provider publishing rules come later.";

export function mediaSizeHints(): string {
  const img = MEDIA_SIZE_LIMITS_BYTES.IMAGE / (1024 * 1024);
  const vid = MEDIA_SIZE_LIMITS_BYTES.VIDEO / (1024 * 1024);
  const doc = MEDIA_SIZE_LIMITS_BYTES.DOCUMENT / (1024 * 1024);
  return `Limits: images ${img} MB · video ${vid} MB · documents ${doc} MB.`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function formatUploadDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): string | null {
  if (!width || !height) return null;
  return `${width} × ${height}`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function mediaTypeLabel(type: MediaType): string {
  switch (type) {
    case "IMAGE":
      return "Image";
    case "VIDEO":
      return "Video";
    case "DOCUMENT":
      return "Document";
    default:
      return type;
  }
}

export function filterMediaAssets(
  assets: MediaLibraryAsset[],
  typeFilter: MediaTypeFilter,
  statusFilter: MediaStatusFilter,
): MediaLibraryAsset[] {
  return assets.filter((a) => {
    if (a.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && a.media_type !== typeFilter) return false;
    return true;
  });
}

export function emptyStateCopy(
  typeFilter: MediaTypeFilter,
  statusFilter: MediaStatusFilter,
  hasAnyInStatus: boolean,
): { title: string; description: string } {
  if (!hasAnyInStatus && statusFilter === "ACTIVE") {
    return {
      title: "Your media library is ready.",
      description:
        "Upload campaign images, videos, and documents to reuse across ALTUS.",
    };
  }
  if (!hasAnyInStatus && statusFilter === "ARCHIVED") {
    return {
      title: "No archived media.",
      description: "Archived assets stay preserved and available here.",
    };
  }
  return {
    title: "No media matches this filter.",
    description:
      typeFilter === "ALL"
        ? "Try another status or upload a new asset."
        : `No ${mediaTypeLabel(typeFilter).toLowerCase()}s in this view.`,
  };
}

/** Map API / client failures to safe user-facing copy. */
export function mapMediaUploadError(
  status: number,
  body: { error?: string; code?: string } | null,
): string {
  const code = body?.code || "";
  const raw = (body?.error || "").toLowerCase();

  if (code === "INVALID_MIME" || raw.includes("unsupported")) {
    return "Unsupported file type.";
  }
  if (code === "FILE_TOO_LARGE" || raw.includes("exceed")) {
    return "File exceeds allowed size.";
  }
  if (code === "EXTENSION_MISMATCH" || raw.includes("extension")) {
    return "File extension does not match its content type.";
  }
  if (status === 401 || code === "AUTH_REQUIRED") {
    return "Authentication required.";
  }
  if (status === 403) {
    return "You do not have permission to upload media.";
  }
  if (status === 503 || code === "DATABASE_ERROR") {
    return "Upload failed. Please try again.";
  }
  if (body?.error && body.error.length < 120 && !/supabase|postgres|jwt|service.?role/i.test(body.error)) {
    return body.error;
  }
  return "Upload failed. Please try again.";
}

export function sortMediaByNewest(assets: MediaLibraryAsset[]): MediaLibraryAsset[] {
  return [...assets].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
