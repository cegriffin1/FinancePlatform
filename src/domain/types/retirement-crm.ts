/** ALTUS retirement lead CRM — MVP sales/service surface (not full D365). */

import type { UUID } from "@/domain/types/base";

/** Agent CRM pipeline board stages. */
export const CRM_PIPELINE_STAGES = [
  "NEW",
  "SETTER_REVIEW",
  "VERIFIED",
  "APPOINTMENT_SET",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
  "WON",
  "LOST",
  "NURTURE",
] as const;
export type CrmPipelineStage = (typeof CRM_PIPELINE_STAGES)[number];

/** Configurable ownership window — never hardcode days in call sites. */
export const DEFAULT_OWNERSHIP_PERIOD_DAYS = 60;

export type OwnershipConfig = {
  ownership_period_days: number;
};

export const DEFAULT_OWNERSHIP_CONFIG: OwnershipConfig = {
  ownership_period_days: DEFAULT_OWNERSHIP_PERIOD_DAYS,
};

export type LeadOwnership = {
  owner_id: string | null;
  owner_label: string | null;
  organization_id: UUID;
  assigned_at: string;
  ownership_started_at: string;
  ownership_expires_at: string;
  source: string;
  period_days: number;
};

export const CRM_FOLLOW_UP_TYPES = [
  "Task",
  "Callback",
  "Appointment",
  "Note",
] as const;
export type CrmFollowUpType = (typeof CRM_FOLLOW_UP_TYPES)[number];

export const CRM_FOLLOW_UP_STATUSES = [
  "open",
  "done",
  "cancelled",
] as const;
export type CrmFollowUpStatus = (typeof CRM_FOLLOW_UP_STATUSES)[number];

export type CrmFollowUp = {
  id: UUID;
  lead_id: UUID;
  organization_id: UUID | null;
  type: CrmFollowUpType;
  title: string;
  due_at: string | null;
  status: CrmFollowUpStatus;
  body: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CrmNote = {
  id: UUID;
  lead_id: UUID;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type CrmContactAttempt = {
  id: UUID;
  lead_id: UUID;
  channel: "call" | "email" | "sms";
  result: string | null;
  created_by: string | null;
  created_at: string;
};

/** Agent-recorded outcomes that feed campaign quality analytics. */
export const AGENT_CRM_OUTCOMES = [
  "Appointment Completed",
  "Qualified Opportunity",
  "Won",
  "Lost",
  "Unable to Reach",
  "Not Interested",
  "Wrong Fit",
  "Nurture",
] as const;
export type AgentCrmOutcome = (typeof AGENT_CRM_OUTCOMES)[number];

export const AGENT_HOME_BUCKETS = [
  "new_opportunities",
  "appointments_today",
  "ready_now",
  "needs_follow_up",
  "callbacks",
  "nurture",
  "aged_leads",
] as const;
export type AgentHomeBucket = (typeof AGENT_HOME_BUCKETS)[number];

export function computeOwnershipExpiry(
  startedAt: string,
  config: OwnershipConfig = DEFAULT_OWNERSHIP_CONFIG,
): string {
  const start = new Date(startedAt).getTime();
  const ms = config.ownership_period_days * 24 * 60 * 60 * 1000;
  return new Date(start + ms).toISOString();
}

export function isOwnershipExpired(
  ownership: LeadOwnership | null | undefined,
  now = Date.now(),
): boolean {
  if (!ownership?.ownership_expires_at) return false;
  return new Date(ownership.ownership_expires_at).getTime() < now;
}

export function followUpBucket(
  item: CrmFollowUp,
  now = Date.now(),
): "today" | "overdue" | "upcoming" | "done" {
  if (item.status !== "open") return "done";
  if (!item.due_at) return "upcoming";
  const due = new Date(item.due_at);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (due.getTime() < start.getTime()) return "overdue";
  if (due.getTime() < end.getTime()) return "today";
  return "upcoming";
}
