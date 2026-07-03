import type { GlossaryEntry } from "../types";

export const bollingerSqueeze: GlossaryEntry = {
  type: "glossary",
  slug: "bollinger-squeeze",
  term: "Bollinger Squeeze",
  aka: ["volatility squeeze", "Bollinger Band squeeze", "BB squeeze"],
  category: "strategy",
  tldr:
    "A Bollinger squeeze looks for a quiet period when a stock's price range tightens sharply, then trades the breakout that often follows when volatility expands again.",
  metaTitle: "Bollinger Squeeze Explained — Trading the Volatility Breakout | PSX Algos",
  metaDescription:
    "A beginner's guide to the Bollinger squeeze: how shrinking Bollinger Bands signal a calm before a move, a worked example, and how to backtest the breakout on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "A **Bollinger squeeze** is a volatility strategy. It is based on a pattern markets repeat over and over: quiet periods are followed by active ones. When a stock trades in an unusually narrow range — a 'squeeze' — it is often coiling up for a larger move. The strategy waits for that calm, then enters in the direction price breaks once volatility returns.",
    },
    {
      kind: "heading",
      text: "How Bollinger Bands measure the squeeze",
    },
    {
      kind: "para",
      text: "[Bollinger Bands](/learn/bollinger-bands) wrap a stock's price in an upper and a lower band set a couple of standard deviations away from its 20-day average. When the market is calm, the bands pull in close together; when it is volatile, they spread far apart. The distance between the bands is called the bandwidth.",
    },
    {
      kind: "para",
      text: "A squeeze is identified when bandwidth drops to an unusually low level — for example, its narrowest reading in the last 20 days. That is the signal that a stock is unusually quiet. The trade is then triggered when price closes outside a band, suggesting the breakout has begun.",
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
      caption: "Illustrative squeeze — bandwidth tightens, then price breaks the upper band.",
      headers: ["Day", "Close (PKR)", "Band width (PKR)", "What's happening"],
      rows: [
        ["Mon", "150.0", "12.0", "Normal volatility"],
        ["Tue", "150.5", "7.0", "Bands tightening"],
        ["Wed", "150.2", "4.5", "Squeeze — narrowest in 20 days"],
        ["Thu", "154.0", "6.0", "Price closes above upper band — breakout up"],
        ["Fri", "157.5", "9.5", "Volatility expanding, move underway"],
      ],
    },
    {
      kind: "para",
      text: "By Wednesday the band width has shrunk to 4.5 — the tightest in weeks — flagging a squeeze. On Thursday price closes above the upper band and the width starts widening again, so the strategy enters long and rides the expansion.",
    },
    {
      kind: "heading",
      text: "Strengths and limitations",
    },
    {
      kind: "list",
      items: [
        "**Strength — it times the calm before the move.** Rather than chasing, you prepare during the quiet and act when volatility returns.",
        "**Strength — favourable risk shape.** Squeezes tend to break into clean moves, so a tight stop near the squeeze range can pair with a larger potential gain.",
        "**Limitation — direction is unknown in advance.** A squeeze tells you a move is likely, not which way. You have to wait for the break, and sometimes it breaks the 'wrong' way.",
        "**Limitation — false starts.** Price can poke outside a band and fall back. Confirmation — a close beyond the band rather than an intraday touch — reduces these.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "A squeeze signals that a move is coming, not its direction. Many traders wait for the first decisive close outside the bands before committing, and place the stop on the other side of the squeeze range.",
    },
  ],
  productTieIn: {
    heading: "Build a Bollinger squeeze strategy on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "PSX Algos ships a **Bollinger squeeze** starter template, plus ready-made volatility building blocks like band width and %B in the builder. Define your squeeze condition and the breakout trigger, then backtest it across a decade of PSX history to see how the breakouts resolved before trading it live.",
      },
    ],
    cta: { label: "Open the Bollinger Squeeze template →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is a Bollinger squeeze in simple terms?",
      a: "It is when a stock's price range gets unusually narrow, shown by Bollinger Bands pulling close together. It often precedes a larger move, and the strategy trades the breakout that follows.",
    },
    {
      q: "Does a squeeze tell you which way price will break?",
      a: "No. A squeeze signals that a move is likely but not its direction. Traders typically wait for price to close outside a band to confirm the direction before entering.",
    },
    {
      q: "How do you measure a Bollinger squeeze?",
      a: "By the band width — the distance between the upper and lower bands. A squeeze is flagged when band width falls to an unusually low level, such as its narrowest reading over the last 20 days.",
    },
    {
      q: "What is the difference between a squeeze and a breakout strategy?",
      a: "A squeeze focuses on the volatility setup — the quiet period before a move — while a momentum breakout focuses on price clearing a recent high. The two often combine: a squeeze identifies the coil, the breakout confirms the release.",
    },
  ],
  related: [
    { slug: "bollinger-bands", label: "Bollinger Bands" },
    { slug: "atr", label: "ATR (Average True Range)" },
    { slug: "momentum-breakout", label: "Momentum Breakout strategy" },
    { slug: "mean-reversion", label: "Mean Reversion strategy" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
