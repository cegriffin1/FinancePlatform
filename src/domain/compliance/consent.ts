/**
 * Versioned public consent copy — stamped on every lead for auditability.
 *
 * DRAFT FOR LEGAL/COMPLIANCE REVIEW — not legally approved language.
 */

/** @deprecated Prefer HIGHWATER_PUBLIC_CONSENT_VERSION for consumer retirement path. */
export const PUBLIC_CONSENT_VERSION_V1 = "altus-public-consent-v1";

/** @deprecated Legacy single-checkbox text retained for audit continuity. */
export const PUBLIC_CONSENT_TEXT_V1 =
  "I agree to be contacted by phone, email, or text about retirement planning options related to this assessment. Message/data rates may apply. I can opt out anytime. This is not an offer of insurance or securities.";

/** v2.1 — education required; matching + marketing optional. */
export const HIGHWATER_PUBLIC_CONSENT_VERSION = "highwater-public-consent-v2.1";

/** Required — educational disclaimer (not permission to market or match). */
export const HIGHWATER_CONSENT_EDUCATION_TEXT =
  "I understand that Highwater Capital provides independent financial education and optional advisor matching, and that this assessment and its results are educational information only — not individualized financial, tax, legal, or investment advice, and not an advisor–client relationship.";

/**
 * Optional — marketing / proactive follow-up communications.
 * Distinct from providing contact details to receive your own educational summary.
 */
export const HIGHWATER_CONSENT_MARKETING_TEXT =
  "Optional: I agree that Highwater Capital may contact me by phone, email, or text for educational follow-up and related offerings beyond delivering my assessment summary. Message and data rates may apply. I can opt out at any time.";

/** Optional — share with eligible participating professionals. */
export const HIGHWATER_CONSENT_MATCHING_SHARE_TEXT =
  "Optional: I consent to Highwater Capital sharing my assessment responses and contact details with eligible participating financial professionals for advisor matching. I understand participating professionals may pay for platform participation or lead access, and that eligibility and suitability take precedence over paid participation. No advisor is assigned until eligibility is reviewed. This is not an offer of insurance or securities.";

/**
 * Interim privacy language — privacy@highwaterctl.com is NOT verified as an
 * operational mailbox (no MX for highwaterctl.com at hardening time).
 */
export const HIGHWATER_CONSENT_PRIVACY_NOTE =
  "Privacy: You may request access, correction, deletion, or withdrawal of consent for future contact by using the privacy request instructions published on the Highwater Capital website when available. A dedicated privacy email inbox is not currently configured. Withdrawal does not affect processing already completed based on prior consent.";

export type HighwaterConsentChoices = {
  educationAcknowledged: boolean;
  marketingOptIn: boolean;
  matchingShareOptIn: boolean;
};

export type HighwaterConsentEvidence = {
  version: string;
  captured_at: string;
  source: "highwater_retirement_assessment_web";
  draft_for_legal_review: true;
  choices: HighwaterConsentChoices;
  language: {
    education: string;
    marketing: string;
    matching_share: string;
    privacy: string;
  };
  session_id?: string | null;
  campaign_id?: string | null;
  organization_id?: string | null;
};

export function buildHighwaterConsentEvidence(input: {
  choices: HighwaterConsentChoices;
  capturedAt?: string;
  sessionId?: string | null;
  campaignId?: string | null;
  organizationId?: string | null;
}): HighwaterConsentEvidence {
  return {
    version: HIGHWATER_PUBLIC_CONSENT_VERSION,
    captured_at: input.capturedAt ?? new Date().toISOString(),
    source: "highwater_retirement_assessment_web",
    draft_for_legal_review: true,
    choices: {
      educationAcknowledged: Boolean(input.choices.educationAcknowledged),
      marketingOptIn: Boolean(input.choices.marketingOptIn),
      matchingShareOptIn: Boolean(input.choices.matchingShareOptIn),
    },
    language: {
      education: HIGHWATER_CONSENT_EDUCATION_TEXT,
      marketing: HIGHWATER_CONSENT_MARKETING_TEXT,
      matching_share: HIGHWATER_CONSENT_MATCHING_SHARE_TEXT,
      privacy: HIGHWATER_CONSENT_PRIVACY_NOTE,
    },
    session_id: input.sessionId ?? null,
    campaign_id: input.campaignId ?? null,
    organization_id: input.organizationId ?? null,
  };
}

/** Compact durable stamp for lead_compliance_profiles.sharing_permissions_note (text). */
export function serializeConsentEvidenceForStorage(
  evidence: HighwaterConsentEvidence,
): string {
  return JSON.stringify(evidence);
}

export function parseConsentEvidenceFromStorage(
  raw: string | null | undefined,
): HighwaterConsentEvidence | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HighwaterConsentEvidence;
    if (!parsed?.version || !parsed?.choices) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Human-readable rollup of presented language (for consent_text field in-memory). */
export function buildHighwaterConsentTextPresented(
  choices: HighwaterConsentChoices,
): string {
  const parts = [HIGHWATER_CONSENT_EDUCATION_TEXT];
  if (choices.marketingOptIn) parts.push(HIGHWATER_CONSENT_MARKETING_TEXT);
  if (choices.matchingShareOptIn) parts.push(HIGHWATER_CONSENT_MATCHING_SHARE_TEXT);
  parts.push(HIGHWATER_CONSENT_PRIVACY_NOTE);
  // Always include optional texts as "presented" for audit of what was shown
  return [
    HIGHWATER_CONSENT_EDUCATION_TEXT,
    HIGHWATER_CONSENT_MARKETING_TEXT,
    HIGHWATER_CONSENT_MATCHING_SHARE_TEXT,
    HIGHWATER_CONSENT_PRIVACY_NOTE,
  ].join(" ");
}

/** @deprecated Use buildHighwaterConsentTextPresented / evidence helpers. */
export function buildHighwaterConsentEvidenceLegacy(): string {
  return buildHighwaterConsentTextPresented({
    educationAcknowledged: true,
    marketingOptIn: true,
    matchingShareOptIn: true,
  });
}

/** Active public consent identifiers used by the Highwater consumer journey. */
export const PUBLIC_CONSENT_VERSION = HIGHWATER_PUBLIC_CONSENT_VERSION;
export const PUBLIC_CONSENT_TEXT = buildHighwaterConsentTextPresented({
  educationAcknowledged: true,
  marketingOptIn: true,
  matchingShareOptIn: true,
});

/** @deprecated Renamed — kept for UI imports during transition. */
export const HIGHWATER_CONSENT_CONTACT_TEXT = HIGHWATER_CONSENT_MARKETING_TEXT;

export const ASSESSMENT_TEMPLATE_KEYS = {
  BUSINESS_GROWTH: "business-growth-assessment-v1",
  RETIREMENT: "retirement-opportunity-v1",
} as const;
