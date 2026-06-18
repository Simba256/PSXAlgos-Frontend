import type { GlossaryEntry } from "../types";

export const smaVsEma: GlossaryEntry = {
  type: "glossary",
  slug: "sma-vs-ema",
  term: "SMA vs EMA",
  aka: [
    "simple moving average",
    "exponential moving average",
    "moving averages",
  ],
  category: "indicator",
  tldr:
    "A moving average smooths choppy prices into a single trend line. A simple moving average (SMA) weights every day equally; an exponential moving average (EMA) weights recent days more, so it turns faster.",
  metaTitle: "SMA vs EMA — Simple and Exponential Moving Averages Explained | PSX Algos",
  metaDescription:
    "A beginner's guide to moving averages: how SMA and EMA differ, which reacts faster, a worked example, common periods like 50 and 200, and how to use them on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "A **moving average** is the most basic trend tool in technical analysis. It takes the average closing price over a set number of days and plots it as a line, smoothing out day-to-day noise so the underlying trend stands out. The two most common types are the **simple moving average (SMA)** and the **exponential moving average (EMA)**.",
    },
    {
      kind: "heading",
      text: "Simple moving average (SMA)",
    },
    {
      kind: "para",
      text: "An SMA adds up the closing prices over a period and divides by the number of days. A 5-day SMA of closes 100, 102, 101, 104, 108 is (100 + 102 + 101 + 104 + 108) ÷ 5 = 103. Every day in the window counts equally, so the SMA is smooth and steady — but slow to react when price changes direction, because old prices keep their full weight until they drop out of the window.",
    },
    {
      kind: "heading",
      text: "Exponential moving average (EMA)",
    },
    {
      kind: "para",
      text: "An EMA gives more weight to the most recent prices and less to older ones. That makes it hug price more closely and turn sooner after a move. The trade-off is that it also reacts to short-lived spikes that an SMA would smooth away — faster, but noisier.",
    },
    {
      kind: "heading",
      text: "SMA vs EMA at a glance",
    },
    {
      kind: "table",
      caption: "How the two moving averages compare.",
      headers: ["", "SMA", "EMA"],
      rows: [
        ["Weighting", "All days equal", "Recent days heavier"],
        ["Reaction speed", "Slower", "Faster"],
        ["Noise", "Smoother", "More responsive, choppier"],
        ["Common use", "Long-term trend (50, 200)", "Momentum signals (12, 26)"],
      ],
    },
    {
      kind: "heading",
      text: "Common periods",
    },
    {
      kind: "list",
      items: [
        "**20-day** — short-term trend, popular for swing trading.",
        "**50-day** — the medium-term trend line many traders watch.",
        "**200-day** — the long-term trend; price above it is broadly bullish, below it broadly bearish.",
        "**12 and 26-day EMAs** — the building blocks of [MACD](/learn/macd).",
      ],
    },
    {
      kind: "para",
      text: "When a faster average crosses a slower one, traders read it as a trend change. The most famous example is the [golden cross](/learn/golden-cross), where the 50-day crosses above the 200-day.",
    },
    {
      kind: "callout",
      tone: "info",
      text: "Neither is 'better'. EMAs suit fast momentum strategies that need early signals; SMAs suit longer-term trend filters where you want to ignore noise. Many strategies use both.",
    },
  ],
  productTieIn: {
    heading: "Use moving averages on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "The strategy builder offers SMAs (20, 50, 200) and EMAs (12, 26) as drop-in indicators. The **Golden cross** template uses *SMA(50) crosses above SMA(200)* out of the box — swap in EMAs for faster signals, then backtest the difference across a decade of PSX history.",
      },
    ],
    cta: { label: "Build a moving-average strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is the difference between SMA and EMA?",
      a: "An SMA weights every day in its window equally, making it smooth but slow. An EMA weights recent days more heavily, so it reacts faster to new price moves but is noisier.",
    },
    {
      q: "Which is better, SMA or EMA?",
      a: "Neither is universally better. EMAs are favoured for fast momentum signals where early reaction matters; SMAs are favoured for long-term trend filters where smoothness matters. Many traders use both.",
    },
    {
      q: "What does the 200-day moving average mean?",
      a: "It is the average closing price over the last 200 trading days — roughly a year. Price above it is widely seen as a long-term uptrend, and below it a long-term downtrend.",
    },
    {
      q: "What is a moving average crossover?",
      a: "It is when a faster moving average crosses a slower one. A famous example is the golden cross, where the 50-day crosses above the 200-day, signalling a possible trend change.",
    },
  ],
  related: [
    { slug: "golden-cross", label: "Golden Cross strategy" },
    { slug: "macd", label: "MACD" },
    { slug: "momentum-breakout", label: "Momentum Breakout strategy" },
    { slug: "bollinger-bands", label: "Bollinger Bands" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
