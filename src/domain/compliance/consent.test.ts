import { describe, expect, it } from "vitest";
import {
  HIGHWATER_CONSENT_EDUCATION_TEXT,
  HIGHWATER_CONSENT_MARKETING_TEXT,
  HIGHWATER_CONSENT_MATCHING_SHARE_TEXT,
  HIGHWATER_CONSENT_PRIVACY_NOTE,
  HIGHWATER_PUBLIC_CONSENT_VERSION,
  PUBLIC_CONSENT_VERSION,
  buildHighwaterConsentEvidence,
  parseConsentEvidenceFromStorage,
  serializeConsentEvidenceForStorage,
} from "./consent";

describe("Highwater consent v2.1", () => {
  it("uses highwater-public-consent-v2.1", () => {
    expect(PUBLIC_CONSENT_VERSION).toBe("highwater-public-consent-v2.1");
    expect(HIGHWATER_PUBLIC_CONSENT_VERSION).toBe(PUBLIC_CONSENT_VERSION);
  });

  it("keeps education, marketing, and matching as distinct texts", () => {
    expect(HIGHWATER_CONSENT_EDUCATION_TEXT.toLowerCase()).toContain(
      "educational information only",
    );
    expect(HIGHWATER_CONSENT_MARKETING_TEXT.toLowerCase()).toContain("optional");
    expect(HIGHWATER_CONSENT_MATCHING_SHARE_TEXT.toLowerCase()).toContain(
      "optional",
    );
    expect(HIGHWATER_CONSENT_PRIVACY_NOTE.toLowerCase()).toContain(
      "not currently configured",
    );
    expect(HIGHWATER_CONSENT_PRIVACY_NOTE).not.toContain("privacy@highwaterctl.com");
  });

  it("serializes durable evidence with each choice and presented language", () => {
    const evidence = buildHighwaterConsentEvidence({
      choices: {
        educationAcknowledged: true,
        marketingOptIn: false,
        matchingShareOptIn: false,
      },
      capturedAt: "2026-10-16T12:00:00.000Z",
      sessionId: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      organizationId: "33333333-3333-4333-8333-333333333333",
    });
    const raw = serializeConsentEvidenceForStorage(evidence);
    const parsed = parseConsentEvidenceFromStorage(raw);
    expect(parsed?.version).toBe("highwater-public-consent-v2.1");
    expect(parsed?.choices.educationAcknowledged).toBe(true);
    expect(parsed?.choices.marketingOptIn).toBe(false);
    expect(parsed?.choices.matchingShareOptIn).toBe(false);
    expect(parsed?.language.education).toBe(HIGHWATER_CONSENT_EDUCATION_TEXT);
    expect(parsed?.language.matching_share).toBe(
      HIGHWATER_CONSENT_MATCHING_SHARE_TEXT,
    );
    expect(parsed?.draft_for_legal_review).toBe(true);
  });
});
