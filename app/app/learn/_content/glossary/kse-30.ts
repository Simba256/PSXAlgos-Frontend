import type { GlossaryEntry } from "../types";

export const kse30: GlossaryEntry = {
  type: "glossary",
  slug: "kse-30",
  term: "KSE-30 Index",
  aka: ["KSE30", "KSE 30", "Karachi 30 Index"],
  category: "index",
  tldr:
    "The KSE-30 is a Pakistan Stock Exchange index that tracks the 30 most liquid companies using a pure free-float methodology — a tighter, more tradeable benchmark than the broader KSE-100.",
  metaTitle: "What Is the KSE-30 Index? Pakistan's 30 Most Liquid Stocks | PSX Algos",
  metaDescription:
    "How the KSE-30 Index selects the Pakistan Stock Exchange's 30 most liquid companies, how it differs from the KSE-100, and why it uses a pure free-float methodology.",
  body: [
    {
      kind: "para",
      text: "The **KSE-30 Index** tracks the 30 most liquid companies listed on the **Pakistan Stock Exchange (PSX)**. It was launched on 1 September 2006 with a base value of 10,000 points (base period June 2005) and was built to give traders a tighter, more liquid benchmark than the broader [KSE-100](/learn/kse-100).",
    },
    {
      kind: "heading",
      text: "How the 30 companies are chosen",
    },
    {
      kind: "para",
      text: "Unlike the KSE-100, the KSE-30 has **no sector-representation rule**. Companies earn a place purely on size and tradeability — they are ranked by a combination of [free-float market capitalisation](/learn/free-float-market-cap) and liquidity (how easily their shares can be bought and sold without moving the price). The top 30 make the cut, regardless of which sector they belong to. The list is reviewed and recomposed twice a year.",
    },
    {
      kind: "heading",
      text: "KSE-30 vs KSE-100",
    },
    {
      kind: "table",
      caption: "How the two main PSX benchmarks differ.",
      headers: ["Feature", "KSE-30", "KSE-100"],
      rows: [
        ["Companies", "30", "100"],
        ["Selection basis", "Liquidity + free-float size", "Sector leaders + free-float size"],
        ["Sector-representation rule", "No", "Yes"],
        ["Weighting", "Free-float market cap", "Free-float market cap"],
        ["Rebalanced", "Semi-annually", "Semi-annually"],
      ],
    },
    {
      kind: "para",
      text: "Because it concentrates on the most heavily traded names, the KSE-30 moves with the large, liquid blue chips. The KSE-100 stays the more widely quoted gauge of overall market direction, but the KSE-30 is useful when you care specifically about the most tradeable end of the market.",
    },
    {
      kind: "callout",
      tone: "info",
      text: "The KSE-30 is a subset of the market, not a recommendation. It measures the price performance of its 30 constituents — it does not tell you whether any individual stock is worth buying.",
    },
  ],
  productTieIn: {
    heading: "Backtesting against liquid names",
    blocks: [
      {
        kind: "para",
        text: "When you backtest a strategy on **PSX Algos**, the most liquid stocks — the kind that populate the KSE-30 — are the ones where fills are most realistic, because there is real volume to trade against. Testing your idea on these names first is a sensible way to see whether it holds up before reaching into thinner parts of the market.",
      },
    ],
    cta: { label: "Build a strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is the KSE-30 Index in simple terms?",
      a: "It is a Pakistan Stock Exchange index that tracks the 30 most liquid listed companies, weighted by their free-float market capitalisation. It is a tighter, more tradeable benchmark than the 100-company KSE-100.",
    },
    {
      q: "How is the KSE-30 different from the KSE-100?",
      a: "The KSE-30 holds 30 companies selected purely on liquidity and free-float size, with no sector-representation rule. The KSE-100 holds 100 companies and guarantees a slot for the largest company in each sector. The KSE-100 is the more widely quoted overall benchmark.",
    },
    {
      q: "When was the KSE-30 launched?",
      a: "The KSE-30 was launched on 1 September 2006 with a base value of 10,000 points and a base period of June 2005.",
    },
    {
      q: "How often is the KSE-30 rebalanced?",
      a: "The KSE-30 is reviewed and recomposed twice a year, so companies that become less liquid can drop out and more actively traded ones can be added.",
    },
  ],
  related: [
    { slug: "kse-100", label: "KSE-100 Index" },
    { slug: "kmi-30", label: "KMI-30 Index" },
    { slug: "free-float-market-cap", label: "Free-Float Market Cap" },
  ],
  author: "PSX Algos",
  published: "2026-06-02",
  updated: "2026-06-02",
};
