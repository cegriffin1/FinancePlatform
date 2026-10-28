import { beforeEach, describe, expect, it } from "vitest";
import {
  persistPreferredAppointmentRequest,
  resetAppointmentRequestLocksForTests,
} from "./appointmentRequestService";
import { resetSimStore, getSimStore } from "./simulationStore";
import { processPublicLeadSubmission } from "./leadPipeline";
import {
  ensureDirectRetirementCampaign,
  DIRECT_RETIREMENT_CAMPAIGN_SLUG,
  DIRECT_RETIREMENT_ORG_SLUG,
} from "./campaignService";
import { validateAppointmentPreference } from "@/domain/appointments/preferredRequest";
import {
  PUBLIC_CONSENT_VERSION,
  parseConsentEvidenceFromStorage,
} from "@/domain/compliance/consent";

beforeEach(() => {
  resetSimStore();
  resetAppointmentRequestLocksForTests();
  delete process.env.ALTUS_DATA_MODE;
});

const answers = {
  age_range: "60–64",
  state: "FL",
  employment: "Working",
  retirement_timing: "Within 2 years",
  marital_status: "Married",
  total_retirement_assets: "$1M–$1.99M",
  repositionable_assets: "$750K–$999K",
  asset_location: "401(k)",
  employer_assets: "Former employer",
  existing_annuity: "None",
  liquidity_timeline: "1–3 years",
  primary_objective: "INCOME",
  income_start: "Within 1 year",
  desired_monthly_income: "$5,000–$7,500",
  lifetime_income_importance: "9",
  existing_guaranteed_income: "Neither",
  inflation_concern: "8",
  liquidity_importance: "7",
  legacy_importance: "5",
  healthcare_concern: "6",
  carrier_strength_importance: "8",
  advisor_team_importance: "7",
  current_advisor: "Not currently",
  decision_timeline: "Immediately",
};

async function makeLead(opts?: {
  matching?: boolean;
  marketing?: boolean;
}) {
  ensureDirectRetirementCampaign();
  return processPublicLeadSubmission({
    organizationSlug: DIRECT_RETIREMENT_ORG_SLUG,
    campaignSlug: DIRECT_RETIREMENT_CAMPAIGN_SLUG,
    answers,
    contact: {
      firstName: "Casey",
      lastName: "River",
      businessName: "Casey River",
      email: `casey.river.${Math.random().toString(16).slice(2)}@example.com`,
      phone: "5551112222",
      state: "FL",
      preferredContact: "Phone",
      consent: true,
      consentEducation: true,
      consentMarketing: opts?.marketing ?? false,
      consentMatchingShare: opts?.matching ?? false,
    },
    appointmentRequested: false,
    attribution: { source_channel: "DIRECT_ASSESSMENT" },
  });
}

describe("Highwater consent optionality + appointment preference", () => {
  it("allows educational completion without matching or marketing consent", async () => {
    const { lead } = await makeLead({ matching: false, marketing: false });
    expect(lead.compliance?.consent_version).toBe(PUBLIC_CONSENT_VERSION);
    expect(lead.compliance?.resale_permitted).toBe(false);
    expect(lead.compliance?.data_sharing_permitted).toBe(false);
    expect(lead.compliance?.marketing_consent).toBe(false);
    expect(lead.distribution_status).toBe("held");
    const evidence = parseConsentEvidenceFromStorage(
      lead.compliance?.sharing_permissions_note,
    );
    expect(evidence?.choices.matchingShareOptIn).toBe(false);
    expect(evidence?.choices.marketingOptIn).toBe(false);
    expect(evidence?.language.education).toBeTruthy();
  });

  it("permits matching only when affirmatively opted in", async () => {
    const { lead } = await makeLead({ matching: true, marketing: true });
    expect(lead.compliance?.data_sharing_permitted).toBe(true);
    expect(lead.compliance?.marketing_consent).toBe(true);
    expect(lead.distribution_status).not.toBe("held");
  });

  it("persists preferred appointment without confirming booking", async () => {
    const { lead } = await makeLead();
    const pref = validateAppointmentPreference(
      {
        preferredDate: "2026-10-22",
        preferredTime: "14:00",
        timeZone: "America/New_York",
      },
      new Date("2026-10-16T12:00:00.000Z"),
    );
    expect(pref.ok).toBe(true);
    if (!pref.ok) return;

    const first = await persistPreferredAppointmentRequest({
      lead,
      preference: pref.value,
      preferredContactMethod: "Phone",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.duplicate).toBe(false);

    const second = await persistPreferredAppointmentRequest({
      lead,
      preference: pref.value,
      preferredContactMethod: "Phone",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.duplicate).toBe(true);
    expect(second.appointmentId).toBe(first.appointmentId);

    const stored = lead.appointments?.[0];
    expect(stored?.status).toBe("requested");
    expect(stored?.notes).toContain("PREFERRED_REQUEST_NOT_CONFIRMED");
  });

  it("serializes concurrent preference requests to a single open appointment", async () => {
    const { lead } = await makeLead();
    const pref = validateAppointmentPreference(
      {
        preferredDate: "2026-10-23",
        preferredTime: "10:00",
        timeZone: "America/New_York",
      },
      new Date("2026-10-16T12:00:00.000Z"),
    );
    expect(pref.ok).toBe(true);
    if (!pref.ok) return;

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        persistPreferredAppointmentRequest({
          lead,
          preference: pref.value,
          preferredContactMethod: "Phone",
        }),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(
      results.filter((r) => r.ok).map((r) => (r.ok ? r.appointmentId : "")),
    );
    expect(ids.size).toBe(1);
    const open = getSimStore().appointments.filter(
      (a) => a.lead_id === lead.id && a.status === "requested",
    );
    expect(open).toHaveLength(1);
    const duplicates = results.filter((r) => r.ok && r.duplicate).length;
    expect(duplicates).toBeGreaterThanOrEqual(7);
  });

  it("allows a new preference after prior request is cancelled", async () => {
    const { lead } = await makeLead();
    const pref = validateAppointmentPreference(
      {
        preferredDate: "2026-10-24",
        preferredTime: "11:00",
        timeZone: "America/New_York",
      },
      new Date("2026-10-16T12:00:00.000Z"),
    );
    expect(pref.ok).toBe(true);
    if (!pref.ok) return;

    const first = await persistPreferredAppointmentRequest({
      lead,
      preference: pref.value,
      preferredContactMethod: "Phone",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const existing = getSimStore().appointments.find((a) => a.id === first.appointmentId)!;
    existing.status = "cancelled";
    lead.appointments = lead.appointments?.map((a) =>
      a.id === existing.id ? { ...a, status: "cancelled" } : a,
    );

    const again = await persistPreferredAppointmentRequest({
      lead,
      preference: pref.value,
      preferredContactMethod: "Phone",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.duplicate).toBe(false);
    expect(again.appointmentId).not.toBe(first.appointmentId);
  });
});
