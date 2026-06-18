import type { GlossaryEntry } from "../types";

export const rsi: GlossaryEntry = {
  type: "glossary",
  slug: "rsi",
  term: "RSI (Relative Strength Index)",
  aka: ["RSI", "Relative Strength Index", "RSI 14"],
  category: "indicator",
  tldr:
    "RSI is a momentum indicator on a 0–100 scale that shows whether a stock has been bought or sold too hard recently — below 30 is traditionally oversold, above 70 overbought.",
  metaTitle: "RSI Explained — The Relative Strength Index for Beginners | PSX Algos",
  metaDescription:
    "A clear guide to RSI (Relative Strength Index): how the 0–100 momentum gauge works, what overbought and oversold mean, a worked example, and how to use it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "The **Relative Strength Index (RSI)** is one of the most widely used momentum indicators. It compresses a stock's recent gains and losses into a single number between 0 and 100, telling you how strong the recent buying or selling has been. It was designed by J. Welles Wilder and is normally calculated over the last 14 trading days, written as RSI(14).",
    },
    {
      kind: "heading",
      text: "Reading the 0–100 scale",
    },
    {
      kind: "list",
      items: [
        "**Below 30 — oversold.** The stock has fallen hard and may be due for a bounce. This is the classic signal for a [mean-reversion](/learn/mean-reversion) buy.",
        "**Above 70 — overbought.** The stock has risen hard and momentum may be stretched. Some traders take profits or wait for a pullback.",
        "**Around 50 — neutral.** Gains and losses are roughly balanced; no momentum extreme.",
      ],
    },
    {
      kind: "para",
      text: "RSI rises as a stock strings together up days and falls as down days pile up. Because it is bounded between 0 and 100, it never runs off the chart the way price can — which is what makes the 30 and 70 lines such handy reference points.",
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
      caption: "Illustrative RSI(14) as a stock sells off and then recovers.",
      headers: ["Day", "Close (PKR)", "RSI(14)", "Read"],
      rows: [
        ["Mon", "104.0", "62", "Healthy, not extreme"],
        ["Tue", "99.0", "44", "Cooling off"],
        ["Wed", "94.0", "29", "Oversold — below 30"],
        ["Thu", "96.5", "38", "Bouncing"],
        ["Fri", "101.0", "54", "Back to neutral"],
      ],
    },
    {
      kind: "para",
      text: "On Wednesday RSI drops to 29 — below the 30 line — flagging an oversold condition. Over the next two days the stock recovers and RSI climbs back to the mid-50s. A mean-reversion trader would watch exactly this kind of dip-and-recover.",
    },
    {
      kind: "heading",
      text: "What RSI does not tell you",
    },
    {
      kind: "list",
      items: [
        "**Oversold can stay oversold.** In a strong downtrend, RSI can sit below 30 for weeks. A low reading is a heads-up, not an automatic buy.",
        "**Overbought can keep rising.** In a powerful uptrend, RSI can hold above 70 while the stock keeps climbing. Selling purely because RSI is high can mean exiting a winner early.",
        "**It is one input.** RSI works best combined with trend context and a confirmation like volume — not used alone.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "A common refinement is RSI divergence: price makes a new low but RSI makes a higher low, hinting that selling pressure is easing. It is a more advanced read, but it builds on the same 0–100 gauge.",
    },
  ],
  productTieIn: {
    heading: "Use RSI on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "RSI is a built-in indicator in the PSX Algos strategy builder. The **Mean reversion** starter template already uses *RSI(14) below 30* as its entry. You can change the threshold, add a volume confirmation, then backtest the rule across a decade of PSX history — all without code.",
      },
    ],
    cta: { label: "Build an RSI strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is RSI in simple terms?",
      a: "RSI is a momentum gauge from 0 to 100. It shows whether a stock has been bought or sold too aggressively lately — below 30 is oversold, above 70 is overbought.",
    },
    {
      q: "What RSI level is oversold?",
      a: "An RSI reading below 30 is traditionally considered oversold. Some traders use a stricter level like 25 for volatile or thinly traded stocks.",
    },
    {
      q: "Is a low RSI always a buy signal?",
      a: "No. In a strong downtrend RSI can stay below 30 for a long time while the stock keeps falling. RSI works best with trend context, confirmation, and a stop-loss.",
    },
    {
      q: "What period is RSI usually calculated over?",
      a: "The standard is 14 trading days, written RSI(14). Shorter periods make it more sensitive and noisier; longer periods make it smoother and slower.",
    },
  ],
  related: [
    { slug: "mean-reversion", label: "Mean Reversion strategy" },
    { slug: "macd", label: "MACD" },
    { slug: "bollinger-bands", label: "Bollinger Bands" },
    { slug: "sma-vs-ema", label: "SMA vs EMA" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
