import { describe, expect, it } from "vitest";
import {
  computeCreativeReadiness,
  evaluateCreativeCompatibility,
} from "@/domain/media/creativeCompatibility";

describe("evaluateCreativeCompatibility", () => {
  it("marks PDF unsupported even when provider connected", () => {
    const result = evaluateCreativeCompatibility({
      mediaAsset: {
        media_type: "DOCUMENT",
        mime_type: "application/pdf",
        width: null,
        height: null,
      },
      destination: "FACEBOOK",
      connectionStatus: "CONNECTED",
    });
    expect(result.status).toBe("UNSUPPORTED");
    expect(result.details.creative).toBe("UNSUPPORTED");
  });

  it("keeps creatively READY asset as NOT_CONNECTED when provider disconnected", () => {
    const result = evaluateCreativeCompatibility({
      mediaAsset: {
        media_type: "IMAGE",
        mime_type: "image/jpeg",
        width: 1200,
        height: 628,
      },
      destination: "INSTAGRAM",
      connectionStatus: "NOT_CONNECTED",
    });
    expect(result.details.creative).toBe("READY");
    expect(result.status).toBe("NOT_CONNECTED");
  });

  it("does not let NOT_CONNECTED upgrade an incompatible creative", () => {
    const result = evaluateCreativeCompatibility({
      mediaAsset: {
        media_type: "DOCUMENT",
        mime_type: "application/pdf",
      },
      destination: "TIKTOK",
      connectionStatus: "NOT_CONNECTED",
    });
    expect(result.status).toBe("UNSUPPORTED");
  });

  it("requires dimensions when unknown", () => {
    const result = evaluateCreativeCompatibility({
      mediaAsset: {
        media_type: "IMAGE",
        mime_type: "image/png",
        width: null,
        height: null,
      },
      destination: "LINKEDIN",
      connectionStatus: "CONNECTED",
    });
    expect(result.status).toBe("ADAPTATION_REQUIRED");
    expect(result.reason).toMatch(/dimensions/i);
  });

  it("flags WEBP as adaptation required", () => {
    const result = evaluateCreativeCompatibility({
      mediaAsset: {
        media_type: "IMAGE",
        mime_type: "image/webp",
        width: 1080,
        height: 1080,
      },
      destination: "FACEBOOK",
      connectionStatus: "CONNECTED",
    });
    expect(result.status).toBe("ADAPTATION_REQUIRED");
  });

  it("returns READY for known JPEG when connected", () => {
    const result = evaluateCreativeCompatibility({
      mediaAsset: {
        media_type: "IMAGE",
        mime_type: "image/jpeg",
        width: 1200,
        height: 628,
      },
      destination: "FACEBOOK",
      connectionStatus: "CONNECTED",
    });
    expect(result.status).toBe("READY");
  });
});

describe("computeCreativeReadiness", () => {
  it("requires ACTIVE creatively READY attachment per destination", () => {
    const ready = computeCreativeReadiness({
      selectedDestinations: ["FACEBOOK", "INSTAGRAM"],
      attachments: [
        {
          destination: null,
          media: {
            media_type: "IMAGE",
            mime_type: "image/jpeg",
            width: 1200,
            height: 628,
            status: "ACTIVE",
          },
        },
      ],
    });
    expect(ready.creativeReady).toBe(true);
  });

  it("does not count archived attachments toward readiness", () => {
    const ready = computeCreativeReadiness({
      selectedDestinations: ["FACEBOOK"],
      attachments: [
        {
          destination: "FACEBOOK",
          media: {
            media_type: "IMAGE",
            mime_type: "image/jpeg",
            width: 1200,
            height: 628,
            status: "ARCHIVED",
          },
        },
      ],
    });
    expect(ready.creativeReady).toBe(false);
    expect(ready.missingDestinations).toContain("FACEBOOK");
  });

  it("blocks when only unsupported creative is attached", () => {
    const ready = computeCreativeReadiness({
      selectedDestinations: ["LINKEDIN"],
      attachments: [
        {
          destination: null,
          media: {
            media_type: "DOCUMENT",
            mime_type: "application/pdf",
            status: "ACTIVE",
          },
        },
      ],
    });
    expect(ready.creativeReady).toBe(false);
    expect(ready.blockedDestinations[0]?.destination).toBe("LINKEDIN");
  });
});
