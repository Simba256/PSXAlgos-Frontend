import type { GlossaryEntry } from "../types";

export const goldenCross: GlossaryEntry = {
  type: "glossary",
  slug: "golden-cross",
  term: "Golden Cross",
  aka: ["golden crossover", "50/200 cross", "SMA golden cross"],
  category: "strategy",
  tldr:
    "A golden cross happens when a stock's 50-day moving average rises above its 200-day moving average — a widely watched sign that the medium-term trend has turned upward.",
  metaTitle: "Golden Cross Explained — How the 50/200 Crossover Works | PSX Algos",
  metaDescription:
    "A beginner's guide to the golden cross: how the 50-day and 200-day moving averages cross, what the signal means, a worked example, and how to backtest it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "A **golden cross** is one of the most recognised signals in trend-following. It occurs when a shorter [moving average](/learn/sma-vs-ema) — usually the 50-day — crosses from below to above a longer one — usually the 200-day. Traders read it as a shift from a downtrend or sideways phase into a sustained uptrend.",
    },
    {
      kind: "para",
      text: "The mirror image is the **death cross**: the 50-day falling below the 200-day, read as a shift toward weakness. Both are popular precisely because they are simple — two lines and one crossing point.",
    },
    {
      kind: "heading",
      text: "Why two moving averages?",
    },
    {
      kind: "para",
      text: "A 50-day [simple moving average (SMA)](/learn/sma-vs-ema) is the average closing price of the last 50 trading days. It reacts fairly quickly to recent prices. The 200-day SMA averages a full trading year and moves slowly, so it represents the long-term trend. When the fast line climbs above the slow line, recent prices have been strong enough to pull the medium-term average above the long-term one — momentum is building.",
    },
    {
      kind: "heading",
      text: "A worked example",
    },
    {
      kind: "para",
      text: "Imagine a PSX stock recovering after a long slump. The numbers below are illustrative, not live prices:",
    },
    {
      kind: "table",
      caption: "Illustrative golden cross — the 50-day SMA overtakes the 200-day SMA.",
      headers: ["Day", "50-day SMA (PKR)", "200-day SMA (PKR)", "What's happening"],
      rows: [
        ["Mon", "118.0", "121.5", "Fast line still below slow — downtrend"],
        ["Tue", "119.4", "121.3", "Gap narrowing"],
        ["Wed", "121.0", "121.2", "Almost touching"],
        ["Thu", "121.8", "121.1", "Golden cross — fast crosses above"],
        ["Fri", "122.6", "121.0", "Trend confirmed, signal stays active"],
      ],
    },
    {
      kind: "para",
      text: "On Thursday the 50-day SMA (121.8) rises above the 200-day SMA (121.1). That crossing is the golden cross. A trend-following strategy would treat Thursday as a potential entry and stay in while the fast line holds above the slow one.",
    },
    {
      kind: "heading",
      text: "Strengths and limitations",
    },
    {
      kind: "list",
      items: [
        "**Strength — clarity.** The rule is unambiguous: one line above another. There is no guesswork about whether the signal fired.",
        "**Strength — it filters out noise.** Because both averages are slow, the golden cross tends to ignore short-lived spikes and only fires on broader moves.",
        "**Limitation — it lags.** By the time a year-long average turns, a good part of the move may already be over. The golden cross is a trend confirmation, not an early warning.",
        "**Limitation — whipsaws in flat markets.** When a stock drifts sideways, the two averages can cross back and forth, producing false signals. Many traders add a confirmation filter such as price staying above the 50-day SMA.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "A golden cross describes price behaviour — it is not a guarantee of future gains. It is one input among many, and works best combined with risk controls like a stop-loss.",
    },
  ],
  productTieIn: {
    heading: "Build a golden cross strategy on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "PSX Algos ships a **Golden Cross** starter template. Pick it in the strategy builder and you start with the rule *SMA(50) crosses above SMA(200)* already wired — no code. From there you can add a confirmation (for example, price above the 50-day SMA), then backtest it across a decade of PSX history to see how it would have behaved before risking anything.",
      },
    ],
    cta: { label: "Open the Golden Cross template →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is a golden cross in simple terms?",
      a: "It is when a stock's 50-day average price rises above its 200-day average price. Traders take it as a sign the medium-term trend has turned upward.",
    },
    {
      q: "What is the difference between a golden cross and a death cross?",
      a: "A golden cross is the 50-day moving average crossing above the 200-day (bullish). A death cross is the opposite — the 50-day crossing below the 200-day (bearish).",
    },
    {
      q: "Is the golden cross a reliable buy signal?",
      a: "It is a popular trend-confirmation signal, but it lags and can give false signals in sideways markets. Most traders pair it with a confirmation filter and a stop-loss rather than acting on the cross alone.",
    },
    {
      q: "Which moving averages does a golden cross use?",
      a: "The classic version uses the 50-day and 200-day simple moving averages, but the same idea works with other pairs (such as 20 and 50) for faster, noisier signals.",
    },
  ],
  related: [
    { slug: "sma-vs-ema", label: "SMA vs EMA" },
    { slug: "macd-crossover", label: "MACD Crossover strategy" },
    { slug: "momentum-breakout", label: "Momentum Breakout strategy" },
    { slug: "mean-reversion", label: "Mean Reversion strategy" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
