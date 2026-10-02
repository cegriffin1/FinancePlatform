import { describe, expect, it } from "vitest";
import {
  emptyStateCopy,
  filterMediaAssets,
  formatBytes,
  formatDimensions,
  formatDuration,
  mapMediaUploadError,
  mediaTypeLabel,
  sortMediaByNewest,
  type MediaLibraryAsset,
} from "@/application/media/mediaLibraryUi";

function asset(
  overrides: Partial<MediaLibraryAsset> & Pick<MediaLibraryAsset, "id" | "media_type" | "status">,
): MediaLibraryAsset {
  return {
    organization_id: "org-a",
    original_filename: `${overrides.id}.bin`,
    mime_type: "image/png",
    size_bytes: 1024,
    width: null,
    height: null,
    duration_seconds: null,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("mediaLibraryUi filtering", () => {
  const catalog = [
    asset({ id: "1", media_type: "IMAGE", status: "ACTIVE", original_filename: "a.png" }),
    asset({ id: "2", media_type: "VIDEO", status: "ACTIVE", original_filename: "b.mp4" }),
    asset({ id: "3", media_type: "DOCUMENT", status: "ARCHIVED", original_filename: "c.pdf" }),
    asset({ id: "4", media_type: "IMAGE", status: "ARCHIVED", original_filename: "d.png" }),
  ];

  it("defaults conceptually to ACTIVE and can filter by type", () => {
    expect(filterMediaAssets(catalog, "ALL", "ACTIVE").map((a) => a.id)).toEqual([
      "1",
      "2",
    ]);
    expect(filterMediaAssets(catalog, "IMAGE", "ACTIVE").map((a) => a.id)).toEqual([
      "1",
    ]);
    expect(filterMediaAssets(catalog, "VIDEO", "ACTIVE").map((a) => a.id)).toEqual([
      "2",
    ]);
    expect(filterMediaAssets(catalog, "DOCUMENT", "ACTIVE")).toEqual([]);
  });

  it("supports ARCHIVED view and archived image filter", () => {
    expect(filterMediaAssets(catalog, "ALL", "ARCHIVED").map((a) => a.id)).toEqual([
      "3",
      "4",
    ]);
    expect(filterMediaAssets(catalog, "IMAGE", "ARCHIVED").map((a) => a.id)).toEqual([
      "4",
    ]);
  });
});

describe("mediaLibraryUi empty states", () => {
  it("ACTIVE empty", () => {
    expect(emptyStateCopy("ALL", "ACTIVE", false)).toEqual({
      title: "Your media library is ready.",
      description:
        "Upload campaign images, videos, and documents to reuse across ALTUS.",
    });
  });

  it("ARCHIVED empty", () => {
    expect(emptyStateCopy("ALL", "ARCHIVED", false).title).toBe("No archived media.");
  });

  it("filtered empty", () => {
    expect(emptyStateCopy("VIDEO", "ACTIVE", true).title).toBe(
      "No media matches this filter.",
    );
  });
});

describe("mediaLibraryUi formatting", () => {
  it("formats bytes and media labels", () => {
    expect(formatBytes(70)).toBe("70 B");
    expect(formatBytes(2048)).toMatch(/KB/);
    expect(mediaTypeLabel("IMAGE")).toBe("Image");
    expect(mediaTypeLabel("VIDEO")).toBe("Video");
    expect(mediaTypeLabel("DOCUMENT")).toBe("Document");
  });

  it("formats optional dimensions and duration", () => {
    expect(formatDimensions(1200, 628)).toBe("1200 × 628");
    expect(formatDimensions(null, 10)).toBeNull();
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(null)).toBeNull();
  });

  it("sorts newest first", () => {
    const sorted = sortMediaByNewest([
      asset({
        id: "old",
        media_type: "IMAGE",
        status: "ACTIVE",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      asset({
        id: "new",
        media_type: "IMAGE",
        status: "ACTIVE",
        created_at: "2026-10-01T00:00:00.000Z",
      }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["new", "old"]);
  });
});

describe("mediaLibraryUi upload error mapping", () => {
  it("maps validation and failure codes to safe copy", () => {
    expect(mapMediaUploadError(400, { code: "INVALID_MIME" })).toBe(
      "Unsupported file type.",
    );
    expect(mapMediaUploadError(400, { code: "FILE_TOO_LARGE" })).toBe(
      "File exceeds allowed size.",
    );
    expect(mapMediaUploadError(400, { code: "EXTENSION_MISMATCH" })).toBe(
      "File extension does not match its content type.",
    );
    expect(mapMediaUploadError(503, { code: "DATABASE_ERROR" })).toBe(
      "Upload failed. Please try again.",
    );
    expect(
      mapMediaUploadError(500, { error: "supabase jwt service_role boom" }),
    ).toBe("Upload failed. Please try again.");
  });
});
