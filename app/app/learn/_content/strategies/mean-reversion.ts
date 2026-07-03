import type { GlossaryEntry } from "../types";

export const meanReversion: GlossaryEntry = {
  type: "glossary",
  slug: "mean-reversion",
  term: "Mean Reversion",
  aka: ["reversion to the mean", "RSI bounce", "oversold bounce"],
  category: "strategy",
  tldr:
    "Mean reversion is the idea that a price stretched far from its recent average tends to snap back toward it — so traders buy when a stock looks unusually oversold and sell as it returns to normal.",
  metaTitle: "Mean Reversion Explained — The Oversold Bounce Strategy | PSX Algos",
  metaDescription:
    "A beginner's guide to mean reversion trading: why prices revert to their average, how RSI flags oversold stocks, a worked example, and how to backtest it on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "**Mean reversion** is built on a simple observation: prices that move sharply away from their typical level often drift back toward it. A stock that drops far below its recent average may be oversold — sold off more than the news justifies — and a bounce back toward the average becomes likely. Mean-reversion traders try to buy that dip and exit as the price normalises.",
    },
    {
      kind: "para",
      text: "This is the opposite mindset to trend-following. A trend-follower buys strength; a mean-reversion trader buys weakness, betting it is temporary. The hard part is telling a temporary dip apart from the start of a real decline — which is why this approach leans heavily on confirmation and risk controls.",
    },
    {
      kind: "heading",
      text: "How RSI flags the entry",
    },
    {
      kind: "para",
      text: "The most common trigger is the [Relative Strength Index (RSI)](/learn/rsi), a momentum gauge that runs from 0 to 100. A reading below 30 is traditionally called oversold. The classic mean-reversion rule is: enter when RSI(14) falls below 30, then exit as RSI climbs back toward the middle of its range.",
    },
    {
      kind: "para",
      text: "Because thin stocks can stay oversold for a long time, many traders add a confirmation that real buyers are stepping in — for example, volume rising well above its 20-day average on the bounce day.",
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
      caption: "Illustrative mean-reversion entry — RSI dips below 30, then recovers.",
      headers: ["Day", "Close (PKR)", "RSI(14)", "Signal"],
      rows: [
        ["Mon", "96.0", "34", "Weak but not oversold"],
        ["Tue", "92.5", "28", "RSI below 30 — oversold, entry condition met"],
        ["Wed", "93.8", "33", "Bounce begins, position held"],
        ["Thu", "97.2", "45", "Reverting toward the mean"],
        ["Fri", "100.5", "55", "Back to normal — exit zone"],
      ],
    },
    {
      kind: "para",
      text: "On Tuesday RSI drops to 28, below the 30 threshold, so the strategy enters. Over the next three days the price reverts from 92.5 back to 100.5 and RSI returns to the mid-50s — the bounce the strategy was waiting for.",
    },
    {
      kind: "heading",
      text: "Strengths and limitations",
    },
    {
      kind: "list",
      items: [
        "**Strength — many small wins.** Reversion setups happen often, and bounces can be quick, so the approach can trade frequently in range-bound markets.",
        "**Strength — good entry prices.** You are buying after a drop, so your entry is often near a short-term low.",
        "**Limitation — it fights strong trends.** In a genuine downtrend, 'oversold' can get more oversold. Buying every dip in a falling stock is how reversion traders get hurt.",
        "**Limitation — needs tight risk control.** Because a failed reversion can keep falling, a stop-loss is essential to cap the loss on the trades that do not bounce.",
      ],
    },
    {
      kind: "callout",
      tone: "warn",
      text: "Oversold does not mean cheap. A stock can stay below 30 RSI for weeks during a real decline. Confirmation (like a volume surge) and a stop-loss are what keep a mean-reversion strategy honest.",
    },
  ],
  productTieIn: {
    heading: "Build a mean-reversion strategy on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "PSX Algos ships a **Mean reversion** starter template wired with *RSI(14) below 30*. Add a volume-confirmation filter, set an exit and a stop-loss, then backtest it across a decade of PSX history to see how the oversold bounces would have played out before committing real money.",
      },
    ],
    cta: { label: "Open the Mean Reversion template →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What is mean reversion in simple terms?",
      a: "It is the idea that a price which has moved far from its average tends to move back toward it. Traders buy when a stock looks unusually oversold and sell as it returns to normal.",
    },
    {
      q: "What RSI level signals oversold?",
      a: "An RSI reading below 30 is traditionally treated as oversold and is the classic trigger for a mean-reversion entry. Some traders use a stricter level such as 25 for thin stocks.",
    },
    {
      q: "When does mean reversion fail?",
      a: "It struggles in strong trends. In a genuine downtrend a stock can stay oversold and keep falling, so a reversion entry without a stop-loss can lead to large losses.",
    },
    {
      q: "How is mean reversion different from momentum trading?",
      a: "Mean reversion buys weakness expecting a bounce; momentum trading buys strength expecting it to continue. They are opposite styles and tend to work in different market conditions.",
    },
  ],
  related: [
    { slug: "rsi", label: "RSI (Relative Strength Index)" },
    { slug: "momentum-breakout", label: "Momentum Breakout strategy" },
    { slug: "bollinger-squeeze", label: "Bollinger Squeeze strategy" },
    { slug: "golden-cross", label: "Golden Cross strategy" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
