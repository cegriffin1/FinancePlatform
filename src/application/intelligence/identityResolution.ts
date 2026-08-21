import type { IdentityMatchResult } from "@/domain/types/lead-intelligence";

export type IdentityCandidate = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  campaignId?: string;
  organizationId?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function domainFromEmail(email: string) {
  const parts = email.split("@");
  return parts[1]?.toLowerCase() ?? "";
}

export type IdentityResolutionResult = {
  result: IdentityMatchResult;
  matched_lead_id: string | null;
  confidence: number;
  reasons: string[];
};

export class LeadIdentityResolutionService {
  resolve(
    incoming: IdentityCandidate,
    existing: IdentityCandidate[],
  ): IdentityResolutionResult {
    const email = normalizeEmail(incoming.email);
    const phone = normalizePhone(incoming.phone);
    const name = normalizeName(`${incoming.firstName} ${incoming.lastName}`);
    const business = normalizeName(incoming.businessName);
    const domain = domainFromEmail(email);

    for (const lead of existing) {
      const sameEmail = normalizeEmail(lead.email) === email;
      const samePhone =
        phone.length >= 10 && normalizePhone(lead.phone) === phone;
      const sameCampaign =
        Boolean(incoming.campaignId) && lead.campaignId === incoming.campaignId;

      if (sameEmail && sameCampaign) {
        return {
          result: "DUPLICATE_SUBMISSION",
          matched_lead_id: lead.id,
          confidence: 1,
          reasons: ["Same email + campaign"],
        };
      }

      if (sameEmail && samePhone) {
        return {
          result: "EXISTING_PERSON",
          matched_lead_id: lead.id,
          confidence: 0.98,
          reasons: ["Email and phone match"],
        };
      }

      if (sameEmail) {
        return {
          result: "EXISTING_PERSON",
          matched_lead_id: lead.id,
          confidence: 0.9,
          reasons: ["Email match"],
        };
      }

      if (
        samePhone &&
        normalizeName(`${lead.firstName} ${lead.lastName}`) === name
      ) {
        return {
          result: "EXISTING_PERSON",
          matched_lead_id: lead.id,
          confidence: 0.88,
          reasons: ["Phone + name match"],
        };
      }

      const sameBusiness = normalizeName(lead.businessName) === business;
      const sameDomain =
        domain && domainFromEmail(lead.email) === domain && !/(gmail|yahoo|hotmail|outlook)/.test(domain);
      if (sameBusiness && sameDomain && name.split(" ")[0] === normalizeName(lead.firstName)) {
        return {
          result: "POSSIBLE_MATCH",
          matched_lead_id: lead.id,
          confidence: 0.6,
          reasons: ["Business + domain + first name"],
        };
      }
    }

    return {
      result: "NEW_PERSON",
      matched_lead_id: null,
      confidence: 1,
      reasons: ["No deterministic match"],
    };
  }
}
