import type { GlossaryEntry } from "../types";

export const macdCrossover: GlossaryEntry = {
  type: "glossary",
  slug: "macd-crossover",
  term: "MACD Crossover",
  aka: ["MACD cross", "MACD signal cross", "12/26/9 crossover"],
  category: "strategy",
  tldr:
    "A MACD crossover strategy enters when the MACD line crosses above its signal line — a momentum trigger that traders use to catch a trend turning upward.",
  metaTitle: "MACD Crossover Strategy Explained — The 12/26/9 Signal | PSX Algos",
  metaDescription:
    "A beginner's guide to the MACD crossover: how the MACD and signal lines cross, what the histogram adds, a worked example, and how to backtest it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "The **MACD crossover** is a momentum strategy built on the [MACD indicator](/learn/macd) (Moving Average Convergence Divergence). MACD tracks the relationship between two moving averages of price and turns it into a single line that swings above and below zero. The strategy's core rule is simple: enter when the **MACD line crosses above its signal line**, and treat the opposite cross as a signal that momentum is fading.",
    },
    {
      kind: "heading",
      text: "The three parts of MACD",
    },
    {
      kind: "list",
      items: [
        "**MACD line** — the 12-day EMA minus the 26-day EMA. It rises when short-term price momentum outpaces the longer term.",
        "**Signal line** — a 9-day EMA of the MACD line. It is a smoothed version that the MACD line crosses through.",
        "**Histogram** — the gap between the MACD line and the signal line, drawn as bars. It grows as momentum strengthens and shrinks as it fades.",
      ],
    },
    {
      kind: "para",
      text: "The standard settings — 12, 26, and 9 — give the strategy its other name, the 12/26/9 crossover. A common confirmation is to require the histogram to be above zero, which is just another way of saying the MACD line is above its signal line.",
    },
    {
      kind: "heading",
      text: "A worked example",
    },
    {
      kind: "para",
      text: "The figures below are illustrative, not live prices:",
    },
    {
      kind: "table",
      caption: "Illustrative MACD crossover — the MACD line crosses above the signal line.",
      headers: ["Day", "MACD line", "Signal line", "Histogram", "Signal"],
      rows: [
        ["Mon", "-0.40", "-0.20", "-0.20", "MACD below signal — bearish"],
        ["Tue", "-0.10", "-0.15", "+0.05", "Crossover — MACD rises above signal"],
        ["Wed", "0.15", "-0.05", "+0.20", "Momentum building, histogram grows"],
        ["Thu", "0.35", "0.08", "+0.27", "Trend confirmed"],
        ["Fri", "0.40", "0.20", "+0.20", "Still positive, position held"],
      ],
    },
    {
      kind: "para",
      text: "On Tuesday the MACD line (-0.10) rises above the signal line (-0.15), flipping the histogram positive. That crossover is the entry. The strategy stays in while the MACD line holds above the signal line and exits when it crosses back below.",
    },
    {
      kind: "heading",
      text: "Strengths and limitations",
    },
    {
      kind: "list",
      items: [
        "**Strength — responsive momentum read.** MACD reacts faster than a 50/200 moving-average cross, so it can signal a turn earlier.",
        "**Strength — the histogram adds nuance.** A shrinking histogram warns that momentum is fading even before the lines cross, giving an early heads-up.",
        "**Limitation — choppy in sideways markets.** When a stock drifts flat, the MACD line can cross the signal line repeatedly, producing whipsaw trades.",
        "**Limitation — still a lagging signal.** MACD is built from moving averages, so it confirms a move rather than predicting it.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "Crossovers near the zero line, in a quiet market, are the least reliable. Many traders favour crossovers that happen with the MACD line clearly below zero (a deeper turn) or pair the cross with a trend filter.",
    },
  ],
  productTieIn: {
    heading: "Build a MACD crossover strategy on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "PSX Algos ships a **MACD cross** starter template wired with *MACD crosses above signal*. Add the histogram-above-zero confirmation, set your exit and stop-loss, then backtest the rule across a decade of PSX history to see how the crossovers would have performed before going live.",
      },
    ],
    cta: { label: "Open the MACD Crossover template →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is a MACD crossover in simple terms?",
      a: "It is when the MACD line crosses above its signal line, which traders read as upward momentum building. The opposite cross is read as momentum fading.",
    },
    {
      q: "What do 12, 26 and 9 mean in MACD?",
      a: "They are the standard settings: the MACD line is the 12-day EMA minus the 26-day EMA, and the signal line is a 9-day EMA of the MACD line.",
    },
    {
      q: "What does the MACD histogram show?",
      a: "The histogram is the gap between the MACD line and the signal line. It grows as momentum strengthens and shrinks as it weakens, often warning of a turn before the lines actually cross.",
    },
    {
      q: "How is a MACD crossover different from a golden cross?",
      a: "A MACD crossover uses two fast-moving momentum lines and reacts quickly, while a golden cross uses the slow 50-day and 200-day moving averages and confirms longer-term trend changes.",
    },
  ],
  related: [
    { slug: "macd", label: "MACD" },
    { slug: "golden-cross", label: "Golden Cross strategy" },
    { slug: "momentum-breakout", label: "Momentum Breakout strategy" },
    { slug: "sma-vs-ema", label: "SMA vs EMA" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
