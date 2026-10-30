/**
 * Highwater / public consumer launch gate.
 *
 * Fail-closed: anything other than an explicit `open` keeps anonymous
 * consumer intake denied. Authenticated ALTUS sessions may still test.
 *
 * Env: HIGHWATER_PUBLIC_LAUNCH=open | closed | <absent>
 */

export type PublicConsumerLaunchMode = "closed" | "open";

export const LAUNCH_GATE_CLOSED_CODE = "LAUNCH_GATE_CLOSED" as const;

export function getPublicConsumerLaunchMode(
  raw = process.env.HIGHWATER_PUBLIC_LAUNCH,
): PublicConsumerLaunchMode {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  return value === "open" ? "open" : "closed";
}

export function isPublicConsumerLaunchOpen(
  raw = process.env.HIGHWATER_PUBLIC_LAUNCH,
): boolean {
  return getPublicConsumerLaunchMode(raw) === "open";
}

/** Pages + APIs that collect or progress anonymous consumer assessment data. */
export function isPublicConsumerPath(pathname: string): boolean {
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/assessment")) {
    // Always allow the controlled unavailable surface itself.
    if (
      pathname === "/assessment/unavailable" ||
      pathname.startsWith("/assessment/unavailable/")
    ) {
      return false;
    }
    return true;
  }
  if (pathname.startsWith("/c/")) return true;
  return false;
}

export function isPublicConsumerApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/public/");
}
