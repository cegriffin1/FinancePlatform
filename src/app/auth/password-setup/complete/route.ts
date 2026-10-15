import { NextResponse } from "next/server";
import { PASSWORD_SETUP_COOKIE } from "@/lib/auth/password-setup";

/** Clears the password-setup gate cookie after a successful updateUser({ password }). */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PASSWORD_SETUP_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
