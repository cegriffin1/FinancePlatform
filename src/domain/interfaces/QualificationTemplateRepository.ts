import type { QualificationTemplate, QualificationQuestion, QualificationBranch } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export interface QualificationTemplateRepository {
  getPublished(
    key: string,
    version?: string,
  ): Promise<QualificationTemplate | null>;
  listQuestions(templateId: UUID): Promise<QualificationQuestion[]>;
  listBranches(templateId: UUID): Promise<QualificationBranch[]>;
  listForModule(moduleKey: string): Promise<QualificationTemplate[]>;
}
