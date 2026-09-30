import type { MediaType } from "@/domain/media/types";

/**
 * Centralized launch-safe upload limits (bytes).
 * Do not scatter magic numbers in API/React code.
 *
 * Bucket hard ceiling is higher; per-type app limits are authoritative.
 *
 * Future: production-scale malware scanning is a hardening requirement
 * (not implemented in Campaign Launch Slice A).
 */
export const MEDIA_SIZE_LIMITS_BYTES = {
  IMAGE: 10 * 1024 * 1024, // 10 MB
  VIDEO: 100 * 1024 * 1024, // 100 MB
  DOCUMENT: 20 * 1024 * 1024, // 20 MB
} as const satisfies Record<MediaType, number>;

export const CAMPAIGN_MEDIA_BUCKET = "campaign-media";

/** Signed URL lifetime for preview/access (seconds). */
export const MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

export function sizeLimitForMediaType(mediaType: MediaType): number {
  return MEDIA_SIZE_LIMITS_BYTES[mediaType];
}
