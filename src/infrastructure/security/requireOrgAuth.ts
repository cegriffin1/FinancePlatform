import { NextResponse } from "next/server";
import {
  getOrgAuthContext,
  hasPermission,
  type OrgAuthContext,
} from "@/application/auth/getOrgAuthContext";
import type { PermissionKey } from "@/domain/permissions/keys";
import { isSimulationDataMode } from "@/lib/dataMode";
import { getEnv } from "@/lib/env";
import { logAltusError } from "@/lib/observability";

/**
 * Server-side authorization for internal APIs.
 * - Supabase / production: requires authenticated membership
 * - Simulation (non-production): allowed for local demo unless locked
 * Spoofable x-altus-role headers are IGNORED.
 */
export async function requireOrgAuth(options?: {
  permission?: PermissionKey;
}): Promise<
  | { ok: true; ctx: OrgAuthContext }
  | { ok: false; response: NextResponse }
> {
  const env = getEnv();
  const ctx = await getOrgAuthContext();

  // Explicit local open sim for demos
  if (env.ALTUS_ALLOW_UNAUTHENTICATED_SIM) {
    return {
      ok: true,
      ctx: {
        ...ctx,
        organizationId: ctx.organizationId,
        permissions: ctx.permissions.length
          ? ctx.permissions
          : (["leads.view_all", "campaigns.view", "reports.view_all", "setter.leads.view"] as PermissionKey[]),
      },
    };
  }

  // Simulation mode in non-production: keep developer workflow
  if (
    isSimulationDataMode() &&
    process.env.NODE_ENV !== "production" &&
    !ctx.configured
  ) {
    return {
      ok: true,
      ctx: {
        configured: false,
        session: null,
        userId: "sim-user",
        profileId: "sim-user",
        organizationId: null,
        memberId: null,
        roleKeys: ["admin"],
        permissions: [
          "leads.view_all",
          "campaigns.view",
          "reports.view_all",
          "setter.leads.view",
          "leads.view_team",
        ] as PermissionKey[],
      },
    };
  }

  if (!ctx.userId) {
    logAltusError("AUTHORIZATION_ERROR", "Unauthenticated internal API call");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 },
      ),
    };
  }

  if (!ctx.organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "No active organization membership",
          code: "AUTHORIZATION_ERROR",
        },
        { status: 403 },
      ),
    };
  }

  if (options?.permission && !hasPermission(ctx, options.permission)) {
    logAltusError("AUTHORIZATION_ERROR", "Permission denied", {
      permission: options.permission,
      userId: ctx.userId,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "AUTHORIZATION_ERROR" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, ctx };
}

/** Tenant scope helper — reject cross-org access. */
export function assertSameOrganization(
  ctx: OrgAuthContext,
  resourceOrganizationId: string | null | undefined,
): boolean {
  if (!ctx.organizationId || !resourceOrganizationId) return false;
  return ctx.organizationId === resourceOrganizationId;
}
