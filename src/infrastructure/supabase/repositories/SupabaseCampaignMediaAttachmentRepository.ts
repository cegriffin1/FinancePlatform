import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import type { CampaignMediaAttachment } from "@/domain/media/attachments";
import type {
  CreativeAttachmentRole,
  CreativeDestination,
} from "@/domain/media/destinations";
import type { MediaAsset } from "@/domain/media/types";
import { DataModeError } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

type AttachmentRow = {
  id: string;
  organization_id: string;
  campaign_id: string;
  media_asset_id: string;
  destination: string | null;
  role: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: AttachmentRow): CampaignMediaAttachment {
  return {
    id: row.id,
    organization_id: row.organization_id,
    campaign_id: row.campaign_id,
    media_asset_id: row.media_asset_id,
    destination: row.destination as CreativeDestination | null,
    role: row.role as CreativeAttachmentRole,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class SupabaseCampaignMediaAttachmentRepository {
  private client() {
    try {
      return createSupabaseServiceClient();
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Attachment repository unavailable", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      throw new DataModeError("Campaign media attachments are unavailable.");
    }
  }

  async getCampaignOrg(
    campaignId: string,
    organizationId: string,
  ): Promise<{ id: string; organization_id: string; name: string } | null> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, organization_id, name")
      .eq("id", campaignId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) {
      throw new DataModeError(error.message);
    }
    return data;
  }

  async getMediaForOrg(
    mediaAssetId: string,
    organizationId: string,
  ): Promise<MediaAsset | null> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", mediaAssetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new DataModeError(error.message);
    if (!data) return null;
    return data as MediaAsset;
  }

  async listForCampaign(
    campaignId: string,
    organizationId: string,
  ): Promise<CampaignMediaAttachment[]> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("campaign_media_attachments")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new DataModeError(error.message);
    return (data || []).map((r) => mapRow(r as AttachmentRow));
  }

  async insert(
    row: Omit<CampaignMediaAttachment, "created_at" | "updated_at"> & {
      created_at?: string;
      updated_at?: string;
    },
  ): Promise<CampaignMediaAttachment> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("campaign_media_attachments")
      .insert({
        id: row.id,
        organization_id: row.organization_id,
        campaign_id: row.campaign_id,
        media_asset_id: row.media_asset_id,
        destination: row.destination,
        role: row.role,
        sort_order: row.sort_order,
      })
      .select("*")
      .single();
    if (error) throw new DataModeError(error.message);
    return mapRow(data as AttachmentRow);
  }

  async deleteForOrg(
    attachmentId: string,
    organizationId: string,
  ): Promise<boolean> {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("campaign_media_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("organization_id", organizationId)
      .select("id");
    if (error) throw new DataModeError(error.message);
    return (data || []).length > 0;
  }

  async ensureDraftCampaign(input: {
    id?: string | null;
    organizationId: string;
    name: string;
    createdBy?: string | null;
  }): Promise<{ id: string }> {
    const supabase = this.client();
    if (input.id) {
      const existing = await this.getCampaignOrg(input.id, input.organizationId);
      if (existing) return { id: existing.id };
    }

    const slug = `draft-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        organization_id: input.organizationId,
        name: input.name || "Untitled campaign",
        status: "draft",
        slug,
        description: "Campaign draft",
        owner_type: "SUBSCRIBER_CAMPAIGN",
        owner_id: input.organizationId,
        created_by: input.createdBy ?? null,
      })
      .select("id")
      .single();
    if (error) throw new DataModeError(error.message);
    return { id: data.id as string };
  }
}
