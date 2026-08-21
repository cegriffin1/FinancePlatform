import type { CampaignTemplate } from "@/domain/types";

export interface CampaignTemplateRepository {
  listCatalog(moduleKey?: string | null): Promise<CampaignTemplate[]>;
  getByKey(key: string): Promise<CampaignTemplate | null>;
}
