import type { GlossaryEntry } from "../types";

export const kseAllShare: GlossaryEntry = {
  type: "glossary",
  slug: "kse-all-share",
  term: "KSE All-Share Index",
  aka: ["KSE All Share", "All-Share Index", "PSX All-Share Index"],
  category: "index",
  tldr:
    "The KSE All-Share Index is the Pakistan Stock Exchange's broadest benchmark — it includes every eligible listed company, not just a fixed top 30 or 100.",
  metaTitle: "What Is the KSE All-Share Index? PSX's Broadest Benchmark | PSX Algos",
  metaDescription:
    "How the KSE All-Share Index covers every eligible company on the Pakistan Stock Exchange, how it differs from the KSE-100, and when to look at it.",
  body: [
    {
      kind: "para",
      text: "The **KSE All-Share Index** is the widest benchmark on the **Pakistan Stock Exchange (PSX)**. Where the [KSE-100](/learn/kse-100) is capped at 100 companies and the [KSE-30](/learn/kse-30) at 30, the All-Share Index aims to include *every* eligible listed company on the exchange. There is no fixed constituent count — the number rises and falls as companies list, delist, or become eligible.",
    },
    {
      kind: "heading",
      text: "Why a whole-market index exists",
    },
    {
      kind: "para",
      text: "The headline benchmarks deliberately leave companies out — that is what makes them useful as a focused gauge. But it also means they miss the smaller and mid-sized names. The All-Share Index fills that gap: it is the closest thing to a single number for the entire listed market, which makes it the natural reference point when you want breadth rather than a curated shortlist.",
    },
    {
      kind: "heading",
      text: "How it compares to the headline benchmarks",
    },
    {
      kind: "table",
      caption: "Coverage of the main PSX indices.",
      headers: ["Index", "Companies", "What it captures"],
      rows: [
        ["KSE All-Share", "All eligible listed", "The whole market"],
        ["KSE-100", "100", "Broad benchmark, sector-representative"],
        ["KSE-30", "30", "Most liquid large caps"],
      ],
    },
    {
      kind: "para",
      text: "Because it spans the whole market, the All-Share Index includes many thinly traded companies. That breadth is its strength as a market-wide gauge, but it also means individual small caps inside it can be hard to trade in size.",
    },
    {
      kind: "callout",
      tone: "info",
      text: "An index is a measure, not a portfolio. The KSE All-Share tells you how the listed market as a whole moved — it is not a list of stocks to buy.",
    },
  ],
  productTieIn: {
    heading: "Screening across the whole market",
    blocks: [
      {
        kind: "para",
        text: "When you want your strategy to look beyond the big names, a whole-market view is where opportunities hide. On **PSX Algos** you can backtest an idea across a wide universe of PSX stocks and see how it would have behaved — while keeping in mind that smaller names are harder to trade in practice.",
      },
    ],
    cta: { label: "Build a strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is the KSE All-Share Index?",
      a: "It is the Pakistan Stock Exchange's broadest index. It aims to include every eligible listed company, making it the closest single measure of the entire listed market rather than a fixed shortlist.",
    },
    {
      q: "How is the KSE All-Share different from the KSE-100?",
      a: "The KSE-100 is limited to 100 companies chosen for sector representation and size. The All-Share Index has no fixed cap and covers all eligible listed companies, so it captures small and mid caps the KSE-100 leaves out.",
    },
    {
      q: "How many companies are in the KSE All-Share Index?",
      a: "There is no fixed number. The count changes as companies list, delist, or move in and out of eligibility, because the index is meant to represent the whole market.",
    },
  ],
  related: [
    { slug: "kse-100", label: "KSE-100 Index" },
    { slug: "kse-30", label: "KSE-30 Index" },
    { slug: "kmi-30", label: "KMI-30 Index" },
  ],
  author: "PSX Algos",
  published: "2026-06-02",
  updated: "2026-06-02",
};
