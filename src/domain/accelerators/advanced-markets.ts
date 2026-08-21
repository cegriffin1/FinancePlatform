export const ADVANCED_MARKETS_MODULE_KEY = "advanced_markets" as const;

export const ADVANCED_MARKETS_DESCRIPTOR = {
  key: ADVANCED_MARKETS_MODULE_KEY,
  displayName: "Advanced Markets",
  registers: {
    campaignTemplates: true,
    qualificationTemplates: true,
    scoringRulePacks: true,
    strategyCatalog: true,
    routingOverlays: true,
    entitlementOverlays: true,
    nurtureSequences: true,
  },
} as const;

/** Internal routing classifications — not consumer recommendations. */
export const ADVANCED_MARKETS_STRATEGY_CATEGORIES = [
  "Tax Strategy",
  "Business Owner Planning",
  "Executive Benefits",
  "Key Person Planning",
  "Buy-Sell Planning",
  "Estate Planning",
  "Succession Planning",
  "Retirement Strategy",
  "Premium Financing",
  "High-Value Life Planning",
  "General Protection",
] as const;
