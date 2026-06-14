// Typed content model for /learn. Content is data, not MDX: each entry is a
// plain typed object so (a) the rendered page stays inside the inline-token
// design system via <LearnArticle>, and (b) JSON-LD is generated from the same
// source of truth — no drift between what a human reads and what a crawler
// parses. See docs/CONTENT_GEO_PLAN.md.

// Rich-text is a small block union. Inline emphasis is supported via **bold**
// and [label](/href) markers, parsed by the renderer. Kept deliberately small —
// add block kinds only when a real page needs one.
export type Block =
  | { kind: "para"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { kind: "callout"; tone?: "info" | "warn"; text: string };

export interface Faq {
  q: string;
  a: string;
}

export interface RelatedRef {
  /** slug of another learn entry, e.g. "kse-30" → /learn/kse-30 */
  slug: string;
  label: string;
}

export type GlossaryCategory =
  | "basics" // what is a stock, an index, a strategy, a backtest
  | "index" // KSE-100, KSE-30, KMI-30, KSE All-Share
  | "structure" // T+2, circuit breaker, free float
  | "indicator" // RSI, MACD, ATR, ...
  | "strategy" // golden cross, mean reversion, momentum breakout
  | "tax" // capital gains tax on PSX
  | "account"; // CDC account, broker account

export interface GlossaryEntry {
  type: "glossary";
  slug: string;
  /** H1 + DefinedTerm name */
  term: string;
  /** alternate names / abbreviations for DefinedTerm.alternateName */
  aka?: string[];
  category: GlossaryCategory;
  /** One-sentence definition rendered as the TL;DR and used as the
   *  DefinedTerm description — this is the snippet answer engines lift. */
  tldr: string;
  metaTitle: string;
  metaDescription: string;
  /** Main "what is it" body — paragraphs, a worked example table, etc. */
  body: Block[];
  /** Optional product tie-in, rendered in a distinct card. `cta` controls the
   *  call-to-action link; defaults to the strategy builder when omitted. */
  productTieIn?: {
    heading: string;
    blocks: Block[];
    cta?: { label: string; href: string };
  };
  faqs: Faq[];
  related: RelatedRef[];
  author: string;
  /** ISO date (YYYY-MM-DD) */
  published: string;
  /** ISO date (YYYY-MM-DD) */
  updated: string;
}

// Phase 1 ships glossary only. GuideEntry lands in Phase 2; the union keeps
// the registry forward-compatible without a refactor.
export type LearnEntry = GlossaryEntry;
