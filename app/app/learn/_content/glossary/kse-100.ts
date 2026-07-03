import type { GlossaryEntry } from "../types";

export const kse100: GlossaryEntry = {
  type: "glossary",
  slug: "kse-100",
  term: "KSE-100 Index",
  aka: ["KSE100", "KSE 100", "Karachi 100 Index"],
  category: "index",
  tldr:
    "The KSE-100 is the Pakistan Stock Exchange's benchmark index, tracking 100 of the largest companies by free-float market capitalisation and serving as the headline gauge of how the Pakistani stock market is performing.",
  metaTitle: "What Is the KSE-100 Index? Pakistan's Benchmark Explained | PSX Algos",
  metaDescription:
    "A clear guide to the KSE-100 Index — how the Pakistan Stock Exchange's benchmark selects its 100 companies, how it's weighted, and why it matters to investors.",
  body: [
    {
      kind: "para",
      text: "The **KSE-100 Index** is the main benchmark of the **Pakistan Stock Exchange (PSX)**. Introduced in November 1991 with a base value of 1,000 points, it tracks 100 companies and is the number most people mean when they say \"the market was up today\" in Pakistan. When a news headline reports that the PSX gained or lost a certain number of points, it is almost always quoting the KSE-100.",
    },
    {
      kind: "heading",
      text: "How the 100 companies are chosen",
    },
    {
      kind: "para",
      text: "The index uses a two-step selection rule designed to keep it representative of the whole market rather than just the biggest names:",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "**Sector leaders first.** The largest company by market capitalisation in each PSX sector is automatically included. This guarantees every sector of the economy is represented.",
        "**Largest of the rest.** The remaining slots are filled by the biggest companies by free-float market capitalisation, regardless of sector, until the list reaches 100.",
      ],
    },
    {
      kind: "para",
      text: "The constituents are reviewed and rebalanced twice a year, so a company that shrinks can drop out and a fast-growing one can be added.",
    },
    {
      kind: "heading",
      text: "How the index is weighted: free float, not total size",
    },
    {
      kind: "para",
      text: "The KSE-100 is a [free-float market-capitalisation](/learn/free-float-market-cap)-weighted index. \"Free float\" means only the shares actually available for public trading are counted — shares locked up by founders, governments, or strategic holders are excluded. A company therefore moves the index in proportion to its tradeable size, not its paper size. The simplified example below shows how three companies of different free-float values contribute different weights:",
    },
    {
      kind: "table",
      caption:
        "Illustrative free-float weighting (figures are examples, not live values).",
      headers: ["Company", "Free-float market cap (PKR bn)", "Index weight"],
      rows: [
        ["Company A", "400", "40%"],
        ["Company B", "350", "35%"],
        ["Company C", "250", "25%"],
        ["Total", "1,000", "100%"],
      ],
    },
    {
      kind: "para",
      text: "Because the weighting is free-float-based, a 1% move in a heavily weighted company nudges the KSE-100 far more than a 1% move in a small one. This is why a handful of large banks, energy, and fertiliser companies can drive most of the index's daily change.",
    },
    {
      kind: "heading",
      text: "Why it matters to investors",
    },
    {
      kind: "list",
      items: [
        "**A single performance gauge.** Instead of tracking hundreds of stocks, you can watch one number to judge overall market direction.",
        "**A benchmark to beat.** Investors and funds compare their own returns against the KSE-100 to see whether they are outperforming the market.",
        "**The basis for index funds.** Several mutual funds in Pakistan simply track the KSE-100, letting investors buy the whole market in one product.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "The KSE-100 measures price performance of its constituents. It is a barometer of the market, not a recommendation to buy or sell any specific stock.",
    },
  ],
  productTieIn: {
    heading: "Working with the KSE-100 on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "On **PSX Algos** you can build a trading strategy without writing any code — set conditions like \"[RSI](/learn/rsi) below 30 and volume surging,\" then backtest the idea against the KSE-100 universe across a decade of PSX history to see how it would have performed. From there you can deploy it as a live signal feed or run it as a paper-trading bot.",
      },
    ],
    cta: { label: "Build a KSE-100 strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is the KSE-100 Index in simple terms?",
      a: "It is the Pakistan Stock Exchange's benchmark index. It tracks 100 of the largest listed companies by free-float market capitalisation and is the headline number used to describe how the Pakistani stock market is doing on a given day.",
    },
    {
      q: "How are companies selected for the KSE-100?",
      a: "The largest company by market capitalisation in each sector is automatically included, and the remaining slots are filled by the biggest companies by free-float market capitalisation until the list reaches 100. Constituents are rebalanced twice a year.",
    },
    {
      q: "When was the KSE-100 Index launched?",
      a: "The KSE-100 was introduced in November 1991 with a base value of 1,000 points.",
    },
    {
      q: "What is the difference between the KSE-100 and the KSE-30?",
      a: "The KSE-100 tracks 100 companies and is the broad benchmark, while the KSE-30 tracks only the 30 most liquid companies using a pure free-float methodology. The KSE-100 is the more widely quoted gauge of overall market performance.",
    },
  ],
  related: [
    { slug: "kse-30", label: "KSE-30 Index" },
    { slug: "kmi-30", label: "KMI-30 Index" },
    { slug: "kse-all-share", label: "KSE All-Share Index" },
    { slug: "settlement-cycle", label: "T+1 Settlement" },
  ],
  author: "PSX Algos",
  published: "2026-06-01",
  updated: "2026-06-01",
};
