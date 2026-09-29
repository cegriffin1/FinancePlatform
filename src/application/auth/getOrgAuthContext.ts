import type { Session } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import {
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
  type SystemRoleKey,
} from "@/domain/permissions/keys";
import { logAltusError } from "@/lib/observability";

export type OrgAuthContext = {
  configured: boolean;
  session: Session | null;
  userId: string | null;
  profileId: string | null;
  organizationId: string | null;
  memberId: string | null;
  roleKeys: SystemRoleKey[];
  permissions: PermissionKey[];
};

const EMPTY: OrgAuthContext = {
  configured: false,
  session: null,
  userId: null,
  profileId: null,
  organizationId: null,
  memberId: null,
  roleKeys: [],
  permissions: [],
};

/**
 * Trusted server-side auth + organization membership resolution.
 * Never trust client-supplied organization_id or role headers.
 */
export async function getOrgAuthContext(): Promise<OrgAuthContext> {
  if (!hasSupabaseConfig()) {
    return EMPTY;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { ...EMPTY, configured: true };
    }

    const userId = userData.user.id;
    const { data: sessionData } = await supabase.auth.getSession();

    const { data: memberships, error: memErr } = await supabase
      .from("organization_members")
      .select("id, organization_id, profile_id, status")
      .eq("profile_id", userId)
      .eq("status", "active")
      .limit(5);

    if (memErr) {
      logAltusError("AUTH_ERROR", "Membership lookup failed", {
        message: memErr.message,
      });
      return {
        configured: true,
        session: sessionData.session,
        userId,
        profileId: userId,
        organizationId: null,
        memberId: null,
        roleKeys: [],
        permissions: [],
      };
    }

    const membership = memberships?.[0] ?? null;
    if (!membership) {
      return {
        configured: true,
        session: sessionData.session,
        userId,
        profileId: userId,
        organizationId: null,
        memberId: null,
        roleKeys: [],
        permissions: [],
      };
    }

    const { data: memberRoles } = await supabase
      .from("member_roles")
      .select("role_id, roles(key)")
      .eq("member_id", membership.id);

    const roleKeys = (memberRoles ?? [])
      .map((row) => {
        const roles = row.roles as { key?: string } | { key?: string }[] | null;
        if (Array.isArray(roles)) return roles[0]?.key;
        return roles?.key;
      })
      .filter((k): k is SystemRoleKey => Boolean(k)) as SystemRoleKey[];

    const permissions = new Set<PermissionKey>();
    for (const role of roleKeys) {
      const granted = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
      granted.forEach((p) => permissions.add(p));
    }
    // Owners/admins get admin pack if role key maps oddly
    if (roleKeys.includes("admin") || roleKeys.includes("owner")) {
      DEFAULT_ROLE_PERMISSIONS.admin.forEach((p) => permissions.add(p));
    }

    return {
      configured: true,
      session: sessionData.session,
      userId,
      profileId: membership.profile_id,
      organizationId: membership.organization_id,
      memberId: membership.id,
      roleKeys,
      permissions: [...permissions],
    };
  } catch (e) {
    logAltusError("AUTH_ERROR", "getOrgAuthContext failed", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return { ...EMPTY, configured: true };
  }
}

export function hasPermission(
  ctx: OrgAuthContext,
  permission: PermissionKey,
): boolean {
  return ctx.permissions.includes(permission);
}
