import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import { PASSWORD_SETUP_COOKIE } from "@/lib/auth/password-setup";

/**
 * Arms the password-setup gate when an invite/recovery session is established client-side.
 * Requires an authenticated session — does not accept anonymous arming.
 */
export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PASSWORD_SETUP_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}
