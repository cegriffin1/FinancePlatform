import type { OrganizationRepository } from "@/domain/interfaces/OrganizationRepository";
import type {
  Organization,
  OrganizationMember,
  OrganizationSettings,
  UUID,
} from "@/domain/types";

/**
 * Placeholder Supabase-backed repository.
 * Concrete query methods land with org onboarding. UI depends on the interface.
 */
export class SupabaseOrganizationRepository implements OrganizationRepository {
  async create(input: {
    name: string;
    slug: string;
    createdBy: UUID;
  }): Promise<Organization> {
    void input;
    throw new Error("Not implemented in foundation milestone");
  }

  async getById(organizationId: UUID): Promise<Organization | null> {
    void organizationId;
    return null;
  }

  async getBySlug(slug: string): Promise<Organization | null> {
    void slug;
    return null;
  }

  async update(
    organizationId: UUID,
    patch: Partial<Pick<Organization, "name" | "status">>,
    updatedBy: UUID,
  ): Promise<Organization> {
    void organizationId;
    void patch;
    void updatedBy;
    throw new Error("Not implemented in foundation milestone");
  }

  async getSettings(organizationId: UUID): Promise<OrganizationSettings | null> {
    void organizationId;
    return null;
  }

  async upsertSettings(
    organizationId: UUID,
    patch: Partial<
      Pick<
        OrganizationSettings,
        "display_name" | "logo_url" | "primary_color" | "timezone" | "locale"
      >
    >,
    updatedBy: UUID,
  ): Promise<OrganizationSettings> {
    void organizationId;
    void patch;
    void updatedBy;
    throw new Error("Not implemented in foundation milestone");
  }

  async listMembers(organizationId: UUID): Promise<OrganizationMember[]> {
    void organizationId;
    return [];
  }
}
