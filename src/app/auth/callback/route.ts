import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import {
  PASSWORD_SETUP_COOKIE,
  resolveAuthCallbackNext,
  shouldForcePasswordSetup,
} from "@/lib/auth/password-setup";

/**
 * Supabase Auth callback for invite / recovery / magic-link PKCE + OTP hash flows.
 * Never logs tokens. Establishes a session cookie, then routes to password setup when needed.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next");

  const errorRedirect = (reason: string) => {
    const dest = new URL("/auth/error", request.url);
    dest.searchParams.set("reason", reason);
    return NextResponse.redirect(dest);
  };

  if (!hasSupabaseConfig()) {
    return errorRedirect("not_configured");
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return errorRedirect("exchange_failed");
      }
    } else if (tokenHash && typeParam) {
      const { error } = await supabase.auth.verifyOtp({
        type: typeParam as EmailOtpType,
        token_hash: tokenHash,
      });
      if (error) {
        return errorRedirect("verify_failed");
      }
    } else {
      return errorRedirect("missing_token");
    }

    const nextPath = resolveAuthCallbackNext(typeParam, nextParam);
    const response = NextResponse.redirect(new URL(nextPath, request.url));

    if (shouldForcePasswordSetup(typeParam, nextParam) || nextPath === "/auth/set-password") {
      response.cookies.set(PASSWORD_SETUP_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60,
      });
    }

    return response;
  } catch {
    return errorRedirect("unexpected");
  }
}
