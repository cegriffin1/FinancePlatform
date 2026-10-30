import { NextResponse } from "next/server";
import { completeSocialOauthCallback } from "@/application/integrations/SocialOAuthService";
import { getEnv, hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

/**
 * OAuth callback for social Connected Accounts.
 * Never echoes code/token into redirects, logs, or query strings beyond opaque error codes.
 * Foundation: always fails closed (LIVE OAuth disabled).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  // Read code for validation presence only — never log or forward it.
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const dest = new URL(`${appUrl}/app/marketing/connected-accounts`);

  if (!state) {
    dest.searchParams.set("oauth", "error");
    dest.searchParams.set("code", "STATE_MISSING");
    return NextResponse.redirect(dest);
  }

  let expectedProfileId: string | null = null;
  if (hasSupabaseConfig()) {
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
  });

  // Never put provider codes or tokens on the redirect URL.
  dest.searchParams.set("oauth", "error");
  dest.searchParams.set("code", result.ok ? "UNEXPECTED_OK" : result.code);
  return NextResponse.redirect(dest);
}
