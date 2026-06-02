// Central registry of all /learn entries. Pages import from here; the sitemap
// and the hub index enumerate from here. Adding a page = author the module and
// add it to ENTRIES — routing, sitemap, and the hub pick it up automatically.
import type { LearnEntry } from "./types";
import { kse100 } from "./glossary/kse-100";
import { freeFloatMarketCap } from "./glossary/free-float-market-cap";

export const ENTRIES: readonly LearnEntry[] = [kse100, freeFloatMarketCap];

const BY_SLUG = new Map(ENTRIES.map((e) => [e.slug, e]));

export function getEntry(slug: string): LearnEntry | undefined {
  return BY_SLUG.get(slug);
}

export function allSlugs(): string[] {
  return ENTRIES.map((e) => e.slug);
}

export function glossaryEntries(): LearnEntry[] {
  return ENTRIES.filter((e) => e.type === "glossary");
}
