import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import {
  getStrategies,
  getStrategy,
  listBacktests,
  getBacktestResult,
  type BacktestResultResponse,
  type StrategyResponse,
} from "@/lib/api/strategies";
import { BacktestView } from "./backtest-view";
import { BacktestIndexView, type BacktestIndexRow, type IndexStatus } from "./backtest-index-view";

const MIN_MS = 60_000;

function formatRelative(iso: string | null | undefined): { label: string; minutes: number } {
  if (!iso) return { label: "never", minutes: Number.MAX_SAFE_INTEGER };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { label: "never", minutes: Number.MAX_SAFE_INTEGER };
  const min = Math.max(0, Math.round((Date.now() - t) / MIN_MS));
  if (min < 1) return { label: "just now", minutes: 0 };
  if (min < 60) return { label: `${min}m ago`, minutes: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { label: `${h}h ago`, minutes: min };
  const d = Math.floor(h / 24);
  if (d < 30) return { label: `${d}d ago`, minutes: min };
  const mo = Math.floor(d / 30);
  return { label: `${mo}mo ago`, minutes: min };
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapIndexStatus(s: StrategyResponse["status"]): IndexStatus {
  // Backend ACTIVE → user-facing DEPLOYED (matches /strategies semantics).
  if (s === "ACTIVE") return "DEPLOYED";
  return s;
}

function toIndexRow(s: StrategyResponse): BacktestIndexRow {
  const lb = s.latest_backtest ?? null;
  const { label, minutes } = formatRelative(lb?.completed_at);
  return {
    id: String(s.id),
    name: s.name,
    status: mapIndexStatus(s.status),
    totalReturn: toNum(lb?.total_return_pct),
    sharpe: toNum(lb?.sharpe_ratio ?? null),
    maxDD: toNum(lb?.max_drawdown ?? null),
    totalTrades: lb ? lb.total_trades : null,
    ranLabel: label,
    ranMinutes: minutes,
  };
}

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy_id?: string; backtest_id?: string; run?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/backtest");
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  const { strategy_id, backtest_id, run } = await searchParams;
  const sid = strategy_id ? parseInt(strategy_id, 10) : NaN;
  const autoRun = run === "1";

  // No strategy specified → render the index page (list of all the user's
  // strategies enriched with their latest backtest summary). The list endpoint
  // already JOINs latest_backtest in a single query, so this is one round-trip.
  if (!Number.isFinite(sid) || sid <= 0) {
    let rows: BacktestIndexRow[] = [];
    try {
      const list = await getStrategies(jwt, { page: 1, page_size: 100 });
      rows = list.items.map(toIndexRow);
    } catch (err) {
      console.warn("[/backtest] strategies list failed", err);
    }
    return <BacktestIndexView rows={rows} />;
  }

  // Strategy name for the breadcrumb. Failure here doesn't block the page.
  let strategyName: string | null = null;
  try {
    const s = await getStrategy(jwt, sid);
    strategyName = s.name;
  } catch {
    // Forbidden / not found — let the view render without the name. The
    // run/poll flow will surface the same error if the user actually tries.
  }

  // If a specific backtest_id was provided, hydrate it. Otherwise, fall back
  // to the latest result (if any).
  let initialResult: BacktestResultResponse | null = null;
  try {
    if (backtest_id) {
      const btId = parseInt(backtest_id, 10);
      if (Number.isFinite(btId) && btId > 0) {
        initialResult = await getBacktestResult(jwt, sid, btId);
      }
    }
    if (!initialResult) {
      const list = await listBacktests(jwt, sid, 1);
      const latest = list.items[0];
      if (latest) {
        initialResult = await getBacktestResult(jwt, sid, latest.id);
      }
    }
  } catch (err) {
    // Empty state is fine when there are no prior runs.
    if (!(err instanceof ApiError && err.status === 404)) {
      console.warn("[/backtest] result fetch failed", err);
    }
  }

  return (
    <BacktestView
      strategyId={sid}
      strategyName={strategyName}
      initialResult={initialResult}
      autoRun={autoRun}
    />
  );
}
