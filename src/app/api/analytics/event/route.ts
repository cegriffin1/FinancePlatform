import { NextResponse } from "next/server";

/**
 * Lightweight analytics ingest for launch UX events.
 * Does not store assessment answer values.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = typeof body.event === "string" ? body.event : "unknown";
    const payload =
      body.payload && typeof body.payload === "object" ? body.payload : {};
    // Intentionally minimal — avoid logging PII / answer content
    if (process.env.NODE_ENV !== "production") {
      console.info("[analytics]", event, payload);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
