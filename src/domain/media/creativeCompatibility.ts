/**
 * Central creative compatibility engine (Slice C).
 * UI must consume these results — do not scatter provider if-trees in React.
 *
 * Creative fitness and provider connection are separate concepts:
 * an asset can be creatively READY while the destination is NOT_CONNECTED.
 */

import type { MediaType } from "@/domain/media/types";
import {
  providerForDestination,
  type CreativeDestination,
  type CreativeProvider,
} from "@/domain/media/destinations";

export const COMPATIBILITY_STATUSES = [
  "READY",
  "ADAPTATION_REQUIRED",
  "UNSUPPORTED",
  "NOT_CONNECTED",
] as const;

export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number];

export type CreativeFitness = Exclude<CompatibilityStatus, "NOT_CONNECTED">;

export type ConnectionUsability =
  | "CONNECTED"
  | "NOT_CONNECTED"
  | "ACTION_REQUIRED"
  | "EXPIRED"
  | "ERROR"
  | "CONNECTING";

export type CompatibilityMediaInput = {
  media_type: MediaType;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  status?: "ACTIVE" | "ARCHIVED";
};

export type CompatibilityResult = {
  status: CompatibilityStatus;
  reason: string;
  requirements: string[];
  possibleAction: string;
  details: {
    creative: CreativeFitness;
    connection: ConnectionUsability;
    provider: CreativeProvider;
    destination: CreativeDestination;
  };
};

type DestinationCapability = {
  provider: CreativeProvider;
  acceptsMediaTypes: MediaType[];
  /** MIME types treated as creatively ready when present. */
  readyMimeTypes: string[];
  /** MIME types that need adaptation (no silent convert in Slice C). */
  adaptationMimeTypes: string[];
  requiresDimensions: boolean;
  requiresDuration: boolean;
  label: string;
};

/**
 * Capability drafts — not claims of live publish readiness.
 * ALTUS ingestion ≠ provider acceptance.
 */
export const DESTINATION_CAPABILITIES: Record<
  CreativeDestination,
  DestinationCapability
> = {
  FACEBOOK: {
    provider: "META",
    label: "Facebook",
    acceptsMediaTypes: ["IMAGE", "VIDEO"],
    readyMimeTypes: ["image/jpeg", "image/png", "video/mp4"],
    adaptationMimeTypes: ["image/webp"],
    requiresDimensions: true,
    requiresDuration: false,
  },
  INSTAGRAM: {
    provider: "META",
    label: "Instagram",
    acceptsMediaTypes: ["IMAGE", "VIDEO"],
    readyMimeTypes: ["image/jpeg", "image/png", "video/mp4"],
    adaptationMimeTypes: ["image/webp"],
    requiresDimensions: true,
    requiresDuration: true,
  },
  LINKEDIN: {
    provider: "LINKEDIN",
    label: "LinkedIn",
    acceptsMediaTypes: ["IMAGE", "VIDEO"],
    readyMimeTypes: ["image/jpeg", "image/png", "video/mp4"],
    adaptationMimeTypes: ["image/webp"],
    requiresDimensions: true,
    requiresDuration: false,
  },
  TIKTOK: {
    provider: "TIKTOK",
    label: "TikTok",
    acceptsMediaTypes: ["VIDEO", "IMAGE"],
    readyMimeTypes: ["video/mp4", "image/jpeg", "image/png"],
    adaptationMimeTypes: ["image/webp"],
    requiresDimensions: true,
    requiresDuration: true,
  },
};

function normalizeConnection(
  connectionStatus: string | null | undefined,
): ConnectionUsability {
  const raw = (connectionStatus || "NOT_CONNECTED").toUpperCase();
  if (raw === "CONNECTED") return "CONNECTED";
  if (raw === "CONNECTING") return "CONNECTING";
  if (raw === "ACTION_REQUIRED") return "ACTION_REQUIRED";
  if (raw === "EXPIRED") return "EXPIRED";
  if (raw === "ERROR") return "ERROR";
  return "NOT_CONNECTED";
}

function evaluateCreativeFitness(
  media: CompatibilityMediaInput,
  destination: CreativeDestination,
): { fitness: CreativeFitness; reason: string; requirements: string[]; action: string } {
  const cap = DESTINATION_CAPABILITIES[destination];
  const mime = (media.mime_type || "").toLowerCase();

  if (!cap.acceptsMediaTypes.includes(media.media_type)) {
    return {
      fitness: "UNSUPPORTED",
      reason: `${cap.label} does not accept ${media.media_type.toLowerCase()} as an ad creative.`,
      requirements: [`Supported types: ${cap.acceptsMediaTypes.join(", ")}.`],
      action: "Choose an image or video asset.",
    };
  }

  if (media.media_type === "DOCUMENT" || mime === "application/pdf") {
    return {
      fitness: "UNSUPPORTED",
      reason: `${cap.label} does not accept PDF as an ad creative.`,
      requirements: ["Use an image or video creative for this destination."],
      action: "Choose an image or video asset.",
    };
  }

  if (cap.adaptationMimeTypes.includes(mime)) {
    return {
      fitness: "ADAPTATION_REQUIRED",
      reason: `${cap.label} may require a different image format than WEBP.`,
      requirements: ["Provide JPG or PNG for launch without conversion."],
      action: "Replace with a JPG or PNG asset.",
    };
  }

  if (!cap.readyMimeTypes.includes(mime)) {
    return {
      fitness: "UNSUPPORTED",
      reason: `${cap.label} does not accept this file type.`,
      requirements: [`Accepted types include: ${cap.readyMimeTypes.join(", ")}.`],
      action: "Choose a supported image or video asset.",
    };
  }

  if (cap.requiresDimensions && (media.width == null || media.height == null)) {
    return {
      fitness: "ADAPTATION_REQUIRED",
      reason: "Media dimensions must be verified before launch.",
      requirements: ["Width and height are required for this destination."],
      action: "Verify or replace the creative before launch.",
    };
  }

  if (
    cap.requiresDuration &&
    media.media_type === "VIDEO" &&
    media.duration_seconds == null
  ) {
    return {
      fitness: "ADAPTATION_REQUIRED",
      reason: "Video duration must be verified before launch.",
      requirements: ["Duration is required for this destination."],
      action: "Verify or replace the creative before launch.",
    };
  }

  return {
    fitness: "READY",
    reason: `ALTUS accepts this asset for ${cap.label} creative review.`,
    requirements: [],
    action: "No creative changes required.",
  };
}

/**
 * Evaluate one media asset against one destination.
 * NOT_CONNECTED never upgrades an incompatible creative to READY.
 */
export function evaluateCreativeCompatibility(input: {
  mediaAsset: CompatibilityMediaInput;
  destination: CreativeDestination;
  connectionStatus?: string | null;
}): CompatibilityResult {
  const provider = providerForDestination(input.destination);
  const connection = normalizeConnection(input.connectionStatus);
  const creativeEval = evaluateCreativeFitness(
    input.mediaAsset,
    input.destination,
  );

  const base = {
    reason: creativeEval.reason,
    requirements: creativeEval.requirements,
    possibleAction: creativeEval.action,
    details: {
      creative: creativeEval.fitness,
      connection,
      provider,
      destination: input.destination,
    },
  };

  if (creativeEval.fitness === "UNSUPPORTED") {
    return { status: "UNSUPPORTED", ...base };
  }

  if (creativeEval.fitness === "ADAPTATION_REQUIRED") {
    return { status: "ADAPTATION_REQUIRED", ...base };
  }

  // Creative is READY — connection may still block launchability display.
  if (connection !== "CONNECTED") {
    const cap = DESTINATION_CAPABILITIES[input.destination];
    return {
      status: "NOT_CONNECTED",
      reason: `${cap.label} is not connected in ALTUS yet.`,
      requirements: [
        "Creative is compatible, but this destination is not connected.",
        ...creativeEval.requirements,
      ],
      possibleAction: "Connect the provider account before launch (later slice).",
      details: base.details,
    };
  }

  return { status: "READY", ...base };
}

export type AttachmentForReadiness = {
  destination: CreativeDestination | null;
  media: CompatibilityMediaInput & { status: "ACTIVE" | "ARCHIVED" };
};

/**
 * Creative readiness: every selected destination needs an ACTIVE attachment
 * whose creative fitness is READY (connection does not satisfy readiness).
 */
export function computeCreativeReadiness(input: {
  selectedDestinations: CreativeDestination[];
  attachments: AttachmentForReadiness[];
}): {
  creativeReady: boolean;
  missingDestinations: CreativeDestination[];
  blockedDestinations: Array<{
    destination: CreativeDestination;
    reason: string;
  }>;
} {
  const missing: CreativeDestination[] = [];
  const blocked: Array<{ destination: CreativeDestination; reason: string }> =
    [];

  for (const destination of input.selectedDestinations) {
    const candidates = input.attachments.filter(
      (a) =>
        a.media.status === "ACTIVE" &&
        (a.destination === destination || a.destination === null),
    );

    if (candidates.length === 0) {
      missing.push(destination);
      continue;
    }

    const anyReady = candidates.some((a) => {
      const result = evaluateCreativeCompatibility({
        mediaAsset: a.media,
        destination,
        // Readiness ignores connection — force CONNECTED so status mirrors creative.
        connectionStatus: "CONNECTED",
      });
      return result.details.creative === "READY";
    });

    if (!anyReady) {
      const first = candidates[0];
      if (!first) {
        missing.push(destination);
        continue;
      }
      const sample = evaluateCreativeCompatibility({
        mediaAsset: first.media,
        destination,
        connectionStatus: "CONNECTED",
      });
      blocked.push({
        destination,
        reason: sample.reason,
      });
    }
  }

  return {
    creativeReady: missing.length === 0 && blocked.length === 0,
    missingDestinations: missing,
    blockedDestinations: blocked,
  };
}
