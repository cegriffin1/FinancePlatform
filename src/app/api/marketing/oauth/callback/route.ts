import { NextResponse } from "next/server";
import {
  LIVE_SOCIAL_OAUTH_ENABLED,
  completeSocialOauthCallback,
} from "@/application/integrations/SocialOAuthService";
import { getEnv, hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { getOrgAuthContext } from "@/application/auth/getOrgAuthContext";

/**
 * OAuth callback for social Connected Accounts.
 * Never echoes code/token into redirects, logs, or query strings beyond opaque error codes.
 * Foundation: always fails closed (LIVE OAuth disabled).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  // Read code for presence only — never log or forward it.
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // Fixed in-app destination — never derived from query params (open-redirect defense).
  const dest = new URL(`${appUrl}/app/marketing/connected-accounts`);

  if (!state) {
    dest.searchParams.set("oauth", "error");
    dest.searchParams.set("code", "STATE_MISSING");
    return NextResponse.redirect(dest);
  }

  let expectedProfileId: string | null = null;
  let expectedOrganizationId: string | undefined;

  if (LIVE_SOCIAL_OAUTH_ENABLED) {
    // LIVE callbacks require an authenticated session bound to org + user.
    const auth = await getOrgAuthContext();
    if (!auth.userId || !auth.organizationId) {
      dest.searchParams.set("oauth", "error");
      dest.searchParams.set("code", "AUTH_REQUIRED");
      return NextResponse.redirect(dest);
    }
    expectedProfileId = auth.profileId ?? auth.userId;
    expectedOrganizationId = auth.organizationId;
  } else if (hasSupabaseConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      expectedProfileId = data.user?.id ?? null;
    } catch {
      expectedProfileId = null;
    }
  }

  const result = await completeSocialOauthCallback({
    state,
    code,
    error,
    expectedProfileId,
    expectedOrganizationId,
  });

  // Never put provider codes or tokens on the redirect URL.
  if (result.ok) {
    dest.searchParams.set("oauth", "connected");
    dest.searchParams.set("platform", result.platform);
    return NextResponse.redirect(dest);
  }
  dest.searchParams.set("oauth", "error");
  dest.searchParams.set("code", result.code);
  return NextResponse.redirect(dest);
}
