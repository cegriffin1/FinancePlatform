/** Highwater Capital — public consumer brand (separate from ALTUS advisor app). */

export const HIGHWATER_BRAND = {
  name: "Highwater Capital",
  positioning: "Clarity for your financial future.",
  description: "Independent financial education and advisor matching.",
  assessmentLabel: "RETIREMENT OPPORTUNITY ASSESSMENT",
} as const;

export const EDUCATION_VS_ADVICE_DISCLAIMER =
  "This assessment provides general educational information only. It is not individualized financial, tax, legal, or investment advice, and it does not create an advisor–client relationship. Decisions about your finances should be made with a qualified professional who understands your full situation.";

export type LiteratureCard = {
  id: string;
  title: string;
  summary: string;
  category: string;
};

/** Static educational literature — no performance claims or credentials. */
export const HIGHWATER_LITERATURE_CARDS: LiteratureCard[] = [
  {
    id: "income-basics",
    title: "Retirement income basics",
    summary:
      "An overview of how guaranteed and market-linked income sources can work together in a retirement plan.",
    category: "Education",
  },
  {
    id: "timeline-planning",
    title: "Planning around your timeline",
    summary:
      "Educational considerations for near-term versus longer-horizon retirement decisions.",
    category: "Education",
  },
  {
    id: "conversation-prep",
    title: "Preparing for a professional conversation",
    summary:
      "Questions you may want to ask when speaking with a financial professional about your goals and priorities.",
    category: "Next steps",
  },
];
