export type AssessmentQuestion = {
  key: string;
  prompt: string;
  options: string[];
};

export const BUSINESS_GROWTH_ASSESSMENT_V1 = {
  key: "business-growth-assessment-v1",
  version: "v1",
  title: "Business Growth Assessment",
  estimatedMinutes: 2,
  questions: [
    {
      key: "business_stage",
      prompt: "Which best describes your business today?",
      options: [
        "Getting established",
        "Growing steadily",
        "Expanding quickly",
        "Established and optimizing",
        "Preparing for succession or transition",
      ],
    },
    {
      key: "financial_priority",
      prompt: "What is your biggest financial priority right now?",
      options: [
        "Reduce tax exposure",
        "Grow business value",
        "Retain key employees",
        "Protect the business",
        "Prepare for succession",
        "Improve retirement planning",
        "Improve cash flow",
      ],
    },
    {
      key: "team_size",
      prompt: "How large is your team?",
      options: ["Just me", "2–10", "11–25", "26–50", "51–100", "100+"],
    },
    {
      key: "revenue_range",
      prompt: "Which range best reflects your approximate annual business revenue?",
      options: [
        "Under $250K",
        "$250K–$500K",
        "$500K–$1M",
        "$1M–$5M",
        "$5M–$10M",
        "$10M+",
        "Prefer not to say",
      ],
    },
    {
      key: "timeline",
      prompt: "How soon would you like to address this?",
      options: [
        "Immediately",
        "Within 30 days",
        "Within 3 months",
        "Within 6 months",
        "Exploring options",
      ],
    },
  ] satisfies AssessmentQuestion[],
};

export const PRIORITY_TO_STRATEGY: Record<string, string[]> = {
  "Reduce tax exposure": ["Tax Strategy"],
  "Grow business value": ["Business Growth"],
  "Retain key employees": ["Key Employee Strategy", "Executive Benefits"],
  "Protect the business": ["Protection"],
  "Prepare for succession": ["Succession"],
  "Improve retirement planning": ["Retirement"],
  "Improve cash flow": ["Business Growth"],
};
