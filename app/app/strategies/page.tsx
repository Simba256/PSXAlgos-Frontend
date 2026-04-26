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

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapStrategy(s: StrategyResponse): Strategy {
  // Both `latest_backtest` and `signals_today` are populated by the list
  // endpoint via LEFT JOINs (single query, no N+1). Strategies that have
  // never been backtested return null + the "—" sentinel; strategies that
  // produced no signals today return signals_today=0.
  const lb = s.latest_backtest ?? null;
  const totalReturn = toNum(lb?.total_return_pct);
  const sharpeNum = toNum(lb?.sharpe_ratio);
  const bt =
    totalReturn === null
      ? "—"
      : `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`;
  const { updated, updatedMin } = formatRelative(s.updated_at);
  return {
    id: String(s.id),
    name: s.name,
    type: "Custom",
    status: mapStatus(s.status),
    signals: s.signals_today ?? 0,
    bt,
    sharpe: sharpeNum,
    outputs: lb ? ["bt"] : [],
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
