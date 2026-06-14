// Central registry of all /learn entries. Pages import from here; the sitemap
// and the hub index enumerate from here. Adding a page = author the module and
// add it to ENTRIES — routing, sitemap, and the hub pick it up automatically.
import type { LearnEntry } from "./types";
import { kse100 } from "./glossary/kse-100";
import { freeFloatMarketCap } from "./glossary/free-float-market-cap";
import { kse30 } from "./glossary/kse-30";
import { kmi30 } from "./glossary/kmi-30";
import { kseAllShare } from "./glossary/kse-all-share";
import { settlementCycle } from "./glossary/settlement-cycle";
import { goldenCross } from "./strategies/golden-cross";
import { meanReversion } from "./strategies/mean-reversion";
import { momentumBreakout } from "./strategies/momentum-breakout";
import { bollingerSqueeze } from "./strategies/bollinger-squeeze";
import { macdCrossover } from "./strategies/macd-crossover";

export const ENTRIES: readonly LearnEntry[] = [
  kse100,
  freeFloatMarketCap,
  kse30,
  kmi30,
  kseAllShare,
  settlementCycle,
  goldenCross,
  meanReversion,
  momentumBreakout,
  bollingerSqueeze,
  macdCrossover,
];

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
