import type { GlossaryEntry } from "../types";

export const kmi30: GlossaryEntry = {
  type: "glossary",
  slug: "kmi-30",
  term: "KMI-30 Index",
  aka: ["KMI30", "KMI 30", "KSE-Meezan Index", "KSE Meezan 30 Index"],
  category: "index",
  tldr:
    "The KMI-30 is the Pakistan Stock Exchange's benchmark for Shariah-compliant stocks — 30 companies that pass Islamic screening, weighted by free-float market capitalisation.",
  metaTitle: "What Is the KMI-30 Index? Pakistan's Shariah Benchmark | PSX Algos",
  metaDescription:
    "How the KMI-30 Index screens for Shariah-compliant companies on the Pakistan Stock Exchange, how it is weighted, and how it compares to the KSE-30.",
  body: [
    {
      kind: "para",
      text: "The **KMI-30 Index** — the KSE-Meezan Index — is the **Pakistan Stock Exchange's** benchmark for Shariah-compliant equities. It tracks 30 companies that pass Islamic screening criteria and was created jointly by the PSX and Al Meezan Investment Management. It was introduced in 2008 with a base period of June 2008.",
    },
    {
      kind: "heading",
      text: "What makes a company Shariah-compliant",
    },
    {
      kind: "para",
      text: "Before a company can enter the KMI-30, it has to clear two layers of screening overseen by a Shariah advisory board:",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "**Business screening.** The company's core business must be permissible (halal). Companies whose main activity is conventional interest-based banking, alcohol, gambling, tobacco, or other non-compliant lines are excluded.",
        "**Financial screening.** Even a permissible business must keep within limits on interest-based debt, interest income, and illiquid-versus-liquid assets. A company that relies too heavily on interest-bearing borrowing or earns too much from interest is screened out.",
      ],
    },
    {
      kind: "para",
      text: "Among the companies that pass screening, the 30 largest by [free-float market capitalisation](/learn/free-float-market-cap) form the index. Like the other PSX benchmarks, the KMI-30 is recomposed twice a year, and compliance is re-checked at each review — a company can drop out if its finances drift outside the limits.",
    },
    {
      kind: "heading",
      text: "KMI-30 vs KSE-30",
    },
    {
      kind: "table",
      caption: "Two 30-company PSX indices with different filters.",
      headers: ["Feature", "KMI-30", "KSE-30"],
      rows: [
        ["Filter", "Shariah screening", "Liquidity"],
        ["Companies", "30 compliant", "30 most liquid"],
        ["Weighting", "Free-float market cap", "Free-float market cap"],
        ["Rebalanced", "Semi-annually", "Semi-annually"],
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "Shariah compliance is assessed by the index's Shariah advisers, not by PSX Algos. Inclusion in the KMI-30 reflects a screening process at a point in time and is not personal investment or religious advice.",
    },
  ],
  productTieIn: {
    heading: "Testing a Shariah-focused strategy",
    blocks: [
      {
        kind: "para",
        text: "If you want to trade only Shariah-compliant names, the KMI-30 constituents are a natural starting universe. On **PSX Algos** you can build and backtest a strategy and then focus it on the names you care about, so your testing reflects the stocks you would actually trade.",
      },
    ],
    cta: { label: "Build a strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is the KMI-30 Index?",
      a: "It is the Pakistan Stock Exchange's benchmark for Shariah-compliant stocks. It tracks 30 companies that pass Islamic business and financial screening, weighted by free-float market capitalisation.",
    },
    {
      q: "How is a company judged Shariah-compliant for the KMI-30?",
      a: "A company must pass business screening (its core activity must be permissible) and financial screening (limits on interest-based debt, interest income, and asset composition). The screening is overseen by a Shariah advisory board and rechecked at each semi-annual review.",
    },
    {
      q: "What is the difference between the KMI-30 and the KSE-30?",
      a: "Both track 30 companies weighted by free float, but the KMI-30 filters for Shariah compliance while the KSE-30 filters for liquidity. A company can be in one and not the other.",
    },
    {
      q: "Who created the KMI-30 Index?",
      a: "It was created jointly by the Pakistan Stock Exchange and Al Meezan Investment Management, and introduced in 2008.",
    },
  ],
  related: [
    { slug: "kse-30", label: "KSE-30 Index" },
    { slug: "kse-100", label: "KSE-100 Index" },
    { slug: "free-float-market-cap", label: "Free-Float Market Cap" },
  ],
  author: "PSX Algos",
  published: "2026-06-02",
  updated: "2026-06-02",
};
