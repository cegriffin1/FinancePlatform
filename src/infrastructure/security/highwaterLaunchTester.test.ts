import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/supabase/admin", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  hasSupabaseConfig: vi.fn(() => true),
}));

import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import {
  getHighwaterLaunchTesterOrgSlug,
  userIsAuthorizedHighwaterLaunchTester,
} from "@/infrastructure/security/highwaterLaunchTester";

function mockAdminQuery(result: { data: unknown; error: unknown }) {
  vi.mocked(createSupabaseServiceClient).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => result),
        })),
      })),
    })),
  } as never);
}

describe("highwater launch tester authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createSupabaseServiceClient);
  });

  it("defaults tester org slug to altus", () => {
    expect(getHighwaterLaunchTesterOrgSlug(undefined)).toBe("altus");
    expect(getHighwaterLaunchTesterOrgSlug("")).toBe("altus");
    expect(getHighwaterLaunchTesterOrgSlug(" Altus ")).toBe("altus");
  });

  it("rejects missing user", async () => {
    await expect(userIsAuthorizedHighwaterLaunchTester(null)).resolves.toBe(
      false,
    );
  });

  it("rejects authenticated user without org membership", async () => {
    mockAdminQuery({ data: [], error: null });
    await expect(
      userIsAuthorizedHighwaterLaunchTester({ id: "user-1" } as never),
    ).resolves.toBe(false);
  });

  it("rejects membership in a non-allowed org", async () => {
    mockAdminQuery({
      data: [
        {
          id: "m1",
          status: "active",
          organizations: { slug: "other-org" },
          member_roles: [{ roles: { key: "admin" } }],
        },
      ],
      error: null,
    });
    await expect(
      userIsAuthorizedHighwaterLaunchTester({ id: "user-1" } as never),
    ).resolves.toBe(false);
  });

  it("rejects altus membership with no system role", async () => {
    mockAdminQuery({
      data: [
        {
          id: "m1",
          status: "active",
          organizations: { slug: "altus" },
          member_roles: [],
        },
      ],
      error: null,
    });
    await expect(
      userIsAuthorizedHighwaterLaunchTester({ id: "user-1" } as never),
    ).resolves.toBe(false);
  });

  it("allows active altus member with a system role", async () => {
    mockAdminQuery({
      data: [
        {
          id: "m1",
          status: "active",
          organizations: { slug: "altus" },
          member_roles: [{ roles: { key: "admin" } }],
        },
      ],
      error: null,
    });
    await expect(
      userIsAuthorizedHighwaterLaunchTester({ id: "user-1" } as never),
    ).resolves.toBe(true);
  });
});
