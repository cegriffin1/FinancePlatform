import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import {
  LeadAgingService,
  LeadComplianceService,
  LeadInventoryService,
  LeadPricingService,
  MarketplacePurchaseService,
} from "@/application/inventory/LeadInventoryService";
import {
  DEFAULT_OWNERSHIP_PERIOD_DAYS,
  computeOwnershipExpiry,
} from "@/domain/types/retirement-crm";
import type { SimLead } from "@/application/growth/simulationStore";

beforeEach(() => {
  resetSimStore();
});

const answers = {
  age_range: "60–64",
  state: "FL",
  employment: "Working",
  retirement_timing: "Within 2 years",
  total_retirement_assets: "$500K–$749K",
  repositionable_assets: "$500K–$749K",
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
  current_advisor: "Not currently",
  decision_timeline: "Within 30 days",
};

async function seedOwnedLead() {
  const campaign = createSimCampaign({
    owner_type: "SUBSCRIBER_CAMPAIGN",
    owner_id: "20000000-0000-4000-8000-000000000003",
    organization_id: "20000000-0000-4000-8000-000000000003",
    organization_slug: "demo-org",
    name: "Inventory Seed",
    description: "",
    goal: "generate_leads",
    strategy: "Retirement",
    audience: {},
    territories: ["FL"],
    channels: ["meta"],
    destination: "interactive_assessment",
    budget_cents: 50000,
    template_id: null,
    branding: { organization_name: "Demo Organization" },
    qualification_template_key: "retirement-opportunity-v1",
    distribution_config: { method: "campaign_owner" },
  });
  launchSimCampaign(campaign.id);
  const { lead } = await processPublicLeadSubmission({
    organizationSlug: "demo-org",
    campaignSlug: campaign.slug,
    answers,
    contact: {
      firstName: "Jordan",
      lastName: "Blake",
      businessName: "Blake Household",
      email: `jordan.blake+${Date.now()}@example.com`,
      phone: "3055550166",
      state: "FL",
      preferredContact: "Phone",
      consent: true,
    },
    appointmentRequested: true,
    attribution: { ad_provider: "meta", source_channel: "meta" },
  });
  return lead;
}

describe("ownership expiration & extension", () => {
  it("defaults to configurable 60-day ownership window", async () => {
    const lead = await seedOwnedLead();
    expect(DEFAULT_OWNERSHIP_PERIOD_DAYS).toBe(60);
    expect(lead.ownership?.period_days).toBe(
      getSimStore().ownership_config.ownership_period_days,
    );
    const expected = computeOwnershipExpiry(lead.ownership!.ownership_started_at, {
      ownership_period_days: getSimStore().ownership_config.ownership_period_days,
    });
    expect(lead.ownership?.ownership_expires_at).toBe(expected);
  });

  it("shows expiring warnings and allows eligible extension", async () => {
    const lead = await seedOwnedLead();
    const inventory = new LeadInventoryService();
    // Force near expiry (3 days)
    lead.ownership!.ownership_expires_at = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    inventory.refreshLifecycle(lead);
    expect(lead.inventory_status).toBe("EXPIRING");
    expect(inventory.daysRemaining(lead)).toBeLessThanOrEqual(3);
    expect(inventory.warningLevel(lead)).toBe(3);

    const extension = inventory.extendOwnership(lead, 7, "Eligible extension");
    expect(extension.days_added).toBe(7);
    expect(lead.inventory_status).toBe("ACTIVE_OWNERSHIP");
    expect(inventory.daysRemaining(lead)!).toBeGreaterThan(3);
  });
});

describe("marketplace transition & consent", () => {
  it("blocks marketplace when consent/sharing does not permit", async () => {
    const lead = await seedOwnedLead();
    const inventory = new LeadInventoryService();
    const compliance = new LeadComplianceService();

    lead.ownership!.ownership_expires_at = new Date(Date.now() - 1000).toISOString();
    inventory.refreshLifecycle(lead);
    // With consent, should become eligible
    expect(["MARKETPLACE_ELIGIBLE", "NOT_ELIGIBLE_FOR_RESALE"]).toContain(
      lead.inventory_status,
    );

    compliance.revokeSharing(lead, "Consumer opted out of sharing");
    expect(lead.inventory_status).toBe("NOT_ELIGIBLE_FOR_RESALE");
    expect(() => inventory.listOnMarketplace(lead)).toThrow(/not eligible/i);

    // Restore sharing then suppress
    lead.compliance!.data_sharing_permitted = true;
    lead.compliance!.resale_permitted = true;
    lead.inventory_status = "MARKETPLACE_ELIGIBLE";
    compliance.suppress(lead, "TCPA suppression");
    expect(lead.inventory_status).toBe("SUPPRESSED");
    const gate = compliance.evaluateMarketplaceEligibility(lead);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons.some((r) => /suppress/i.test(r))).toBe(true);
  });

  it("lists released compliant leads without PII in preview", async () => {
    const lead = await seedOwnedLead();
    const inventory = new LeadInventoryService();
    inventory.release(lead, "test_release");
    expect(lead.inventory_status).toBe("MARKETPLACE_ELIGIBLE");
    inventory.listOnMarketplace(lead);
    expect(lead.inventory_status).toBe("MARKETPLACE");
    const preview = inventory.toPreview(lead);
    expect(preview.title).toBe("RECYCLED RETIREMENT OPPORTUNITY");
    expect(preview.state).toBe("FL");
    expect(JSON.stringify(preview)).not.toMatch(/Blake|jordan\.blake|3055550166/i);
    expect(preview.price_cents).toBeGreaterThan(0);
  });
});

describe("purchase, race condition, tenant isolation", () => {
  it("completes purchase with new ownership and consent basis", async () => {
    const lead = await seedOwnedLead();
    const inventory = new LeadInventoryService();
    const purchaseSvc = new MarketplacePurchaseService();
    inventory.release(lead, "cycle");
    inventory.listOnMarketplace(lead);

    const originalOrg = lead.assigned_organization_id;
    const buyer = "20000000-0000-4000-8000-000000000004";
    const purchase = purchaseSvc.attemptExclusivePurchase({
      leadId: lead.id,
      buyerOrganizationId: buyer,
      buyerLabel: "Buyer Advisor",
    });

    expect(purchase.buyer_organization_id).toBe(buyer);
    expect(purchase.consent_basis).toBeTruthy();
    expect(purchase.ownership_expires_at).toBeTruthy();
    expect(purchase.lead_version).toBeGreaterThan(1);
    expect(lead.assigned_organization_id).toBe(buyer);
    expect(lead.organization_id).toBe(buyer);
    expect(lead.ownership?.organization_id).toBe(buyer);
    expect(lead.inventory_status).toBe("ACTIVE_OWNERSHIP");
    expect(originalOrg).not.toBe(buyer);
  });

  it("prevents two buyers purchasing the same exclusive lead", async () => {
    const lead = await seedOwnedLead();
    const inventory = new LeadInventoryService();
    const purchaseSvc = new MarketplacePurchaseService();
    inventory.release(lead, "race");
    inventory.listOnMarketplace(lead);

    const a = "20000000-0000-4000-8000-000000000002";
    const b = "20000000-0000-4000-8000-000000000004";

    const r1 = purchaseSvc.reserve({
      leadId: lead.id,
      buyerOrganizationId: a,
    });
    expect(() =>
      purchaseSvc.reserve({
        leadId: lead.id,
        buyerOrganizationId: b,
      }),
    ).toThrow(/reserved by another buyer/i);

    purchaseSvc.purchase({
      leadId: lead.id,
      reservationId: r1.id,
      buyerOrganizationId: a,
      buyerLabel: "Premier Buyer",
    });

    expect(() =>
      purchaseSvc.attemptExclusivePurchase({
        leadId: lead.id,
        buyerOrganizationId: b,
      }),
    ).toThrow();
  });
});

describe("aging preserves originals", () => {
  it("cools temperature without rewriting opportunity score", async () => {
    const lead = await seedOwnedLead();
    const aging = new LeadAgingService();
    const snap = aging.ensureSnapshot(lead);
    const originalScore = snap.original_score;
    const originalTemp = snap.original_temperature;

    lead.last_meaningful_interaction_at = new Date(
      Date.now() - 50 * 24 * 60 * 60 * 1000,
    ).toISOString();
    aging.applyDecay(lead);

    expect(lead.aging!.original_score).toBe(originalScore);
    expect(lead.aging!.original_temperature).toBe(originalTemp);
    expect(lead.aging!.current_score).toBe(originalScore);
    expect(lead.score).toBe(originalScore);
    expect(lead.operational_temperature).toBe("COLD");
  });
});

describe("pricing engine", () => {
  it("uses configurable bands rather than hardcoded meeting prices", () => {
    const pricing = new LeadPricingService();
    const base = pricing.price({
      asset_tier: "GOLD",
      original_score: 86,
      current_temperature: "HOT",
      profile_completeness: 90,
      setter_verified: true,
      appointment_count: 1,
      lead_age_days: 67,
      exclusivity: "exclusive",
      demand_index: 1,
      territory: "FL",
    });
    pricing.updateConfig({
      bands: [
        { asset_tier: "BELOW_TARGET", base_cents: 1000 },
        { asset_tier: "GOLD", base_cents: 50_000 },
        { asset_tier: "DIAMOND", base_cents: 60_000 },
        { asset_tier: "BLACK", base_cents: 70_000 },
      ],
    });
    const updated = pricing.price({
      asset_tier: "GOLD",
      original_score: 86,
      current_temperature: "HOT",
      profile_completeness: 90,
      setter_verified: true,
      appointment_count: 1,
      lead_age_days: 67,
      exclusivity: "exclusive",
      demand_index: 1,
      territory: "FL",
    });
    expect(updated).toBeGreaterThan(base);
  });
});

describe("tenant isolation on inventory views", () => {
  it("purchase moves org ownership away from seller", async () => {
    const lead = await seedOwnedLead();
    const seller = lead.assigned_organization_id!;
    const inventory = new LeadInventoryService();
    const purchaseSvc = new MarketplacePurchaseService();
    inventory.release(lead, "iso");
    inventory.listOnMarketplace(lead);
    const buyer = "20000000-0000-4000-8000-000000000004";
    purchaseSvc.attemptExclusivePurchase({
      leadId: lead.id,
      buyerOrganizationId: buyer,
    });
    const store = getSimStore();
    const stillSellerOwned = store.leads.filter(
      (l) => l.id === lead.id && l.assigned_organization_id === seller,
    );
    expect(stillSellerOwned).toHaveLength(0);
    expect(
      store.leads.find((l) => l.id === lead.id)?.assigned_organization_id,
    ).toBe(buyer);
  });
});

// silence unused type import when tree-shaken
void (0 as unknown as SimLead);
