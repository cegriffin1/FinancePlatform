import { NextResponse } from "next/server";
import { CampaignMediaAttachmentService } from "@/application/media/CampaignMediaAttachmentService";
import {
  destinationsFromWizardChannels,
  isCreativeDestination,
  type CreativeAttachmentRole,
  type CreativeDestination,
} from "@/domain/media/destinations";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { DataModeError, isSupabaseDataMode } from "@/lib/dataMode";

type Params = { params: Promise<{ id: string }> };

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const code =
    error instanceof Error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
  if (error instanceof DataModeError) {
    const notFound = /not found/i.test(message);
    return NextResponse.json(
      { error: message, code: notFound ? "NOT_FOUND" : "DATABASE_ERROR" },
      { status: notFound ? 404 : 503 },
    );
  }
  if (code === "NOT_FOUND") {
    return NextResponse.json({ error: message, code }, { status: 404 });
  }
  if (code === "ARCHIVED_MEDIA" || code === "DUPLICATE" || code === "TENANT_VIOLATION") {
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
  return NextResponse.json({ error: message, code: code || "VALIDATION_ERROR" }, { status: 400 });
}

export async function GET(request: Request, { params }: Params) {
  const auth = await requireOrgAuth({ permission: "campaigns.view" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const { id: campaignId } = await params;
    const url = new URL(request.url);
    const channels = url.searchParams.getAll("channel");
    const destinationsParam = url.searchParams.getAll("destination");
    const selectedDestinations: CreativeDestination[] =
      destinationsParam.filter(isCreativeDestination).length > 0
        ? destinationsParam.filter(isCreativeDestination)
        : destinationsFromWizardChannels(channels);

    const service = new CampaignMediaAttachmentService();
    const evaluated = await service.evaluateAttachments({
      organizationId: auth.ctx.organizationId,
      campaignId,
      selectedDestinations:
        selectedDestinations.length > 0
          ? selectedDestinations
          : ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK"],
      connectionByProvider: {
        META: "NOT_CONNECTED",
        LINKEDIN: "NOT_CONNECTED",
        TIKTOK: "NOT_CONNECTED",
      },
    });

    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      attachments: evaluated.attachments,
      compatibility: evaluated.compatibility,
      readiness: evaluated.readiness,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireOrgAuth({ permission: "campaigns.update" });
  if (!auth.ok) return auth.response;
  if (!auth.ctx.organizationId) {
    return NextResponse.json(
      { error: "No active organization membership", code: "AUTHORIZATION_ERROR" },
      { status: 403 },
    );
  }

  try {
    const { id: campaignId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      media_asset_id?: string;
      destination?: string | null;
      role?: string;
      sort_order?: number;
      organization_id?: string;
    };
    // Never trust client organization_id
    void body.organization_id;

    if (!body.media_asset_id) {
      return NextResponse.json(
        { error: "media_asset_id is required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    let destination: CreativeDestination | null = null;
    if (body.destination != null && body.destination !== "") {
      if (!isCreativeDestination(body.destination)) {
        return NextResponse.json(
          { error: "Invalid destination", code: "VALIDATION_ERROR" },
          { status: 400 },
        );
      }
      destination = body.destination;
    }

    const role = (body.role || "PRIMARY") as CreativeAttachmentRole;
    if (!["PRIMARY", "SECONDARY", "VARIANT"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const service = new CampaignMediaAttachmentService();
    const attachment = await service.attachMedia({
      organizationId: auth.ctx.organizationId,
      campaignId,
      mediaAssetId: body.media_asset_id,
      destination,
      role,
      sortOrder: body.sort_order,
    });

    return NextResponse.json({
      ok: true,
      dataMode: isSupabaseDataMode() ? "supabase" : "simulation",
      attachment,
    });
  } catch (error) {
    return mapError(error);
  }
}
