import { describe, expect, it } from "vitest";
import {
  buildMediaStorageKey,
  sanitizeFilename,
  validateMediaUpload,
} from "@/domain/media/validation";
import { MEDIA_SIZE_LIMITS_BYTES } from "@/domain/media/limits";
import { sha256Hex } from "@/domain/media/checksum";

describe("media validation", () => {
  it("allows JPG/JPEG/PNG/WEBP/MP4/PDF", () => {
    const cases = [
      { filename: "a.jpg", mimeType: "image/jpeg" },
      { filename: "a.jpeg", mimeType: "image/jpeg" },
      { filename: "a.png", mimeType: "image/png" },
      { filename: "a.webp", mimeType: "image/webp" },
      { filename: "a.mp4", mimeType: "video/mp4" },
      { filename: "a.pdf", mimeType: "application/pdf" },
    ] as const;
    for (const c of cases) {
      const r = validateMediaUpload({
        filename: c.filename,
        mimeType: c.mimeType,
        sizeBytes: 1024,
      });
      expect(r.ok, c.filename).toBe(true);
    }
  });

  it("treats image/jpg as image/jpeg", () => {
    const r = validateMediaUpload({
      filename: "photo.jpg",
      mimeType: "image/jpg",
      sizeBytes: 2048,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mimeType).toBe("image/jpeg");
  });

  it("blocks invalid MIME", () => {
    const r = validateMediaUpload({
      filename: "x.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_MIME");
  });

  it("blocks extension mismatch", () => {
    const r = validateMediaUpload({
      filename: "payload.pdf",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("EXTENSION_MISMATCH");
  });

  it("blocks executables / scripts / html / svg extensions", () => {
    for (const filename of ["run.exe", "x.html", "icon.svg", "hack.pdf.js"]) {
      const r = validateMediaUpload({
        filename,
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      expect(r.ok, filename).toBe(false);
    }
  });

  it("enforces size limits", () => {
    const r = validateMediaUpload({
      filename: "big.jpg",
      mimeType: "image/jpeg",
      sizeBytes: MEDIA_SIZE_LIMITS_BYTES.IMAGE + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SIZE_LIMIT");
  });

  it("sanitizes filenames and strips path segments", () => {
    expect(sanitizeFilename("../../etc/passwd.png")).toBe("passwd.png");
    expect(sanitizeFilename("My Cool Photo!!.JPG")).toMatch(/\.JPG$/i);
    expect(sanitizeFilename("a\0b.pdf")).toBe("ab.pdf");
  });

  it("builds tenant-prefixed storage keys", () => {
    const key = buildMediaStorageKey({
      organizationId: "org-a",
      assetId: "asset-1",
      safeFilename: "creative.jpg",
    });
    expect(key).toBe("org-a/asset-1/creative.jpg");
  });
});

describe("media checksum", () => {
  it("produces deterministic sha256", () => {
    const a = sha256Hex(Buffer.from("altus-media"));
    const b = sha256Hex(Buffer.from("altus-media"));
    const c = sha256Hex(Buffer.from("altus-media-2"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toBe(c);
  });
});
