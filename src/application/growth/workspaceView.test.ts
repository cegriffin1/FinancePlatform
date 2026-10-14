import { describe, expect, it } from "vitest";
import {
  leadFullName,
  leadShortName,
  safeCampaignAnalytics,
} from "./workspaceView";

describe("safeCampaignAnalytics", () => {
  it("returns zeros when analytics is missing (supabase campaign rows)", () => {
    expect(safeCampaignAnalytics({ id: "x" } as { analytics?: null })).toEqual({
      leads: 0,
      hot_leads: 0,
      qualified_leads: 0,
      appointments: 0,
    });
    expect(safeCampaignAnalytics(null)).toEqual({
      leads: 0,
      hot_leads: 0,
      qualified_leads: 0,
      appointments: 0,
    });
  });

  it("reads simulation analytics when present", () => {
    expect(
      safeCampaignAnalytics({
        analytics: { leads: 3, hot_leads: 1, qualified_leads: 2, appointments: 1 },
      }),
    ).toEqual({
      leads: 3,
      hot_leads: 1,
      qualified_leads: 2,
      appointments: 1,
    });
  });
});

describe("lead display names", () => {
  it("does not throw when last_name is missing", () => {
    expect(leadShortName({ first_name: "Casey" })).toBe("Casey");
    expect(leadShortName({ first_name: "Casey", last_name: null })).toBe("Casey");
    expect(leadShortName({})).toBe("Lead");
    expect(leadShortName({ first_name: "Casey", last_name: "Morgan" })).toBe(
      "Casey M.",
    );
  });

  it("formats full name safely", () => {
    expect(leadFullName({ first_name: "Casey", last_name: "Morgan" })).toBe(
      "Casey Morgan",
    );
    expect(leadFullName({ first_name: null, last_name: null })).toBe("Lead");
  });
});
