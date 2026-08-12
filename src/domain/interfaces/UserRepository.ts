import type { OrganizationMember, Profile, UUID } from "@/domain/types";
import type { PermissionKey } from "@/domain/permissions/keys";

export interface UserRepository {
  getProfileById(profileId: UUID): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  upsertProfile(input: {
    id: UUID;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  }): Promise<Profile>;
  getMembership(
    organizationId: UUID,
    profileId: UUID,
  ): Promise<OrganizationMember | null>;
  listMemberships(profileId: UUID): Promise<OrganizationMember[]>;
  getEffectivePermissions(
    organizationId: UUID,
    profileId: UUID,
  ): Promise<PermissionKey[]>;
  deactivateMember(
    organizationId: UUID,
    memberId: UUID,
    updatedBy: UUID,
  ): Promise<OrganizationMember>;
}
