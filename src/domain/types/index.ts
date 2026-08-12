export type UUID = string;

export type AuditFields = {
  created_at: string;
  updated_at: string;
  created_by: UUID | null;
  updated_by: UUID | null;
};

export type Organization = AuditFields & {
  id: UUID;
  name: string;
  slug: string;
  status: "active" | "inactive" | "suspended";
};

export type OrganizationSettings = AuditFields & {
  id: UUID;
  organization_id: UUID;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  timezone: string;
  locale: string;
};

export type Profile = {
  id: UUID;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = AuditFields & {
  id: UUID;
  organization_id: UUID;
  profile_id: UUID;
  status: "active" | "invited" | "inactive";
  title: string | null;
  location_id: UUID | null;
  department_id: UUID | null;
  team_id: UUID | null;
};

export type Location = AuditFields & {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string | null;
  status: "active" | "inactive";
};

export type Department = AuditFields & {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string | null;
  status: "active" | "inactive";
};

export type Team = AuditFields & {
  id: UUID;
  organization_id: UUID;
  name: string;
  department_id: UUID | null;
  location_id: UUID | null;
  status: "active" | "inactive";
};

export type ReportingRelationship = AuditFields & {
  id: UUID;
  organization_id: UUID;
  manager_member_id: UUID;
  report_member_id: UUID;
};

export type Role = AuditFields & {
  id: UUID;
  organization_id: UUID | null;
  key: string;
  name: string;
  is_system: boolean;
};

export type Permission = {
  id: UUID;
  key: string;
  description: string | null;
};

export type Invitation = AuditFields & {
  id: UUID;
  organization_id: UUID;
  email: string;
  role_keys: string[];
  token_hash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  invited_by: UUID | null;
};

export type Campaign = AuditFields & {
  id: UUID;
  organization_id: UUID;
  name: string;
  status: "draft" | "published" | "paused" | "archived";
  description: string | null;
};

export type Lead = AuditFields & {
  id: UUID;
  organization_id: UUID;
  campaign_id: UUID | null;
  contact_id: UUID | null;
  assigned_to: UUID | null;
  team_id: UUID | null;
  status: "new" | "qualified" | "working" | "converted" | "disqualified";
  score: number | null;
  source: string | null;
};

export type Contact = AuditFields & {
  id: UUID;
  organization_id: UUID;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
};

export type Opportunity = AuditFields & {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID | null;
  contact_id: UUID | null;
  pipeline_id: UUID;
  stage_id: UUID;
  name: string;
  amount: number | null;
  assigned_to: UUID | null;
  status: "open" | "won" | "lost";
};

export type Activity = AuditFields & {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID | null;
  opportunity_id: UUID | null;
  contact_id: UUID | null;
  type: "note" | "call" | "email" | "system";
  body: string;
};

export type Task = AuditFields & {
  id: UUID;
  organization_id: UUID;
  title: string;
  description: string | null;
  status: "open" | "done" | "cancelled";
  due_at: string | null;
  assigned_to: UUID | null;
  lead_id: UUID | null;
  opportunity_id: UUID | null;
};

export type Appointment = AuditFields & {
  id: UUID;
  organization_id: UUID;
  title: string;
  starts_at: string;
  ends_at: string;
  assigned_to: UUID | null;
  lead_id: UUID | null;
};

export type Pipeline = AuditFields & {
  id: UUID;
  organization_id: UUID;
  name: string;
  is_default: boolean;
};

export type PipelineStage = AuditFields & {
  id: UUID;
  organization_id: UUID;
  pipeline_id: UUID;
  name: string;
  position: number;
  probability: number | null;
};
