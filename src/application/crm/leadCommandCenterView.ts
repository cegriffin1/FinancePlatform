/**
 * Pure, browser-safe helpers for Lead Command Center rendering/filtering.
 * Keeps optional durable fields from throwing on missing columns.
 */

import type { OperationalTemperature } from "@/domain/types/lead-lifecycle";

export type LeadCommandCenterLead = {
  temperature_key?: string | null;
  operational_temperature?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  assessment_answers?: Record<string, unknown> | null;
  attribution?: Record<string, unknown> | null;
  created_at?: string | null;
};

export function operationalTemperatureOf(
  lead: LeadCommandCenterLead,
): OperationalTemperature {
  const op = lead.operational_temperature;
  if (op === "HOT" || op === "MEDIUM" || op === "COLD") return op;
  const key = lead.temperature_key;
  if (key === "COLD") return "COLD";
  if (key === "WARM" || key === "MEDIUM") return "MEDIUM";
  // HOT / VERY_HOT / READY_NOW / PRIORITY / unknown → HOT for sales ops
  return "HOT";
}

export function leadDisplayInitial(lead: LeadCommandCenterLead): string {
  const last = (lead.last_name ?? "").trim();
  return last ? last.charAt(0).toUpperCase() : "";
}

export function leadMatchesQuery(
  lead: LeadCommandCenterLead,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    lead.first_name,
    lead.last_name,
    lead.email,
    lead.phone,
    lead.business_name,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
  return haystack.includes(q);
}

export function leadAnswer(
  lead: LeadCommandCenterLead,
  key: string,
): string | null {
  const answers = lead.assessment_answers;
  if (!answers || typeof answers !== "object") return null;
  const value = answers[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function leadSourceLabel(lead: LeadCommandCenterLead): string {
  const attr = lead.attribution;
  if (!attr || typeof attr !== "object") return "—";
  const provider = attr.ad_provider ?? attr.source;
  if (provider == null) return "—";
  const text = String(provider).trim();
  return text || "—";
}
