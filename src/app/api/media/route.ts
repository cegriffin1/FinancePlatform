import { NextResponse } from "next/server";
import { MediaAssetService } from "@/application/media/MediaAssetService";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

/**
 * Campaign media foundation API.
 * organization_id is always taken from authenticated context — never from the body.
 */
export async function GET(request: Request) {
  const auth = await requireOrgAuth({ permission: "campaigns.view" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const assets = await new MediaAssetService().listMediaAssets(
      auth.ctx.organizationId,
      { includeArchived },
    );
    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      assets,
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to list media assets." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOrgAuth({ permission: "campaigns.create" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const form = await request.formData();
    // Ignore any client-supplied organization_id — auth context wins.
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "file is required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await new MediaAssetService().createMediaAsset({
      organizationId: auth.ctx.organizationId,
      createdBy: auth.ctx.userId,
      filename: file.name || "upload",
      mimeType: file.type,
      bytes,
    });
    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      asset: result.asset,
      duplicateChecksumCount: result.duplicateChecksumCount,
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "Invalid upload";
    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: string }).code || "VALIDATION_ERROR")
        : "VALIDATION_ERROR";
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
