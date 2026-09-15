/** Setter verification, appointment handoff, and agent introduction. */

import type { UUID } from "@/domain/types/base";
import type { AssetVerificationStatus } from "@/domain/types/retirement-qualification";

/** Per-field verification — never mutates original assessment answers. */
export const FIELD_VERIFICATION_STATUSES = [
  "SELF_REPORTED",
  "CONFIRMED",
  "UPDATED",
  "UNABLE_TO_VERIFY",
] as const;
export type FieldVerificationStatus = (typeof FIELD_VERIFICATION_STATUSES)[number];

export const SETTER_VERIFICATION_FIELDS = [
  "identity",
  "state",
  "contact",
  "repositionable_assets",
  "asset_location",
  "primary_objective",
  "decision_timeline",
  "appointment_interest",
] as const;
export type SetterVerificationFieldKey = (typeof SETTER_VERIFICATION_FIELDS)[number];

export const SETTER_DISPOSITIONS = [
  "VERIFIED",
  "APPOINTMENT_SET",
  "CALLBACK",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "NOT_INTERESTED",
  "ASSET_THRESHOLD_NOT_MET",
  "DUPLICATE",
  "NURTURE",
  "DISQUALIFIED",
] as const;
export type SetterDisposition = (typeof SETTER_DISPOSITIONS)[number];

/** Dispositions that require a reason note. */
export const DISPOSITIONS_REQUIRING_REASON: SetterDisposition[] = [
  "CALLBACK",
  "WRONG_NUMBER",
  "NOT_INTERESTED",
  "ASSET_THRESHOLD_NOT_MET",
  "DUPLICATE",
  "DISQUALIFIED",
  "NURTURE",
];

export type SetterFieldVerification = {
  field: SetterVerificationFieldKey;
  status: FieldVerificationStatus;
  /** Corrected value when status is UPDATED — stored separately from assessment. */
  updated_value: string | null;
  note: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

export type SetterVerificationRecord = {
  lead_id: UUID;
  fields: SetterFieldVerification[];
  asset_verification_status: AssetVerificationStatus;
  disposition: SetterDisposition | null;
  disposition_reason: string | null;
  call_attempted_at: string | null;
  opened_at: string | null;
  verified_at: string | null;
  setter_user_id: string | null;
  notes: string | null;
  updated_at: string;
};

export type LeadAppointment = {
  id: UUID;
  lead_id: UUID;
  organization_id: UUID;
  agent_id: UUID;
  agent_name: string;
  scheduled_at: string;
  preferred_contact_method: string;
  notes: string | null;
  status: "scheduled" | "confirmed" | "cancelled" | "completed";
  created_by: string | null;
  created_at: string;
};

export type AgentIntroductionProfile = {
  id: UUID;
  organization_id: UUID;
  agent_id: UUID;
  agent_name: string;
  title: string;
  experience_summary: string;
  specialties: string[];
  states_licenses: string[];
  organization_name: string;
  /** Approved introduction script only — no generated credentials. */
  approved_introduction_script: string;
  active: boolean;
};

export type EligibleAgent = {
  id: UUID;
  organization_id: UUID;
  name: string;
  title: string;
  states: string[];
  strategies: string[];
  active: boolean;
};

export type NotificationChannelKind =
  | "in_app"
  | "email"
  | "sms"
  | "d365"
  | "teams"
  | "contact_center";

export type OutboundNotificationPayload = {
  organization_id: UUID;
  lead_id: UUID;
  recipient_agent_id?: UUID | null;
  title: string;
  body: string;
  kind: "verified_opportunity" | "appointment" | "setter_alert" | "general";
  metadata?: Record<string, unknown>;
};

export interface NotificationChannel {
  readonly channel: NotificationChannelKind;
  send(payload: OutboundNotificationPayload): Promise<{ delivered: boolean; deferred?: boolean }>;
}

export const SETTER_ACTIVITY_EVENTS = [
  "lead_submitted",
  "lead_scored",
  "setter_opened",
  "call_attempted",
  "assets_confirmed",
  "appointment_created",
  "agent_assigned",
  "agent_notified",
  "setter_disposition",
  "field_verified",
] as const;
