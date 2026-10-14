import type {
  CreativeAttachmentRole,
  CreativeDestination,
} from "@/domain/media/destinations";
import type { MediaType } from "@/domain/media/types";

export type CampaignMediaAttachment = {
  id: string;
  organization_id: string;
  campaign_id: string;
  media_asset_id: string;
  destination: CreativeDestination | null;
  role: CreativeAttachmentRole;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Public list item — no storage_key / checksum. */
export type CampaignMediaAttachmentPublic = {
  id: string;
  campaign_id: string;
  media_asset_id: string;
  destination: CreativeDestination | null;
  role: CreativeAttachmentRole;
  sort_order: number;
  created_at: string;
  updated_at: string;
  media: {
    id: string;
    original_filename: string;
    mime_type: string;
    media_type: MediaType;
    size_bytes: number;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
    status: "ACTIVE" | "ARCHIVED";
    created_at: string;
  };
};
