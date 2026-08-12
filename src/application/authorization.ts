import type { PermissionKey } from "@/domain/permissions/keys";
import { hasPermission } from "@/domain/permissions/keys";

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertPermission(
  granted: readonly PermissionKey[],
  required: PermissionKey,
): void {
  if (!hasPermission(granted, required)) {
    throw new AuthorizationError(`Missing permission: ${required}`);
  }
}

export function canViewLeads(
  granted: readonly PermissionKey[],
  scope: "own" | "team" | "all",
): boolean {
  if (scope === "all") return hasPermission(granted, "leads.view_all");
  if (scope === "team") {
    return (
      hasPermission(granted, "leads.view_team") ||
      hasPermission(granted, "leads.view_all")
    );
  }
  return (
    hasPermission(granted, "leads.view_own") ||
    hasPermission(granted, "leads.view_team") ||
    hasPermission(granted, "leads.view_all")
  );
}
