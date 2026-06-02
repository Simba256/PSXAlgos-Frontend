import type { GlossaryEntry } from "../types";

export const freeFloatMarketCap: GlossaryEntry = {
  type: "glossary",
  slug: "free-float-market-cap",
  term: "Free-Float Market Capitalisation",
  aka: ["free float", "free-float market cap", "free-float capitalization"],
  category: "structure",
  tldr:
    "Free-float market capitalisation is the value of only the shares a company has available for public trading — its total market value minus shares locked up by founders, governments, and strategic holders.",
  metaTitle: "What Is Free-Float Market Capitalisation? PSX Weighting Explained | PSX Algos",
  metaDescription:
    "How free-float market capitalisation works, why it differs from total market cap, and why the PSX uses it to weight indices like the KSE-100.",
  body: [
    {
      kind: "para",
      text: "**Free-float market capitalisation** measures a company's size using only the shares that are actually available to trade on the open market. It starts from total market capitalisation — share price multiplied by all shares outstanding — and strips out the shares that are not realistically for sale: stakes held by founders and their families, government holdings, and strategic investors who hold for the long term.",
    },
    {
      kind: "heading",
      text: "Total market cap vs free float",
    },
    {
      kind: "para",
      text: "The two numbers can be very different. Consider a company whose shares trade at PKR 100, with 1 billion shares outstanding — a total market cap of PKR 100 billion. If founders and the government hold 60% of those shares and never trade them, only 40% is free float:",
    },
    {
      kind: "table",
      caption: "Total market cap vs free-float market cap (illustrative).",
      headers: ["Measure", "Calculation", "Value (PKR bn)"],
      rows: [
        ["Total market cap", "PKR 100 × 1,000m shares", "100"],
        ["Locked-up holdings", "60% of shares", "60"],
        ["Free-float market cap", "40% of shares", "40"],
      ],
    },
    {
      kind: "heading",
      text: "Why the PSX uses free float to weight indices",
    },
    {
      kind: "para",
      text: "Indices like the [KSE-100](/learn/kse-100) weight each company by its free-float market cap rather than its total market cap. The reason is practical: an index is meant to reflect what investors can actually buy. If a company's shares are mostly locked away, its real influence on tradeable market value is smaller than its headline size suggests — so it should move the index less. Free-float weighting prevents a company with a tiny public float from dominating the benchmark just because its paper value is large.",
    },
    {
      kind: "callout",
      tone: "info",
      text: "Free float can change over time — for example when a founder sells down a stake or a company issues new shares to the public. When it does, the company's index weight is adjusted at the next rebalancing.",
    },
  ],
  productTieIn: {
    heading: "Why this matters for your strategy",
    blocks: [
      {
        kind: "para",
        text: "When you backtest a strategy against an index universe on **PSX Algos**, the companies that drive most of the index's movement are the large free-float names. Understanding which stocks carry the most weight helps you read why a backtest behaved the way it did.",
      },
    ],
    cta: { label: "Build a strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is free-float market capitalisation in simple terms?",
      a: "It is the market value of only the shares a company has available for public trading. It excludes shares held by founders, governments, and strategic investors that are not realistically available to buy.",
    },
    {
      q: "How is free-float market cap different from market cap?",
      a: "Total market cap counts every share outstanding, while free-float market cap counts only the publicly tradeable shares. A company with large locked-up holdings will have a much smaller free float than its total market cap.",
    },
    {
      q: "Why does the KSE-100 use free-float weighting?",
      a: "Because an index should reflect what investors can actually trade. Free-float weighting stops a company with a small public float from dominating the index purely on paper value.",
    },
  ],
  related: [
    { slug: "kse-100", label: "KSE-100 Index" },
    { slug: "kse-30", label: "KSE-30 Index" },
  ],
  author: "PSX Algos",
  published: "2026-06-01",
  updated: "2026-06-01",
};
