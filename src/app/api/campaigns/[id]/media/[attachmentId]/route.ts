import { NextResponse } from "next/server";
import { CampaignMediaAttachmentService } from "@/application/media/CampaignMediaAttachmentService";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireOrgAuth({ permission: "campaigns.update" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const { attachmentId } = await params;
    const service = new CampaignMediaAttachmentService();
    const removed = await service.detachMedia({
      organizationId: auth.ctx.organizationId,
      attachmentId,
    });
    if (!removed) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
    });
  } catch (error) {
    if (error instanceof DataModeError) {
      return NextResponse.json(
        { error: error.message, code: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to detach media." },
      { status: 400 },
    );
  }
}
