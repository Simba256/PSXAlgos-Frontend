import type { GlossaryEntry } from "../types";

export const settlementCycle: GlossaryEntry = {
  type: "glossary",
  slug: "settlement-cycle",
  term: "Settlement Cycle (T+1)",
  aka: [
    "T+1 settlement",
    "T+2 settlement",
    "rolling settlement",
    "PSX settlement",
  ],
  category: "structure",
  tldr:
    "The settlement cycle is how long after a trade the shares and cash actually change hands. On the Pakistan Stock Exchange this is T+1 — one business day after the trade — since 9 February 2026, down from the previous T+2.",
  metaTitle: "What Is T+1 Settlement on the PSX? Trade Settlement Explained | PSX Algos",
  metaDescription:
    "How the Pakistan Stock Exchange settlement cycle works: what T+1 means, when shares and cash actually change hands, and how it changed from T+2 in February 2026.",
  body: [
    {
      kind: "para",
      text: "When you buy or sell a share, the trade is *agreed* instantly — but the shares and the money do not actually swap hands at that exact moment. The **settlement cycle** is the gap between the trade and the moment ownership and cash are finally transferred. On the **Pakistan Stock Exchange (PSX)**, that cycle is **T+1**: settlement happens one business day after the trade date.",
    },
    {
      kind: "heading",
      text: "What \"T+1\" actually means",
    },
    {
      kind: "para",
      text: "\"T\" is the trade date — the day the deal is struck. The number after it is how many *business days* later settlement completes. So if you buy a stock on a Monday (T), the shares land in your account and the cash leaves it on Tuesday (T+1). Weekends and market holidays don't count, so a Friday trade settles on the following Monday.",
    },
    {
      kind: "table",
      caption: "When a trade settles under T+1 (business days).",
      headers: ["You trade on", "Settlement completes on"],
      rows: [
        ["Monday", "Tuesday"],
        ["Thursday", "Friday"],
        ["Friday", "Monday (next business day)"],
      ],
    },
    {
      kind: "heading",
      text: "The move from T+2 to T+1",
    },
    {
      kind: "para",
      text: "Until early 2026 the PSX ran on a **T+2** cycle — two business days to settle. On **9 February 2026** it moved to T+1 for Regular and Leverage market equity trades, halving the wait and bringing Pakistan in line with the faster settlement standard adopted by major markets. Shorter settlement means quicker access to your shares and cash, and less time exposed to the risk that the other side of the trade fails to deliver.",
    },
    {
      kind: "callout",
      tone: "info",
      text: "T+1 applies to regular equity trades. Some products and special transactions can follow different timelines, so check with your broker if you are dealing in anything other than ordinary shares.",
    },
  ],
  productTieIn: {
    heading: "Why settlement matters for live trading",
    blocks: [
      {
        kind: "para",
        text: "Backtests assume trades happen cleanly — but in live trading the settlement cycle decides when your capital and shares are actually free to use again. When you take a PSX Algos strategy from backtest to a live signal feed or paper bot, knowing that funds settle on T+1 helps you plan how quickly you can recycle capital into the next trade.",
      },
    ],
    cta: { label: "Build a strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is the settlement cycle on the Pakistan Stock Exchange?",
      a: "It is T+1, meaning a trade settles one business day after the trade date. Shares and cash change hands on the next business day after you buy or sell.",
    },
    {
      q: "When did the PSX move from T+2 to T+1?",
      a: "The Pakistan Stock Exchange moved from a T+2 to a T+1 settlement cycle on 9 February 2026 for Regular and Leverage market equity trades.",
    },
    {
      q: "What does T+1 mean exactly?",
      a: "\"T\" is the trade date and \"+1\" is one business day later. A trade made on Monday settles on Tuesday; a Friday trade settles the following Monday because weekends and holidays are not counted.",
    },
    {
      q: "Why does a shorter settlement cycle matter?",
      a: "Faster settlement gives you quicker access to your shares and cash and reduces the time you are exposed to the risk that the counterparty fails to deliver. It also lets you recycle capital into new trades sooner.",
    },
  ],
  related: [
    { slug: "kse-100", label: "KSE-100 Index" },
    { slug: "free-float-market-cap", label: "Free-Float Market Cap" },
  ],
  author: "PSX Algos",
  published: "2026-06-02",
  updated: "2026-06-02",
};
