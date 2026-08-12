import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  unionPermissions,
  type PermissionKey,
} from "@/domain/permissions/keys";
import {
  assertPermission,
  AuthorizationError,
  canViewLeads,
} from "@/application/authorization";

describe("permission helpers", () => {
  it("detects a granted permission", () => {
    const granted: PermissionKey[] = ["leads.view_own", "pipeline.view"];
    expect(hasPermission(granted, "leads.view_own")).toBe(true);
    expect(hasPermission(granted, "leads.view_all")).toBe(false);
  });

  it("supports any/all checks and unions", () => {
    const a: PermissionKey[] = ["campaigns.view"];
    const b: PermissionKey[] = ["campaigns.create", "campaigns.view"];
    expect(hasAnyPermission(a, ["campaigns.create", "campaigns.view"])).toBe(true);
    expect(hasAllPermissions(b, ["campaigns.view", "campaigns.create"])).toBe(true);
    expect(unionPermissions(a, b).sort()).toEqual(
      ["campaigns.create", "campaigns.view"].sort(),
    );
  });

  it("owner role includes core org permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.owner).toContain("organization.update");
    expect(DEFAULT_ROLE_PERMISSIONS.owner).toContain("users.invite");
    expect(DEFAULT_ROLE_PERMISSIONS.contractor).not.toContain("users.invite");
  });
});

describe("authorization service", () => {
  it("asserts required permissions", () => {
    expect(() =>
      assertPermission(["leads.update"], "leads.assign"),
    ).toThrow(AuthorizationError);

    expect(() => assertPermission(["leads.assign"], "leads.assign")).not.toThrow();
  });

  it("respects lead visibility scopes without cross-tenant concerns", () => {
    expect(canViewLeads(["leads.view_own"], "own")).toBe(true);
    expect(canViewLeads(["leads.view_own"], "team")).toBe(false);
    expect(canViewLeads(["leads.view_team"], "team")).toBe(true);
    expect(canViewLeads(["leads.view_all"], "all")).toBe(true);
    expect(canViewLeads(["leads.view_team"], "all")).toBe(false);
  });
});
