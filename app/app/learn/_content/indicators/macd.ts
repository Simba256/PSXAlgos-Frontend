import type { GlossaryEntry } from "../types";

export const macd: GlossaryEntry = {
  type: "glossary",
  slug: "macd",
  term: "MACD",
  aka: ["Moving Average Convergence Divergence", "MACD 12 26 9"],
  category: "indicator",
  tldr:
    "MACD is a momentum indicator built from two moving averages of price. It turns the gap between them into a line and a signal line whose crossings flag shifts in trend momentum.",
  metaTitle: "MACD Explained — Moving Average Convergence Divergence | PSX Algos",
  metaDescription:
    "A beginner's guide to MACD: how the MACD line, signal line, and histogram work, what a crossover means, a worked example, and how to use it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "**MACD** — short for Moving Average Convergence Divergence — is a momentum indicator that measures the relationship between two [moving averages](/learn/sma-vs-ema) of a stock's price. When those averages pull apart or come together, MACD captures that as a single swinging line, making it easy to see when momentum is building or fading.",
    },
    {
      kind: "heading",
      text: "The three parts",
    },
    {
      kind: "list",
      items: [
        "**MACD line** — the 12-day EMA minus the 26-day EMA. It rises when short-term momentum outpaces the longer term and falls when it lags.",
        "**Signal line** — a 9-day EMA of the MACD line. It is a smoothed version used as the trigger.",
        "**Histogram** — bars showing the gap between the MACD line and the signal line. They grow as momentum strengthens and shrink as it weakens.",
      ],
    },
    {
      kind: "para",
      text: "These standard settings — 12, 26, and 9 — are why MACD is often written MACD(12,26,9). The **zero line** matters too: MACD above zero means the 12-day EMA is above the 26-day (short-term strength); below zero means the opposite.",
    },
    {
      kind: "heading",
      text: "How traders read it",
    },
    {
      kind: "list",
      items: [
        "**Signal-line crossover.** MACD line crossing above the signal line is read as upward momentum; crossing below as downward. This is the basis of the [MACD crossover strategy](/learn/macd-crossover).",
        "**Zero-line cross.** MACD moving from below zero to above confirms a broader momentum shift.",
        "**Histogram momentum.** A shrinking histogram warns that a move is losing steam before the lines actually cross.",
      ],
    },
    {
      kind: "heading",
      text: "A worked example",
    },
    {
      kind: "para",
      text: "The figures below are illustrative:",
    },
    {
      kind: "table",
      caption: "Illustrative MACD turning up through its signal line.",
      headers: ["Day", "MACD line", "Signal line", "Histogram", "Read"],
      rows: [
        ["Mon", "-0.30", "-0.15", "-0.15", "Below signal — weak"],
        ["Tue", "-0.05", "-0.12", "+0.07", "Crossover — momentum turning up"],
        ["Wed", "0.18", "-0.02", "+0.20", "Strengthening"],
        ["Thu", "0.30", "0.10", "+0.20", "Confirmed uptrend"],
      ],
    },
    {
      kind: "para",
      text: "On Tuesday the MACD line crosses above the signal line and the histogram flips positive — the moment a momentum trader watches for.",
    },
    {
      kind: "heading",
      text: "Limitations",
    },
    {
      kind: "list",
      items: [
        "**It lags.** MACD is built from moving averages, so it confirms a move rather than predicting it.",
        "**Whipsaws in flat markets.** When a stock drifts sideways, the lines can cross back and forth, generating false signals.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "MACD pairs well with a momentum oscillator like RSI: MACD shows trend momentum, RSI shows whether the move is already stretched.",
    },
  ],
  productTieIn: {
    heading: "Use MACD on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "MACD, its signal line, and its histogram are all built-in indicators in the strategy builder. The **MACD cross** starter template wires *MACD crosses above signal* for you — add the histogram-above-zero confirmation and backtest it across a decade of PSX history before going live.",
      },
    ],
    cta: { label: "Build a MACD strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is MACD in simple terms?",
      a: "MACD measures the gap between a stock's 12-day and 26-day moving averages. When its line crosses its signal line, it flags that trend momentum is shifting up or down.",
    },
    {
      q: "What do 12, 26 and 9 mean?",
      a: "They are the standard settings: the MACD line is the 12-day EMA minus the 26-day EMA, and the signal line is a 9-day EMA of the MACD line.",
    },
    {
      q: "What is the MACD histogram?",
      a: "It is the gap between the MACD line and the signal line, drawn as bars. It grows as momentum strengthens and shrinks as it fades, often warning of a turn early.",
    },
    {
      q: "What is the difference between MACD and RSI?",
      a: "MACD measures trend momentum from moving averages and is unbounded; RSI measures how overbought or oversold a stock is on a fixed 0–100 scale. Many traders use them together.",
    },
  ],
  related: [
    { slug: "macd-crossover", label: "MACD Crossover strategy" },
    { slug: "sma-vs-ema", label: "SMA vs EMA" },
    { slug: "rsi", label: "RSI (Relative Strength Index)" },
    { slug: "golden-cross", label: "Golden Cross strategy" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
