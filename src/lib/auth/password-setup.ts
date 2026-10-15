/**
 * Helpers for invite / recovery password-setup flows.
 * Keep token handling out of this module — callers never log secrets.
 */

export const PASSWORD_SETUP_COOKIE = "altus_pw_setup";

/** Auth email link types that must collect a new password before normal use. */
export const PASSWORD_SETUP_TYPES = new Set([
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
]);

export function isPasswordSetupType(type: string | null | undefined): boolean {
  if (!type) return false;
  return PASSWORD_SETUP_TYPES.has(type.toLowerCase());
}

/**
 * Resolve post-callback destination.
 * Invite/recovery (and explicit set-password next) always go to set-password.
 * Other successful auth links may honor a safe relative `next` path.
 */
export function resolveAuthCallbackNext(
  type: string | null | undefined,
  nextParam: string | null | undefined,
): string {
  if (isPasswordSetupType(type) || nextParam === "/auth/set-password") {
    return "/auth/set-password";
  }

  const next = (nextParam || "/app").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/app";
  }
  if (next.startsWith("/auth/callback")) {
    return "/app";
  }
  return next;
}

export function shouldForcePasswordSetup(
  type: string | null | undefined,
  nextParam?: string | null,
): boolean {
  return (
    isPasswordSetupType(type) || nextParam === "/auth/set-password"
  );
}

export function passwordMeetsPolicy(password: string): {
  ok: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password.length > 72) {
    return { ok: false, message: "Password must be at most 72 characters." };
  }
  return { ok: true };
}
