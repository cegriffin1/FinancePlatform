import type {
  CampaignDraftInput,
  CampaignTemplateRecord,
  GrowthCampaign,
} from "@/domain/types/campaign-engine";

export const CAMPAIGN_TEMPLATES: CampaignTemplateRecord[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    organization_id: null,
    module_key: "advanced_markets",
    key: "business_owner_growth",
    name: "Business Owner Growth",
    strategy: "Business Growth",
    goal: "generate_leads",
    description:
      "Attract business owners exploring ways to strengthen value, cash flow, and growth.",
    default_destination: "interactive_assessment",
    default_channels: ["meta", "linkedin"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    organization_id: null,
    module_key: "advanced_markets",
    key: "tax_strategy",
    name: "Tax Strategy",
    strategy: "Tax Strategy",
    goal: "generate_leads",
    description:
      "Educational campaign for owners interested in tax-aware planning conversations.",
    default_destination: "interactive_assessment",
    default_channels: ["meta", "google"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    organization_id: null,
    module_key: "advanced_markets",
    key: "succession_planning",
    name: "Succession Planning",
    strategy: "Succession",
    goal: "book_appointments",
    description: "Reach owners preparing for transition, succession, or exit.",
    default_destination: "appointment_page",
    default_channels: ["linkedin", "email"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    organization_id: null,
    module_key: "advanced_markets",
    key: "key_employee_retention",
    name: "Key Employee Retention",
    strategy: "Key Employee Strategy",
    goal: "promote_strategy",
    description: "Engage leaders focused on attracting and retaining key people.",
    default_destination: "interactive_assessment",
    default_channels: ["linkedin", "meta"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    organization_id: null,
    module_key: "advanced_markets",
    key: "executive_benefits",
    name: "Executive Benefits",
    strategy: "Executive Benefits",
    goal: "generate_leads",
    description: "Campaigns for executive benefit and retention conversations.",
    default_destination: "landing_page",
    default_channels: ["linkedin"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    organization_id: null,
    module_key: "advanced_markets",
    key: "business_continuity",
    name: "Business Continuity",
    strategy: "Protection",
    goal: "generate_leads",
    description: "Protection and continuity themes for ownership risk awareness.",
    default_destination: "interactive_assessment",
    default_channels: ["meta", "email"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    organization_id: null,
    module_key: "advanced_markets",
    key: "retirement_strategy",
    name: "Retirement Strategy",
    strategy: "Retirement",
    goal: "download_resource",
    description: "Resource-led retirement and long-range planning education.",
    default_destination: "resource_download",
    default_channels: ["email", "meta"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    organization_id: null,
    module_key: "advanced_markets",
    key: "premium_financing",
    name: "Premium Financing",
    strategy: "Premium Financing",
    goal: "book_appointments",
    description: "Appointment-focused premium financing education campaigns.",
    default_destination: "appointment_page",
    default_channels: ["linkedin", "google"],
    qualification_template_key: "advanced_markets.stage1.engagement",
    metadata: {},
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    created_by: null,
    updated_by: null,
  },
];

/** In-memory campaign store for Phase 1 UI — replace with repository later. */
const drafts: GrowthCampaign[] = [];

export function listCampaignTemplates() {
  return CAMPAIGN_TEMPLATES;
}

export function getCampaignTemplate(id: string) {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function listDraftCampaigns() {
  return [...drafts];
}

export function createCampaignFromDraft(input: CampaignDraftInput): GrowthCampaign {
  const now = new Date().toISOString();
  const campaign: GrowthCampaign = {
    id: crypto.randomUUID(),
    ...input,
    currency: "USD",
    status: "draft",
    launched_at: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
  };
  drafts.unshift(campaign);
  return campaign;
}

export function launchCampaign(id: string): GrowthCampaign | null {
  const campaign = drafts.find((c) => c.id === id);
  if (!campaign) return null;
  campaign.status = "active";
  campaign.launched_at = new Date().toISOString();
  campaign.updated_at = campaign.launched_at;
  return campaign;
}
