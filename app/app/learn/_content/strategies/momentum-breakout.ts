import type { GlossaryEntry } from "../types";

export const momentumBreakout: GlossaryEntry = {
  type: "glossary",
  slug: "momentum-breakout",
  term: "Momentum Breakout",
  aka: ["breakout trading", "20-day high breakout", "volume breakout"],
  category: "strategy",
  tldr:
    "A momentum breakout strategy buys a stock as it pushes above a recent high on heavy volume, betting that the burst of strength will carry the price further in the same direction.",
  metaTitle: "Momentum Breakout Explained — Trading New Highs on Volume | PSX Algos",
  metaDescription:
    "A beginner's guide to momentum breakout trading: how price breaking a recent high on rising volume signals a move, a worked example, and how to backtest it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "A **momentum breakout** strategy does the opposite of buying a dip: it buys strength. The rule is to enter when a stock breaks above a recent high — often its highest close of the last 20 trading days — accompanied by a surge in trading volume. The thinking is that breaking resistance on heavy volume shows real demand, and that strength tends to continue for a while.",
    },
    {
      kind: "para",
      text: "Volume is the key filter. A price poking above a recent high on quiet volume can easily fade back. A breakout on volume well above average suggests many buyers are committing, which makes the move more likely to hold.",
    },
    {
      kind: "heading",
      text: "Why the 20-day high?",
    },
    {
      kind: "para",
      text: "The highest price over the last 20 trading days (roughly one trading month) acts as a near-term ceiling — a level sellers have defended recently. When price finally closes above it, that ceiling is broken, and traders who were waiting to sell there are cleared out. A common, simpler stand-in for beginners is price closing above its [50-day moving average](/learn/sma-vs-ema) while volume spikes.",
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
      caption: "Illustrative breakout — price clears the 20-day high on a volume surge.",
      headers: ["Day", "Close (PKR)", "20-day high (PKR)", "Volume vs 20-day avg", "Signal"],
      rows: [
        ["Mon", "84.0", "85.5", "0.9×", "Below the ceiling"],
        ["Tue", "85.0", "85.5", "1.1×", "Testing the ceiling"],
        ["Wed", "87.2", "85.5", "2.4×", "Breakout — closes above high on heavy volume"],
        ["Thu", "89.0", "87.2", "1.8×", "Move continues, position held"],
        ["Fri", "90.5", "89.0", "1.5×", "Trend intact"],
      ],
    },
    {
      kind: "para",
      text: "On Wednesday the stock closes at 87.2, above the prior 20-day high of 85.5, and volume is 2.4× its 20-day average. Both conditions — new high and volume surge — line up, so the breakout strategy enters and rides the follow-through.",
    },
    {
      kind: "heading",
      text: "Strengths and limitations",
    },
    {
      kind: "list",
      items: [
        "**Strength — catches big moves early.** Breakouts often mark the start of a sustained run, so a few winners can be large.",
        "**Strength — clear, objective trigger.** A new high plus a volume threshold is easy to define and test.",
        "**Limitation — false breakouts.** Price can poke above a high, trigger the entry, then fall back below — a 'fakeout'. The volume filter reduces these but does not remove them.",
        "**Limitation — worse entry price.** You buy after a run-up, so your entry is higher and your stop-loss has to absorb more wiggle room.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "Breakouts work best in trending, liquid markets. On thin PSX names, a single large order can fake a breakout, so the volume confirmation matters even more here.",
    },
  ],
  productTieIn: {
    heading: "Build a momentum breakout strategy on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "PSX Algos ships a **Momentum breakout** starter template. The builder lets you set the breakout level and add a relative-volume filter (for example, volume above 2× its 20-day average), then backtest the whole rule across a decade of PSX history to separate the real breakouts from the fakeouts before you trade it.",
      },
    ],
    cta: { label: "Open the Momentum Breakout template →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is a momentum breakout in simple terms?",
      a: "It is buying a stock as it pushes above a recent high on heavy trading volume, betting that the burst of strength will carry the price further up.",
    },
    {
      q: "Why is volume important for breakouts?",
      a: "Volume shows conviction. A breakout above a recent high on high volume suggests many buyers are committing, which makes the move more likely to hold than a breakout on quiet volume.",
    },
    {
      q: "What is a false breakout?",
      a: "A false breakout, or 'fakeout', is when price briefly clears a high and triggers an entry, then falls back below it. Volume confirmation and a stop-loss are the usual defences.",
    },
    {
      q: "How is breakout trading different from mean reversion?",
      a: "Breakout trading buys strength and expects it to continue; mean reversion buys weakness and expects a bounce back to the average. They suit opposite market conditions.",
    },
  ],
  related: [
    { slug: "mean-reversion", label: "Mean Reversion strategy" },
    { slug: "golden-cross", label: "Golden Cross strategy" },
    { slug: "bollinger-squeeze", label: "Bollinger Squeeze strategy" },
    { slug: "atr", label: "ATR (Average True Range)" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
