import type { Contact, UUID } from "@/domain/types";

export interface ContactRepository {
  list(organizationId: UUID): Promise<Contact[]>;
  getById(organizationId: UUID, contactId: UUID): Promise<Contact | null>;
  create(
    input: Omit<Contact, "id" | "created_at" | "updated_at">,
  ): Promise<Contact>;
  update(
    organizationId: UUID,
    contactId: UUID,
    patch: Partial<
      Pick<Contact, "email" | "full_name" | "phone" | "company_name">
    >,
    updatedBy: UUID,
  ): Promise<Contact>;
}
