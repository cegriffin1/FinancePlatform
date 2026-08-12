/**
 * Navigation destinations for the authenticated shell.
 * Routes are placeholders until feature depth lands.
 */
export const APP_NAV = [
  { href: "/app", label: "Home", permission: null },
  { href: "/app/campaigns", label: "Campaigns", permission: "campaigns.view" },
  { href: "/app/leads", label: "Leads", permission: "leads.view_own" },
  { href: "/app/pipeline", label: "Pipeline", permission: "pipeline.view" },
  { href: "/app/tasks", label: "Tasks", permission: null },
  { href: "/app/calendar", label: "Calendar", permission: null },
  { href: "/app/team", label: "Team", permission: "teams.view" },
  { href: "/app/reports", label: "Reports", permission: "reports.view_own" },
  { href: "/app/settings", label: "Settings", permission: "organization.view" },
] as const;

export type AppNavItem = (typeof APP_NAV)[number];
