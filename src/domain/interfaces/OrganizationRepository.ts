import type {
  Organization,
  OrganizationMember,
  OrganizationSettings,
  UUID,
} from "@/domain/types";

export interface OrganizationRepository {
  create(input: {
    name: string;
    slug: string;
    createdBy: UUID;
  }): Promise<Organization>;
  getById(organizationId: UUID): Promise<Organization | null>;
  getBySlug(slug: string): Promise<Organization | null>;
  update(
    organizationId: UUID,
    patch: Partial<Pick<Organization, "name" | "status">>,
    updatedBy: UUID,
  ): Promise<Organization>;
  getSettings(organizationId: UUID): Promise<OrganizationSettings | null>;
  upsertSettings(
    organizationId: UUID,
    patch: Partial<
      Pick<
        OrganizationSettings,
        "display_name" | "logo_url" | "primary_color" | "timezone" | "locale"
      >
    >,
    updatedBy: UUID,
  ): Promise<OrganizationSettings>;
  listMembers(organizationId: UUID): Promise<OrganizationMember[]>;
}
