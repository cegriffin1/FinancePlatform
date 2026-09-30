import { NextResponse } from "next/server";
import { MediaAssetService } from "@/application/media/MediaAssetService";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

type Params = { params: Promise<{ id: string }> };

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
    const asset = await new MediaAssetService().getMediaAsset(
      auth.ctx.organizationId,
      id,
    );
    if (!asset) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      asset,
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Unable to load media asset." }, { status: 400 });
  }
}

/** Archive (soft) — retains original object + metadata. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireOrgAuth({ permission: "campaigns.update" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      organization_id?: string;
    };
    // Explicitly ignore forged organization_id from body
    void body.organization_id;

    if (body.action !== "archive") {
      return NextResponse.json(
        { error: "Unsupported action", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { id } = await params;
    const asset = await new MediaAssetService().archiveMediaAsset(
      auth.ctx.organizationId,
      id,
    );
    if (!asset) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      asset,
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to archive media asset." },
      { status: 400 },
    );
  }
}
