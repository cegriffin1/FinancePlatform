/** Campaign creative destinations (Slice C). Distinct from provider connection. */

export const CREATIVE_DESTINATIONS = [
  "FACEBOOK",
  "INSTAGRAM",
  "LINKEDIN",
  "TIKTOK",
] as const;

export type CreativeDestination = (typeof CREATIVE_DESTINATIONS)[number];

export const CREATIVE_ATTACHMENT_ROLES = [
  "PRIMARY",
  "SECONDARY",
  "VARIANT",
] as const;

export type CreativeAttachmentRole = (typeof CREATIVE_ATTACHMENT_ROLES)[number];

/** Provider that owns destination credentials (one Meta connection for FB+IG). */
export type CreativeProvider = "META" | "LINKEDIN" | "TIKTOK";

export function providerForDestination(
  destination: CreativeDestination,
): CreativeProvider {
  switch (destination) {
    case "FACEBOOK":
    case "INSTAGRAM":
      return "META";
    case "LINKEDIN":
      return "LINKEDIN";
    case "TIKTOK":
      return "TIKTOK";
  }
}

/** Map wizard channel keys → destinations. */
export function destinationsFromWizardChannels(
  channels: string[],
): CreativeDestination[] {
  const out: CreativeDestination[] = [];
  for (const ch of channels) {
    const key = ch.toLowerCase();
    if (key === "facebook" && !out.includes("FACEBOOK")) out.push("FACEBOOK");
    if (key === "instagram" && !out.includes("INSTAGRAM")) out.push("INSTAGRAM");
    if (key === "linkedin" && !out.includes("LINKEDIN")) out.push("LINKEDIN");
    if (key === "tiktok" && !out.includes("TIKTOK")) out.push("TIKTOK");
  }
  return out;
}

export function isCreativeDestination(value: unknown): value is CreativeDestination {
  return (
    typeof value === "string" &&
    (CREATIVE_DESTINATIONS as readonly string[]).includes(value)
  );
}
