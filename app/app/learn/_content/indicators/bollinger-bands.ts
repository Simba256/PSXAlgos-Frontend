import type { GlossaryEntry } from "../types";

export const bollingerBands: GlossaryEntry = {
  type: "glossary",
  slug: "bollinger-bands",
  term: "Bollinger Bands",
  aka: ["Bollinger Band", "BB", "Bollinger %B", "band width"],
  category: "indicator",
  tldr:
    "Bollinger Bands wrap a stock's price in an upper and lower band set a couple of standard deviations from its 20-day average — they widen when the stock is volatile and pinch together when it's calm.",
  metaTitle: "Bollinger Bands Explained — Volatility Bands for Beginners | PSX Algos",
  metaDescription:
    "A clear guide to Bollinger Bands: how the upper, middle, and lower bands work, what %B and band width mean, a worked example, and how to use them on PSX stocks.",
  body: [
    {
      kind: "para",
      text: "**Bollinger Bands**, created by John Bollinger, are a volatility indicator. They draw three lines around price: a middle line that is a 20-day [moving average](/learn/sma-vs-ema), and an upper and lower band placed a set distance above and below it. That distance is based on **standard deviation** — a measure of how spread out recent prices have been.",
    },
    {
      kind: "heading",
      text: "The three lines",
    },
    {
      kind: "list",
      items: [
        "**Middle band** — the 20-day simple moving average, the price's recent centre of gravity.",
        "**Upper band** — the middle band plus two standard deviations of price.",
        "**Lower band** — the middle band minus two standard deviations.",
      ],
    },
    {
      kind: "para",
      text: "Standard deviation simply grows when prices swing widely and shrinks when they are steady. So when a stock gets volatile, the bands spread apart; when it goes quiet, they squeeze in. Roughly speaking, price spends most of its time inside the bands, which is why touches of the outer bands draw attention.",
    },
    {
      kind: "heading",
      text: "Two numbers traders watch",
    },
    {
      kind: "list",
      items: [
        "**%B** — where price sits between the bands. 1.0 means price is at the upper band, 0.0 at the lower, 0.5 at the middle. It is a quick way to gauge how stretched price is.",
        "**Band width** — the distance between the upper and lower bands. A very low band width flags a quiet, coiled market — the setup behind the [Bollinger squeeze](/learn/bollinger-squeeze).",
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
      caption: "Illustrative Bollinger Bands as volatility rises.",
      headers: ["Day", "Close (PKR)", "Lower", "Middle", "Upper", "Read"],
      rows: [
        ["Mon", "150.0", "146", "150", "154", "Calm, price mid-band"],
        ["Tue", "150.5", "147", "150", "153", "Bands tightening"],
        ["Wed", "154.0", "146", "150", "155", "Push toward upper band"],
        ["Thu", "156.0", "144", "151", "158", "Bands widening — volatility up"],
      ],
    },
    {
      kind: "para",
      text: "As the stock breaks higher on Wednesday and Thursday, the bands widen to absorb the bigger swings, and price rides the upper band — a sign of strong, but possibly stretched, momentum.",
    },
    {
      kind: "heading",
      text: "How they are used — and a caution",
    },
    {
      kind: "list",
      items: [
        "**Mean reversion.** In a range, a touch of the lower band can flag an oversold bounce and the upper band an overbought fade.",
        "**Squeeze breakouts.** A pinch in band width often precedes a larger move; traders trade the direction price breaks.",
        "**Caution — a band touch is not a signal by itself.** In a strong trend price can 'walk the band', hugging the upper band the whole way up. Pair the bands with trend context.",
      ],
    },
    {
      kind: "callout",
      tone: "info",
      text: "The default settings are a 20-day average with bands at two standard deviations. Widening to 2.5 makes touches rarer and more meaningful; narrowing makes them more frequent.",
    },
  ],
  productTieIn: {
    heading: "Use Bollinger Bands on PSX Algos",
    blocks: [
      {
        kind: "para",
        text: "Bollinger Bands, %B, and band width are all available in the strategy builder. The **Bollinger squeeze** template uses a band-width contraction to spot quiet, coiled stocks — define your squeeze and breakout rule, then backtest it across a decade of PSX history.",
      },
    ],
    cta: { label: "Build a Bollinger Bands strategy →", href: "/strategies/new" },
  },
  faqs: [
    {
      q: "What are Bollinger Bands in simple terms?",
      a: "They are three lines around price: a 20-day average in the middle, plus an upper and lower band set two standard deviations away. The bands widen when a stock is volatile and pinch together when it is calm.",
    },
    {
      q: "What does %B mean?",
      a: "%B shows where price sits between the bands: 1.0 is the upper band, 0.0 the lower band, and 0.5 the middle. It is a fast way to see how stretched the price is.",
    },
    {
      q: "What is a Bollinger Band squeeze?",
      a: "A squeeze is when band width falls to an unusually low level, signalling a quiet, coiled market. Traders watch for the breakout that often follows when volatility returns.",
    },
    {
      q: "Does a touch of the upper band mean sell?",
      a: "Not on its own. In a strong uptrend price can ride the upper band for a long time. A band touch needs trend context before it becomes a signal.",
    },
  ],
  related: [
    { slug: "bollinger-squeeze", label: "Bollinger Squeeze strategy" },
    { slug: "atr", label: "ATR (Average True Range)" },
    { slug: "mean-reversion", label: "Mean Reversion strategy" },
    { slug: "sma-vs-ema", label: "SMA vs EMA" },
  ],
  author: "PSX Algos",
  published: "2026-06-14",
  updated: "2026-06-14",
};
