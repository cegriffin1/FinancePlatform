import type { User } from "@supabase/supabase-js";
import { SYSTEM_ROLES, type SystemRoleKey } from "@/domain/permissions/keys";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";

const SYSTEM_ROLE_SET = new Set<string>(SYSTEM_ROLES);

export function getHighwaterLaunchTesterOrgSlug(
  raw = process.env.HIGHWATER_LAUNCH_TESTER_ORG_SLUG,
): string {
  const slug = String(raw ?? "altus")
    .trim()
    .toLowerCase();
  return slug || "altus";
}

function roleKeysFromMembership(row: {
  member_roles?:
    | Array<{ roles?: { key?: string } | { key?: string }[] | null }>
    | null;
}): SystemRoleKey[] {
  const keys: SystemRoleKey[] = [];
  for (const mr of row.member_roles ?? []) {
    const roles = mr.roles;
    const key = Array.isArray(roles) ? roles[0]?.key : roles?.key;
    if (key && SYSTEM_ROLE_SET.has(key)) {
      keys.push(key as SystemRoleKey);
    }
  }
  return keys;
}

/**
 * Authorized Highwater launch testers must be:
 * 1) Authenticated via Supabase (JWT validated by getUser), and
 * 2) Active members of the configured tester org (default: altus), and
 * 3) Assigned at least one recognized system role in that org.
 *
 * Membership is resolved with the service role after JWT validation because
 * end-user RLS often cannot read organization_members. User id always comes
 * from verified auth — never from client input.
 *
 * A bare login with no org membership (or membership only in another org)
 * does NOT unlock consumer intake while the launch gate is closed.
 */
export async function userIsAuthorizedHighwaterLaunchTester(
  user: User | null | undefined,
  orgSlug = getHighwaterLaunchTesterOrgSlug(),
): Promise<boolean> {
  if (!user?.id) return false;
  if (!hasSupabaseConfig()) return false;

  try {
    const admin = createSupabaseServiceClient();
    const { data, error } = await admin
      .from("organization_members")
      .select(
        "id, status, organizations!inner(slug), member_roles(roles(key))",
      )
      .eq("profile_id", user.id)
      .eq("status", "active");

    if (error || !data?.length) return false;

    const allowed = orgSlug.toLowerCase();
    for (const row of data) {
      const org = row.organizations as
        | { slug?: string }
        | { slug?: string }[]
        | null;
      const slug = (Array.isArray(org) ? org[0]?.slug : org?.slug) ?? "";
      if (slug.toLowerCase() !== allowed) continue;
      if (roleKeysFromMembership(row).length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function currentUserIsAuthorizedHighwaterLaunchTester(): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;
    return userIsAuthorizedHighwaterLaunchTester(data.user);
  } catch {
    return false;
  }
}
