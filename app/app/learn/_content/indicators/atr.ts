import type { GlossaryEntry } from "../types";

export const atr: GlossaryEntry = {
  type: "glossary",
  slug: "atr",
  term: "ATR (Average True Range)",
  aka: ["ATR", "Average True Range", "ATR percent"],
  category: "indicator",
  tldr:
    "ATR measures how much a stock typically moves in a day, in rupees. It is a plain volatility gauge — used mostly to size stops and positions, not to predict direction.",
  metaTitle: "ATR Explained — Average True Range for Beginners | PSX Algos",
  metaDescription:
    "A clear guide to ATR (Average True Range): how it measures daily volatility, how traders use it to set stop-losses, a worked example, and how to use it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "**Average True Range (ATR)**, another J. Welles Wilder indicator, answers a simple question: how much does this stock usually move in a day? It expresses volatility as an amount — for a PSX stock, a number of rupees — rather than as a direction. A stock with an ATR of 4 typically swings about PKR 4 a day; one with an ATR of 0.5 barely moves.",
    },
    {
      kind: "heading",
      text: "What 'true range' means",
    },
    {
      kind: "para",
      text: "Each day's **true range** is the largest of three distances: today's high minus today's low, today's high minus yesterday's close, or yesterday's close minus today's low. Using the previous close captures overnight gaps that a simple high-minus-low would miss. ATR is then the average of the true range over a period — usually 14 days.",
    },
    {
      kind: "heading",
      text: "Why traders care about ATR",
    },
    {
      kind: "list",
      items: [
        "**Setting stop-losses.** A stop placed a fixed number of rupees away ignores how volatile the stock is. A stop placed a multiple of ATR away — say entry minus 2 × ATR — adapts: wider for jumpy stocks, tighter for calm ones.",
        "**Position sizing.** Knowing a stock's typical daily move helps you size a trade so a normal day's swing does not blow past your risk limit.",
        "**Comparing volatility.** ATR % (ATR divided by price) lets you compare a PKR 50 stock and a PKR 500 stock on the same scale.",
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
      caption: "Illustrative ATR-based stop placement.",
      headers: ["Item", "Value", "Note"],
      rows: [
        ["Entry price", "PKR 120.0", "Where you buy"],
        ["ATR(14)", "PKR 3.5", "Typical daily move"],
        ["Stop distance", "2 × ATR = PKR 7.0", "Room for normal noise"],
        ["Stop-loss", "PKR 113.0", "Entry − 7.0"],
      ],
    },
    {
      kind: "para",
      text: "Here the stock normally moves about PKR 3.5 a day, so a stop PKR 7 below entry gives the trade room to breathe without being shaken out by an ordinary day's wobble. If ATR were larger, the same logic would set the stop further away.",
    },
    {
      kind: "heading",
      text: "What ATR does not tell you",
    },
    {
      kind: "list",
      items: [
        "**No direction.** ATR rises whether a stock is crashing or soaring — it only measures the size of the move, never which way.",
        "**It is relative.** An ATR of 4 is large for a PKR 50 stock and tiny for a PKR 5,000 one. Use ATR % when comparing names.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "Because it has no direction, ATR is almost always used alongside a directional signal — a trend or momentum indicator decides whether to trade, ATR decides how much room to give it.",
    },
  ],
  productTieIn: {
    heading: "Use ATR on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "ATR and ATR % are built into the strategy builder, including ready-made ATR-based trailing-stop presets (for example, a 2× or 3× ATR trailing stop). Pair ATR exits with any entry signal, then backtest the whole rule across a decade of PSX history to see how the stops would have behaved.",
      },
    ],
    cta: { label: "Build a strategy with ATR stops →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is ATR in simple terms?",
      a: "ATR (Average True Range) measures how much a stock typically moves in a day, expressed as an amount of money. It is a volatility gauge, not a direction signal.",
    },
    {
      q: "How do traders use ATR for stop-losses?",
      a: "They place the stop a multiple of ATR away from entry — for example, entry minus 2 × ATR. This makes the stop wider for volatile stocks and tighter for calm ones, so normal daily noise does not trigger it.",
    },
    {
      q: "Does ATR tell you if a stock will go up or down?",
      a: "No. ATR only measures the size of price moves, not their direction. It rises in both strong rallies and sharp sell-offs, so it is used alongside a directional indicator.",
    },
    {
      q: "What is ATR percent?",
      a: "ATR % is ATR divided by the stock's price. It lets you compare volatility across stocks of very different prices on the same scale.",
    },
  ],
  related: [
    { slug: "bollinger-bands", label: "Bollinger Bands" },
    { slug: "momentum-breakout", label: "Momentum Breakout strategy" },
    { slug: "bollinger-squeeze", label: "Bollinger Squeeze strategy" },
    { slug: "rsi", label: "RSI (Relative Strength Index)" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
