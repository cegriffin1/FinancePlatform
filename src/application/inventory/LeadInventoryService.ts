import {
  DEFAULT_INVENTORY_CONFIG,
  DEFAULT_PRICING_CONFIG,
  type ComplianceGateResult,
  type InventoryConfig,
  type InventoryExtension,
  type InventoryLifecycleStatus,
  type LeadComplianceProfile,
  type LeadPricingConfig,
  type LeadPurchaseRecord,
  type LeadReservation,
  type MarketplaceListingPreview,
  type PricingInputs,
  type ScoreAgingSnapshot,
  defaultCompliance,
} from "@/domain/types/lead-inventory";
import { computeOwnershipExpiry } from "@/domain/types/retirement-crm";
import type { SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { LeadOwnershipService } from "@/application/crm/RetirementCrmService";
import { randomUUID } from "crypto";

function nowIso() {
  return new Date().toISOString();
}

function daysBetween(fromIso: string, to = Date.now()) {
  return Math.floor((to - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000));
}

function appendEvent(lead: SimLead, type: string, payload: Record<string, unknown> = {}) {
  const store = getSimStore();
  store.events.push({
    id: randomUUID(),
    organization_id:
      lead.assigned_organization_id ??
      lead.organization_id ??
      store.organizations[0]!.id,
    lead_id: lead.id,
    event_type: type,
    occurred_at: nowIso(),
    actor_profile_id: null,
    payload,
    created_at: nowIso(),
  });
}

export class LeadComplianceService {
  ensure(lead: SimLead): LeadComplianceProfile {
    if (!lead.compliance) {
      lead.compliance = defaultCompliance({
        consent: lead.consent,
        state: lead.state,
        capturedAt: lead.created_at,
      });
    }
    return lead.compliance;
  }

  suppress(lead: SimLead, reason: string) {
    const c = this.ensure(lead);
    c.suppressed = true;
    c.suppression_reason = reason;
    c.resale_permitted = false;
    lead.inventory_status = "SUPPRESSED";
    appendEvent(lead, "lead_suppressed", { reason });
    lead.updated_at = nowIso();
    return c;
  }

  revokeSharing(lead: SimLead, note?: string) {
    const c = this.ensure(lead);
    c.data_sharing_permitted = false;
    c.resale_permitted = false;
    c.sharing_permissions_note = note ?? "Sharing permission revoked";
    if (lead.inventory_status === "MARKETPLACE" || lead.inventory_status === "MARKETPLACE_ELIGIBLE") {
      lead.inventory_status = "NOT_ELIGIBLE_FOR_RESALE";
      lead.marketplace_listed = false;
    }
    appendEvent(lead, "sharing_permission_revoked", { note: note ?? null });
    lead.updated_at = nowIso();
    return c;
  }

  /**
   * Never make a lead purchasable when consent/permissions do not permit it.
   */
  evaluateMarketplaceEligibility(lead: SimLead): ComplianceGateResult {
    const c = this.ensure(lead);
    const reasons: string[] = [];
    if (!c.contact_consent) reasons.push("Missing contact consent");
    if (!c.data_sharing_permitted) reasons.push("Data sharing not permitted");
    if (!c.resale_permitted) reasons.push("Resale not permitted");
    if (c.suppressed) reasons.push(`Suppressed: ${c.suppression_reason ?? "policy"}`);
    if (c.restricted_jurisdictions.includes(c.jurisdiction)) {
      reasons.push(`Jurisdiction ${c.jurisdiction} restricts resale`);
    }
    if (!c.consent_basis || c.consent_basis === "none") {
      reasons.push("No valid consent basis on file");
    }
    const ageDays = daysBetween(lead.created_at);
    if (ageDays > c.retention_policy_days) {
      reasons.push("Beyond retention policy");
    }
    return { eligible: reasons.length === 0, reasons };
  }
}

export class LeadAgingService {
  ensureSnapshot(lead: SimLead): ScoreAgingSnapshot {
    if (!lead.aging) {
      lead.aging = {
        original_score: lead.score,
        current_score: lead.score,
        original_temperature: lead.temperature_key,
        current_temperature: lead.temperature_key,
        last_decayed_at: null,
      };
    }
    return lead.aging;
  }

  /**
   * Temperature/score may decay with time. Opportunity profile/history is NOT rewritten.
   * original_* values are immutable once set.
   */
  applyDecay(lead: SimLead, now = Date.now()) {
    const snap = this.ensureSnapshot(lead);
    const ageDays = daysBetween(lead.ownership?.ownership_started_at ?? lead.created_at, now);
    // Preserve originals
    const originalScore = snap.original_score;
    const originalTemp = snap.original_temperature;

    const decay = Math.min(35, Math.floor(ageDays / 7) * 3);
    const currentScore = Math.max(20, originalScore - decay);
    let currentTemp = originalTemp;
    if (ageDays >= 45) currentTemp = "COLD";
    else if (ageDays >= 30) currentTemp = "WARM";
    else if (ageDays >= 14 && ["READY_NOW", "VERY_HOT"].includes(originalTemp)) {
      currentTemp = "HOT";
    }

    snap.current_score = currentScore;
    snap.current_temperature = currentTemp;
    snap.last_decayed_at = nowIso();
    // Do not rewrite original score/temperature or qualification history
    lead.score = currentScore;
    lead.temperature_key = currentTemp;
    lead.updated_at = nowIso();
    return snap;
  }
}

export class LeadPricingService {
  config(): LeadPricingConfig {
    return getSimStore().pricing_config ?? DEFAULT_PRICING_CONFIG;
  }

  updateConfig( partial: Partial<LeadPricingConfig>) {
    const store = getSimStore();
    store.pricing_config = { ...this.config(), ...partial };
    return store.pricing_config;
  }

  price(inputs: PricingInputs, config = this.config()): number {
    const band =
      config.bands.find((b) => b.asset_tier === inputs.asset_tier) ??
      config.bands.find((b) => b.asset_tier === "GOLD")!;
    let cents = band.base_cents;
    cents *= 1 + inputs.original_score * config.score_multiplier_per_point;
    cents *=
      config.temperature_multipliers[inputs.current_temperature] ??
      config.temperature_multipliers.WARM ??
      1;
    if (inputs.profile_completeness >= 80) cents += config.completeness_bonus_cents;
    if (inputs.setter_verified) cents += config.setter_verified_bonus_cents;
    if (inputs.appointment_count > 0) cents += config.appointment_bonus_cents;
    const agePenalty =
      1 - Math.min(0.5, (inputs.lead_age_days * config.age_decay_per_day_bps) / 10000);
    cents *= agePenalty;
    if (inputs.exclusivity === "exclusive") cents *= config.exclusivity_multiplier;
    cents *= config.demand_multiplier * (inputs.demand_index || 1);
    cents *=
      config.territory_multipliers[inputs.territory] ??
      config.territory_multipliers.default ??
      1;
    cents = Math.round(cents / 100) * 100;
    return Math.max(config.min_cents, Math.min(config.max_cents, cents));
  }

  priceLead(lead: SimLead): number {
    const aging = new LeadAgingService().ensureSnapshot(lead);
    return this.price({
      asset_tier: lead.qualification?.asset.commercial_tier ?? "BELOW_TARGET",
      original_score: aging.original_score,
      current_temperature: aging.current_temperature,
      profile_completeness:
        lead.qualification?.completeness.profile_completion_percentage ?? 50,
      setter_verified:
        lead.qualification?.asset.verification_status === "SETTER_CONFIRMED" ||
        lead.setter_verification?.asset_verification_status === "SETTER_CONFIRMED",
      appointment_count: lead.appointments?.length ?? 0,
      lead_age_days: daysBetween(lead.created_at),
      exclusivity: "exclusive",
      demand_index: 1,
      territory: lead.state,
    });
  }
}

export class LeadInventoryService {
  private readonly compliance = new LeadComplianceService();
  private readonly aging = new LeadAgingService();
  private readonly pricing = new LeadPricingService();
  private readonly ownership = new LeadOwnershipService();

  config(): InventoryConfig {
    return getSimStore().inventory_config ?? DEFAULT_INVENTORY_CONFIG;
  }

  initializeOnCreate(lead: SimLead) {
    this.compliance.ensure(lead);
    this.aging.ensureSnapshot(lead);
    lead.inventory_status = lead.qualification ? "QUALIFIED" : "NEW";
    lead.lead_version = lead.lead_version ?? 1;
    lead.marketplace_listed = false;
  }

  markPurchasedAssigned(lead: SimLead) {
    lead.inventory_status = "PURCHASED_ASSIGNED";
    lead.inventory_status = "ACTIVE_OWNERSHIP";
    this.aging.ensureSnapshot(lead);
    appendEvent(lead, "inventory_active_ownership", {});
  }

  daysRemaining(lead: SimLead, now = Date.now()): number | null {
    if (!lead.ownership?.ownership_expires_at) return null;
    const ms = new Date(lead.ownership.ownership_expires_at).getTime() - now;
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

  warningLevel(lead: SimLead, now = Date.now()): number | null {
    const days = this.daysRemaining(lead, now);
    if (days == null) return null;
    const warnings = this.config().expiry_warning_days;
    for (const w of [...warnings].sort((a, b) => a - b)) {
      if (days <= w) return w;
    }
    return null;
  }

  refreshLifecycle(lead: SimLead, now = Date.now()) {
    this.aging.applyDecay(lead, now);
    const compliance = this.compliance.ensure(lead);
    if (compliance.suppressed) {
      lead.inventory_status = "SUPPRESSED";
      lead.marketplace_listed = false;
      return lead;
    }

    const days = this.daysRemaining(lead, now);
    if (lead.ownership && days != null) {
      if (days <= 0) {
        this.release(lead, "ownership_expired");
      } else if (days <= Math.max(...this.config().expiry_warning_days)) {
        if (
          lead.inventory_status === "ACTIVE_OWNERSHIP" ||
          lead.inventory_status === "PURCHASED_ASSIGNED"
        ) {
          lead.inventory_status = "EXPIRING";
          appendEvent(lead, "inventory_expiring", {
            days_remaining: days,
            warning: this.warningLevel(lead, now),
          });
        }
      } else if (
        lead.inventory_status === "PURCHASED_ASSIGNED" ||
        !lead.inventory_status
      ) {
        lead.inventory_status = "ACTIVE_OWNERSHIP";
      }
    }
    return lead;
  }

  extendOwnership(
    lead: SimLead,
    daysAdded: number,
    reason: string,
    grantedBy?: string | null,
  ): InventoryExtension {
    if (!lead.ownership) throw new Error("Lead has no active ownership");
    const cfg = this.config();
    if (daysAdded <= 0 || daysAdded > cfg.max_extension_days) {
      throw new Error(`Extension must be 1–${cfg.max_extension_days} days`);
    }
    // Business rule: no extension if suppressed / sharing revoked
    const gate = this.compliance.evaluateMarketplaceEligibility(lead);
    if (lead.compliance?.suppressed) {
      throw new Error("Cannot extend suppressed lead");
    }
    void gate;

    const previous = lead.ownership.ownership_expires_at;
    const base = Math.max(Date.now(), new Date(previous).getTime());
    const next = new Date(base + daysAdded * 24 * 60 * 60 * 1000).toISOString();
    lead.ownership = {
      ...lead.ownership,
      ownership_expires_at: next,
      period_days: lead.ownership.period_days + daysAdded,
    };
    lead.inventory_status = "ACTIVE_OWNERSHIP";
    const extension: InventoryExtension = {
      id: randomUUID(),
      lead_id: lead.id,
      days_added: daysAdded,
      reason,
      granted_by: grantedBy ?? null,
      created_at: nowIso(),
      previous_expires_at: previous,
      new_expires_at: next,
    };
    lead.ownership_extensions = [...(lead.ownership_extensions ?? []), extension];
    getSimStore().ownership_extensions.push(extension);
    appendEvent(lead, "ownership_extended", extension);
    lead.updated_at = nowIso();
    return extension;
  }

  release(lead: SimLead, reason: string) {
    lead.inventory_status = "RELEASED";
    lead.marketplace_listed = false;
    appendEvent(lead, "ownership_released", { reason });

    const gate = this.compliance.evaluateMarketplaceEligibility(lead);
    if (!gate.eligible) {
      lead.inventory_status = "NOT_ELIGIBLE_FOR_RESALE";
      appendEvent(lead, "marketplace_blocked", { reasons: gate.reasons });
      lead.updated_at = nowIso();
      return lead;
    }

    lead.inventory_status = "MARKETPLACE_ELIGIBLE";
    appendEvent(lead, "marketplace_eligible", {});
    lead.updated_at = nowIso();
    return lead;
  }

  listOnMarketplace(lead: SimLead) {
    const gate = this.compliance.evaluateMarketplaceEligibility(lead);
    if (!gate.eligible) {
      lead.inventory_status = "NOT_ELIGIBLE_FOR_RESALE";
      lead.marketplace_listed = false;
      throw new Error(`Not eligible for marketplace: ${gate.reasons.join("; ")}`);
    }
    if (
      lead.inventory_status !== "MARKETPLACE_ELIGIBLE" &&
      lead.inventory_status !== "RELEASED" &&
      lead.inventory_status !== "MARKETPLACE"
    ) {
      throw new Error(`Cannot list from status ${lead.inventory_status}`);
    }
    this.aging.applyDecay(lead);
    lead.marketplace_price_cents = this.pricing.priceLead(lead);
    lead.inventory_status = "MARKETPLACE";
    lead.marketplace_listed = true;
    appendEvent(lead, "marketplace_listed", {
      price_cents: lead.marketplace_price_cents,
    });
    lead.updated_at = nowIso();
    return lead;
  }

  toPreview(lead: SimLead): MarketplaceListingPreview {
    const aging = this.aging.ensureSnapshot(lead);
    const a = lead.assessment_answers;
    return {
      lead_id: lead.id,
      lead_type: "ANNUITY_OPPORTUNITY",
      title: "ANNUITY OPPORTUNITY",
      state: lead.state,
      age_range: a.age_range ?? null,
      asset_band: a.repositionable_assets ?? null,
      asset_tier: lead.qualification?.asset.commercial_tier ?? null,
      primary_objective: a.primary_objective ?? null,
      original_opportunity_score: aging.original_score,
      current_temperature: aging.current_temperature,
      lead_age_days: daysBetween(lead.created_at),
      price_cents: lead.marketplace_price_cents ?? this.pricing.priceLead(lead),
      exclusivity: "exclusive",
      setter_verified:
        lead.qualification?.asset.verification_status === "SETTER_CONFIRMED",
    };
  }

  adminBuckets(leads: SimLead[]) {
    const refresh = leads.map((l) => {
      this.refreshLifecycle(l);
      return l;
    });
    const bucket = (status: InventoryLifecycleStatus | InventoryLifecycleStatus[]) => {
      const set = new Set(Array.isArray(status) ? status : [status]);
      return refresh.filter((l) => set.has(l.inventory_status ?? "NEW"));
    };
    return {
      active: bucket(["ACTIVE_OWNERSHIP", "PURCHASED_ASSIGNED"]),
      expiring: bucket("EXPIRING"),
      marketplace_eligible: bucket("MARKETPLACE_ELIGIBLE"),
      marketplace: bucket("MARKETPLACE"),
      sold: bucket(["SOLD", "REPURCHASED"]),
      suppressed: bucket("SUPPRESSED"),
      not_eligible: bucket("NOT_ELIGIBLE_FOR_RESALE"),
    };
  }
}

/**
 * Transactional reservation + purchase.
 * Prevents two buyers purchasing the same exclusive lead simultaneously.
 */
export class MarketplacePurchaseService {
  private readonly inventory = new LeadInventoryService();
  private readonly compliance = new LeadComplianceService();
  private readonly ownership = new LeadOwnershipService();

  reserve(input: {
    leadId: string;
    buyerOrganizationId: string;
    buyerAgentId?: string | null;
  }): LeadReservation {
    const store = getSimStore();
    // Atomic critical section on sim store
    const lead = store.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error("Lead not found");

    const gate = this.compliance.evaluateMarketplaceEligibility(lead);
    if (!gate.eligible) {
      throw new Error(`Purchase blocked: ${gate.reasons.join("; ")}`);
    }
    if (lead.inventory_status !== "MARKETPLACE" || !lead.marketplace_listed) {
      throw new Error("Lead is not listed on marketplace");
    }

    // Expire stale reservations
    const now = Date.now();
    for (const r of store.reservations) {
      if (
        r.lead_id === lead.id &&
        r.status === "active" &&
        new Date(r.expires_at).getTime() < now
      ) {
        r.status = "expired";
      }
    }

    const active = store.reservations.find(
      (r) => r.lead_id === lead.id && r.status === "active",
    );
    if (active) {
      throw new Error("Lead is reserved by another buyer");
    }

    lead.lead_version = (lead.lead_version ?? 1) + 0; // version check basis
    const ttl = this.inventory.config().reservation_ttl_seconds * 1000;
    const reservation: LeadReservation = {
      id: randomUUID(),
      lead_id: lead.id,
      buyer_organization_id: input.buyerOrganizationId,
      buyer_agent_id: input.buyerAgentId ?? null,
      reserved_at: nowIso(),
      expires_at: new Date(now + ttl).toISOString(),
      lead_version: lead.lead_version ?? 1,
      status: "active",
    };
    store.reservations.push(reservation);
    lead.active_reservation_id = reservation.id;
    appendEvent(lead, "marketplace_reserved", {
      reservation_id: reservation.id,
      buyer_organization_id: input.buyerOrganizationId,
    });
    return reservation;
  }

  purchase(input: {
    leadId: string;
    reservationId: string;
    buyerOrganizationId: string;
    buyerAgentId?: string | null;
    buyerLabel?: string | null;
  }): LeadPurchaseRecord {
    const store = getSimStore();
    const lead = store.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error("Lead not found");

    const gate = this.compliance.evaluateMarketplaceEligibility(lead);
    if (!gate.eligible) {
      throw new Error(`Purchase blocked: ${gate.reasons.join("; ")}`);
    }

    const reservation = store.reservations.find((r) => r.id === input.reservationId);
    if (!reservation || reservation.lead_id !== lead.id) {
      throw new Error("Invalid reservation");
    }
    if (reservation.status !== "active") {
      throw new Error(`Reservation is ${reservation.status}`);
    }
    if (reservation.buyer_organization_id !== input.buyerOrganizationId) {
      throw new Error("Reservation belongs to another organization");
    }
    if (new Date(reservation.expires_at).getTime() < Date.now()) {
      reservation.status = "expired";
      throw new Error("Reservation expired");
    }
    if ((lead.lead_version ?? 1) !== reservation.lead_version) {
      throw new Error("Lead version conflict — refresh and retry");
    }
    if (lead.active_reservation_id !== reservation.id) {
      throw new Error("Reservation is not the active lock on this lead");
    }

    // Consume reservation first (wins race)
    reservation.status = "consumed";
    lead.active_reservation_id = null;
    lead.marketplace_listed = false;

    const price = lead.marketplace_price_cents ?? new LeadPricingService().priceLead(lead);
    const config = this.inventory.config();
    const assignedAt = nowIso();
    const expiresAt = computeOwnershipExpiry(assignedAt, {
      ownership_period_days: config.ownership_period_days,
    });

    const sellerOrg = lead.assigned_organization_id ?? lead.organization_id;
    const purchase: LeadPurchaseRecord = {
      id: randomUUID(),
      lead_id: lead.id,
      buyer_organization_id: input.buyerOrganizationId,
      buyer_agent_id: input.buyerAgentId ?? null,
      seller_organization_id: sellerOrg,
      seller_type: sellerOrg ? "organization" : "platform",
      price_cents: price,
      currency: "USD",
      purchased_at: assignedAt,
      rights_granted: ["contact", "work", "crm_ownership"],
      ownership_expires_at: expiresAt,
      lead_version: (lead.lead_version ?? 1) + 1,
      consent_basis: lead.compliance?.consent_basis ?? "unknown",
      exclusivity: "exclusive",
      reservation_id: reservation.id,
    };

    lead.lead_version = purchase.lead_version;
    lead.inventory_status = "REPURCHASED";
    this.ownership.assign(lead, {
      organizationId: input.buyerOrganizationId,
      ownerId: input.buyerAgentId,
      ownerLabel: input.buyerLabel ?? "Marketplace Buyer",
      source: "marketplace_purchase",
      assignedAt,
      config: { ownership_period_days: config.ownership_period_days },
    });
    lead.inventory_status = "ACTIVE_OWNERSHIP";
    lead.purchase_history = [...(lead.purchase_history ?? []), purchase];
    store.purchases.push(purchase);

    // Tenant isolation: previous org no longer owner
    lead.assigned_organization_id = input.buyerOrganizationId;
    lead.organization_id = input.buyerOrganizationId;

    appendEvent(lead, "marketplace_purchased", {
      purchase_id: purchase.id,
      price_cents: price,
      buyer_organization_id: input.buyerOrganizationId,
      consent_basis: purchase.consent_basis,
    });

    // Cancel any other lingering reservations for this lead
    for (const r of store.reservations) {
      if (r.lead_id === lead.id && r.status === "active") r.status = "cancelled";
    }

    lead.updated_at = nowIso();
    return purchase;
  }

  /**
   * Concurrent exclusive purchase attempt helper for tests/race simulation.
   */
  attemptExclusivePurchase(input: {
    leadId: string;
    buyerOrganizationId: string;
    buyerAgentId?: string | null;
    buyerLabel?: string | null;
  }) {
    const reservation = this.reserve({
      leadId: input.leadId,
      buyerOrganizationId: input.buyerOrganizationId,
      buyerAgentId: input.buyerAgentId,
    });
    return this.purchase({
      leadId: input.leadId,
      reservationId: reservation.id,
      buyerOrganizationId: input.buyerOrganizationId,
      buyerAgentId: input.buyerAgentId,
      buyerLabel: input.buyerLabel,
    });
  }
}
