import { NextResponse } from "next/server";
import { MediaAssetService } from "@/application/media/MediaAssetService";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

type Params = { params: Promise<{ id: string }> };

/** Short-lived signed URL for preview — never exposes service-role credentials. */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireOrgAuth({ permission: "campaigns.view" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const access = await new MediaAssetService().getMediaAccessUrl(
      auth.ctx.organizationId,
      id,
    );
    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      url: access.url,
      expiresInSeconds: access.expiresInSeconds,
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      const notFound = /not found/i.test(error.message);
      return NextResponse.json(
        { error: error.message, code: notFound ? "NOT_FOUND" : "DATABASE_ERROR" },
        { status: notFound ? 404 : 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to create media access URL." },
      { status: 400 },
    );
  }
}
