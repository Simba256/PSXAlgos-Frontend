import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import {
  getStrategies,
  type StrategyResponse,
  type StockFilters,
} from "@/lib/api/strategies";
import { StrategiesView, type Strategy, type Status } from "./strategies-view";

const MIN_MS = 60_000;

function formatRelative(iso: string | null | undefined): { updated: string; updatedMin: number } {
  if (!iso) return { updated: "—", updatedMin: Number.MAX_SAFE_INTEGER };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { updated: "—", updatedMin: Number.MAX_SAFE_INTEGER };
  const min = Math.max(0, Math.round((Date.now() - t) / MIN_MS));
  if (min < 1) return { updated: "just now", updatedMin: 0 };
  if (min < 60) return { updated: `${min}m ago`, updatedMin: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { updated: `${h}h ago`, updatedMin: min };
  const d = Math.floor(h / 24);
  if (d < 30) return { updated: `${d}d ago`, updatedMin: min };
  const mo = Math.floor(d / 30);
  return { updated: `${mo}mo ago`, updatedMin: min };
}

function deriveUniverse(filters: StockFilters | null | undefined, symbols: string[] | null | undefined): string {
  if (symbols && symbols.length > 0) {
    if (symbols.length <= 2) return symbols.join(", ");
    return `${symbols.length} symbols`;
  }
  if (filters?.sectors && filters.sectors.length > 0) {
    if (filters.sectors.length === 1) return filters.sectors[0];
    return `${filters.sectors.length} sectors`;
  }
  return "KSE-100";
}

function mapStatus(s: StrategyResponse["status"]): Status {
  // Backend ACTIVE maps to UI's DEPLOYED — the user-facing word for "currently
  // running and producing signals". DRAFT/PAUSED/ARCHIVED pass through.
  if (s === "ACTIVE") return "DEPLOYED";
  return s;
}

function mapStrategy(s: StrategyResponse): Strategy {
  // Phase 3.2 list-only deferral: `signals` (today count), `bt` (latest
  // backtest %), `sharpe`, and `outputs` are not on the bare StrategyResponse
  // and would require N+1 fetches against /strategy-signals and
  // /strategies/{id}/backtests per row. They render as their empty sentinels
  // (0 / "—" / null / []) until the enrichment ticket lands.
  const { updated, updatedMin } = formatRelative(s.updated_at);
  return {
    id: String(s.id),
    name: s.name,
    type: "Custom",
    status: mapStatus(s.status),
    signals: 0,
    bt: "—",
    sharpe: null,
    outputs: [],
    universe: deriveUniverse(s.stock_filters, s.stock_symbols),
    updated,
    updatedMin,
  };
}

export default async function StrategiesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/strategies");
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  const res = await getStrategies(jwt, { page: 1, page_size: 100 });
  const initialStrategies = res.items.map(mapStrategy);

  return <StrategiesView initialStrategies={initialStrategies} />;
}
