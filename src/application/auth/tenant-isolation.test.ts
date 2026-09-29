import { describe, expect, it } from "vitest";
import { assertSameOrganization } from "@/infrastructure/security/requireOrgAuth";
import type { OrgAuthContext } from "@/application/auth/getOrgAuthContext";

function ctx(organizationId: string | null): OrgAuthContext {
  return {
    configured: true,
    session: null,
    userId: "user-a",
    profileId: "user-a",
    organizationId,
    memberId: "member-a",
    roleKeys: ["admin"],
    permissions: ["leads.view_all"],
  };
}

describe("Tenant isolation helpers", () => {
  it("allows same-organization access", () => {
    expect(
      assertSameOrganization(ctx("org-a"), "org-a"),
    ).toBe(true);
  });

  it("blocks cross-organization access", () => {
    expect(
      assertSameOrganization(ctx("org-a"), "org-b"),
    ).toBe(false);
  });

  it("blocks when organization context missing", () => {
    expect(assertSameOrganization(ctx(null), "org-b")).toBe(false);
    expect(assertSameOrganization(ctx("org-a"), null)).toBe(false);
  });
});
