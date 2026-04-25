import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import {
  getStrategy,
  listBacktests,
  getBacktestResult,
  type BacktestResultResponse,
} from "@/lib/api/strategies";
import { BacktestView } from "./backtest-view";

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy_id?: string; backtest_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/backtest");
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  const { strategy_id, backtest_id } = await searchParams;
  const sid = strategy_id ? parseInt(strategy_id, 10) : NaN;

  if (!Number.isFinite(sid) || sid <= 0) {
    return (
      <BacktestView strategyId={null} strategyName={null} initialResult={null} />
    );
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
    />
  );
}
