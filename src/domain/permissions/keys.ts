/** Permission keys used for authorization. Prefer these over role-name checks. */
export const PERMISSIONS = [
  "organization.view",
  "organization.update",
  "users.view",
  "users.invite",
  "users.update",
  "users.remove",
  "teams.view",
  "teams.manage",
  "campaigns.view",
  "campaigns.create",
  "campaigns.update",
  "campaigns.publish",
  "campaigns.pause",
  "campaigns.approve",
  "campaigns.budget.view",
  "campaigns.budget.manage",
  "integrations.view",
  "integrations.manage",
  "leads.view_own",
  "leads.view_team",
  "leads.view_all",
  "leads.assign",
  "leads.update",
  "setter.leads.view",
  "setter.leads.verify",
  "setter.appointments.manage",
  "pipeline.view",
  "pipeline.manage",
  "reports.view_own",
  "reports.view_team",
  "reports.view_all",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLES = [
  "owner",
  "admin",
  "manager",
  "marketing",
  "sales",
  "employee",
  "contractor",
  "setter",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number];

/** Default permission bundles for built-in roles. Custom roles can diverge later. */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  manager: [
    "organization.view",
    "users.view",
    "teams.view",
    "teams.manage",
    "campaigns.view",
    "leads.view_team",
    "leads.assign",
    "leads.update",
    "setter.leads.view",
    "setter.leads.verify",
    "setter.appointments.manage",
    "pipeline.view",
    "reports.view_team",
  ],
  marketing: [
    "organization.view",
    "campaigns.view",
    "campaigns.create",
    "campaigns.update",
    "campaigns.publish",
    "campaigns.pause",
    "campaigns.approve",
    "campaigns.budget.view",
    "campaigns.budget.manage",
    "integrations.view",
    "integrations.manage",
    "leads.view_team",
    "reports.view_team",
  ],
  sales: [
    "organization.view",
    "leads.view_own",
    "leads.update",
    "pipeline.view",
    "reports.view_own",
  ],
  /** Quality-control setter — no platform-admin permissions. */
  setter: [
    "organization.view",
    "setter.leads.view",
    "setter.leads.verify",
    "setter.appointments.manage",
    "leads.view_team",
  ],
  employee: [
    "organization.view",
    "leads.view_own",
    "leads.update",
    "pipeline.view",
    "reports.view_own",
  ],
  contractor: [
    "organization.view",
    "leads.view_own",
    "leads.update",
    "pipeline.view",
  ],
};

export function hasPermission(
  granted: readonly PermissionKey[],
  required: PermissionKey,
): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(
  granted: readonly PermissionKey[],
  required: readonly PermissionKey[],
): boolean {
  return required.some((key) => granted.includes(key));
}

export function hasAllPermissions(
  granted: readonly PermissionKey[],
  required: readonly PermissionKey[],
): boolean {
  return required.every((key) => granted.includes(key));
}

export function unionPermissions(
  ...sets: readonly (readonly PermissionKey[])[]
): PermissionKey[] {
  return Array.from(new Set(sets.flat()));
}
