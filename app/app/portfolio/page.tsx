import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import {
  getOpenPositions,
  getClosedTrades,
  type OpenPositionResponse,
  type ClosedTradeResponse,
  type JournalCloseReason,
} from "@/lib/api/portfolio";
import { getAllStocks } from "@/lib/api/stocks";
import { getStrategies } from "@/lib/api/strategies";
import type { ClosedTrade, CloseReason, OpenPosition, TradeSource } from "@/lib/portfolio-csv";
import { PortfolioView, type SymbolOption, type StrategyOption } from "./portfolio-view";

// The journal-page UI types (in lib/portfolio-csv.ts) predate the backend
// contract — they use sym/qty/entry/now and lowercase source. The backend
// returns symbol/quantity/entry_price/current_price and UPPER_SNAKE enums.
// These adapters keep the existing view layer untouched while the page
// switches to live data.

function num(d: string | number | null | undefined, fallback = 0): number {
  if (d === null || d === undefined) return fallback;
  const n = typeof d === "number" ? d : Number(d);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function mapSource(s: OpenPositionResponse["source"]): TradeSource {
  return s === "SIGNAL" ? "signal" : "manual";
}

function mapCloseReason(r: JournalCloseReason): CloseReason {
  if (r === "STOP_LOSS") return "Stop loss";
  if (r === "TARGET_HIT") return "Target hit";
  return "Manual close";
}

function mapPosition(p: OpenPositionResponse): OpenPosition {
  const entry = num(p.entry_price);
  // current_price falls back to entry so the UI's now-vs-entry math still
  // renders 0% PnL (instead of -100%) when no EOD data exists yet.
  const now = p.current_price === null || p.current_price === undefined ? entry : num(p.current_price, entry);
  return {
    id: String(p.id),
    sym: p.symbol,
    qty: p.quantity,
    entry,
    now,
    source: mapSource(p.source),
    strat: p.strategy_name ?? null,
    date: formatDate(p.opened_at),
    stop: num(p.stop_price),
    target: num(p.target_price),
  };
}

function mapClosed(c: ClosedTradeResponse): ClosedTrade {
  return {
    id: String(c.id),
    sym: c.symbol,
    qty: c.quantity,
    entry: num(c.entry_price),
    exit: num(c.exit_price),
    pnl: num(c.pnl),
    ret: num(c.return_pct),
    date: formatDate(c.closed_at),
    reason: mapCloseReason(c.close_reason),
    source: mapSource(c.source),
    strat: c.strategy_name ?? null,
  };
}

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/portfolio");
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  // Stocks fetch is paginated and the strategies endpoint may 403 for free
  // users — neither failure should block /portfolio from rendering, so each
  // is wrapped to a degraded fallback instead of throwing.
  const [openRes, closedRes, stocks, strategies] = await Promise.all([
    getOpenPositions(jwt),
    getClosedTrades(jwt, { limit: 100 }),
    getAllStocks().catch(() => []),
    getStrategies(jwt).catch(() => ({ items: [], total: 0, page: 1, page_size: 0, total_pages: 0 })),
  ]);

  const symbolOptions: SymbolOption[] = stocks
    .filter((s) => s.is_active && s.symbol)
    .map((s) => ({ symbol: s.symbol, name: s.name ?? null }));

  // Build a symbol → sector_name lookup from the same /stocks payload that
  // already feeds the symbol autocomplete. Replaces a hardcoded ~25-entry
  // SECTOR_MAP that bucketed every other ticker as "Other".
  const sectorMap: Record<string, string> = {};
  for (const s of stocks) {
    if (s.symbol && s.sector_name) sectorMap[s.symbol] = s.sector_name;
  }

  const strategyOptions: StrategyOption[] = strategies.items.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }));

  return (
    <PortfolioView
      initialPositions={openRes.positions.map(mapPosition)}
      initialClosed={closedRes.trades.map(mapClosed)}
      symbolOptions={symbolOptions}
      strategyOptions={strategyOptions}
      sectorMap={sectorMap}
    />
  );
}
