import { describe, expect, it } from "vitest";
import {
  enrichCampaignsWithLeadCounts,
  mapDurableLead,
} from "./durableWorkspace";
import { assertSameOrganization } from "@/infrastructure/security/requireOrgAuth";
import type { OrgAuthContext } from "@/application/auth/getOrgAuthContext";

function auth(orgId: string | null): OrgAuthContext {
  return {
    configured: true,
    session: null,
    userId: "u1",
    profileId: "u1",
    organizationId: orgId,
    memberId: "m1",
    roleKeys: ["owner"],
    permissions: ["leads.view_own", "campaigns.view"],
  };
}

describe("workspace org scoping", () => {
  it("only counts leads for the authenticated organization campaign set", () => {
    const orgA = "8a052a6e-50f2-4392-b309-c774c92a1d9e";
    const orgB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const campA = "2f3c71dc-0e03-417c-a9e6-661b446bf29c";

    // API layer would already filter by organization_id; enrich must not mix orgs
    const orgALeads = [
      mapDurableLead({
        id: "1",
        organization_id: orgA,
        campaign_id: campA,
        temperature_key: "HOT",
      }),
      mapDurableLead({
        id: "2",
        organization_id: orgA,
        campaign_id: campA,
        temperature_key: "VERY_HOT",
      }),
    ];
    const campaigns = [{ id: campA, organization_id: orgA, status: "published" }];
    const enriched = enrichCampaignsWithLeadCounts(campaigns, orgALeads);
    expect(enriched[0]?.analytics.leads).toBe(2);

    expect(assertSameOrganization(auth(orgA), orgA)).toBe(true);
    expect(assertSameOrganization(auth(orgA), orgB)).toBe(false);
    expect(assertSameOrganization(auth(null), orgA)).toBe(false);
  });
});
