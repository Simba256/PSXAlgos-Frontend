import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { getStrategies, type StrategyResponse } from "@/lib/api/strategies";
import { BacktestNewView, type StrategyOption } from "./backtest-new-view";

function toOption(s: StrategyResponse): StrategyOption {
  return { id: s.id, name: s.name, status: s.status };
}

// /backtest/new — backtest configuration + run page. Pulled out of
// backtest-view.tsx so the results page is purely display-only. Reachable
// from:
//   • /backtest index → "Run new backtest" CTA
//   • Strategy editor → "Run backtest" pill (carries strategy_id)
//   • Results page → "Re-run" (carries strategy_id + start/end prefill)
//   • Wizard finish → after-create redirect (carries strategy_id)
// On successful run we redirect to /backtest?strategy_id=N&backtest_id=M so
// the result lands on the dedicated results page.
export default async function BacktestNewPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy_id?: string; start?: string; end?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/backtest/new");
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  const { strategy_id, start, end } = await searchParams;
  const sidRaw = strategy_id ? parseInt(strategy_id, 10) : NaN;
  const initialStrategyId =
    Number.isFinite(sidRaw) && sidRaw > 0 ? sidRaw : null;

  let strategies: StrategyOption[] = [];
  try {
    // page_size 100 covers every plan tier (Pro+ caps at 50). If a user
    // somehow has more we silently truncate — they can still reach the
    // strategy editor and run from there.
    const res = await getStrategies(jwt, { page: 1, page_size: 100 });
    strategies = res.items.map(toOption);
  } catch (err) {
    console.warn("[/backtest/new] strategies list failed", err);
  }

  return (
    <BacktestNewView
      strategies={strategies}
      initialStrategyId={initialStrategyId}
      initialStart={start ?? null}
      initialEnd={end ?? null}
    />
  );
}
