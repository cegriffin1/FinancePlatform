import type { MediaType } from "@/domain/media/types";
import { sizeLimitForMediaType } from "@/domain/media/limits";

/** Allowed MIME types for campaign media uploads. */
export const ALLOWED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "application/pdf",
] as const;

export type AllowedMediaMime = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

const MIME_TO_MEDIA_TYPE: Record<AllowedMediaMime, MediaType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "video/mp4": "VIDEO",
  "application/pdf": "DOCUMENT",
};

/** Extensions accepted for each MIME (lowercase, no dot). .jpg and .jpeg → image/jpeg. */
const MIME_EXTENSIONS: Record<AllowedMediaMime, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
  "application/pdf": ["pdf"],
};

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "html",
  "htm",
  "svg",
  "svgz",
  "php",
  "py",
  "rb",
  "sh",
  "ps1",
  "dll",
  "so",
  "dylib",
  "jar",
  "war",
  "apk",
  "dmg",
  "pkg",
  "vbs",
  "wsf",
  "cgi",
]);

export type MediaValidationOk = {
  ok: true;
  mimeType: AllowedMediaMime;
  mediaType: MediaType;
  extension: string;
  safeFilename: string;
};

export type MediaValidationErr = {
  ok: false;
  error: string;
  code:
    | "INVALID_MIME"
    | "EXTENSION_MISMATCH"
    | "BLOCKED_EXTENSION"
    | "SIZE_LIMIT"
    | "INVALID_FILENAME"
    | "EMPTY_FILE";
};

export type MediaValidationResult = MediaValidationOk | MediaValidationErr;

function normalizeMime(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .split(";")[0]!
    .trim();
}

/** Treat image/jpg as image/jpeg. */
function canonicalizeMime(mime: string): string {
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

function splitFilename(filename: string): { base: string; extension: string } {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { base: trimmed, extension: "" };
  }
  return {
    base: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot + 1).toLowerCase(),
  };
}

/**
 * Sanitize a user-supplied filename for storage path use.
 * Strips path segments, control chars, and unsafe characters.
 */
export function sanitizeFilename(original: string): string {
  const noPath = original.replace(/\\/g, "/").split("/").pop() || "file";
  const withoutNulls = noPath.replace(/\0/g, "");
  const asciiSafe = withoutNulls
    .normalize("NFKD")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);
  const { base, extension } = splitFilename(asciiSafe || "file");
  const safeBase = (base || "file").slice(0, 120);
  if (!extension) return safeBase;
  return `${safeBase}.${extension}`;
}

export function mediaTypeForMime(mime: AllowedMediaMime): MediaType {
  return MIME_TO_MEDIA_TYPE[mime];
}

export function isAllowedMime(mime: string): mime is AllowedMediaMime {
  return (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Validate declared MIME + extension + size.
 * Does not trust filename alone. Does not silently compress/transcode.
 */
export function validateMediaUpload(input: {
  filename: string;
  mimeType: string | null | undefined;
  sizeBytes: number;
}): MediaValidationResult {
  if (!input.sizeBytes || input.sizeBytes < 1) {
    return { ok: false, error: "Empty file.", code: "EMPTY_FILE" };
  }

  const mime = canonicalizeMime(normalizeMime(input.mimeType));
  if (!isAllowedMime(mime)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP, MP4, PDF.`,
      code: "INVALID_MIME",
    };
  }

  const safeFilename = sanitizeFilename(input.filename || "file");
  const { extension } = splitFilename(safeFilename);
  if (!extension) {
    return {
      ok: false,
      error: "Filename must include a valid extension.",
      code: "INVALID_FILENAME",
    };
  }

  if (BLOCKED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "This file extension is not allowed.",
      code: "BLOCKED_EXTENSION",
    };
  }

  // Reject multi-suffix tricks like report.pdf.exe (last ext already blocked),
  // and report.pdf.js style when any inner segment is blocked.
  const parts = safeFilename.toLowerCase().split(".").slice(1);
  if (parts.some((p) => BLOCKED_EXTENSIONS.has(p))) {
    return {
      ok: false,
      error: "This file extension is not allowed.",
      code: "BLOCKED_EXTENSION",
    };
  }

  const allowedExts = MIME_EXTENSIONS[mime];
  if (!allowedExts.includes(extension)) {
    return {
      ok: false,
      error: `File extension .${extension} does not match type ${mime}.`,
      code: "EXTENSION_MISMATCH",
    };
  }

  const mediaType = mediaTypeForMime(mime);
  const limit = sizeLimitForMediaType(mediaType);
  if (input.sizeBytes > limit) {
    return {
      ok: false,
      error: `File exceeds the ${mediaType.toLowerCase()} size limit of ${Math.round(limit / (1024 * 1024))} MB.`,
      code: "SIZE_LIMIT",
    };
  }

  return {
    ok: true,
    mimeType: mime,
    mediaType,
    extension,
    safeFilename,
  };
}

/** Build tenant-isolated storage object key. */
export function buildMediaStorageKey(input: {
  organizationId: string;
  assetId: string;
  safeFilename: string;
}): string {
  return `${input.organizationId}/${input.assetId}/${input.safeFilename}`;
}
