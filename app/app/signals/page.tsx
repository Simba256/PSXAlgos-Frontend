import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { getTodaySignals, type StrategySignal } from "@/lib/api/signals";
import { SignalsView, type Signal } from "./signals-view";

const DAY_MS = 86_400_000;

function ageFromDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function pickRsi(trigger: Record<string, number> | null): number {
  if (!trigger) return 0;
  const raw = trigger.rsi ?? trigger.rsi_14;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.round(raw);
}

function mapSignal(strategyName: string, row: StrategySignal): Signal {
  return {
    id: String(row.id),
    time: row.signal_date,
    strategy: strategyName,
    symbol: row.symbol,
    price: Number(row.trigger_price ?? 0),
    rsi: pickRsi(row.trigger_data),
    conf: 1, // strategy-driven signals are deterministic — no confidence score
    age: ageFromDate(row.signal_date),
    dir: row.signal_type === "SELL" ? "SELL" : "BUY",
  };
}

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/signals");
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  const res = await getTodaySignals(jwt);
  const initialSignals = res.groups.flatMap((group) =>
    group.signals.map((sig) => mapSignal(group.strategy_name, sig)),
  );

  return <SignalsView initialSignals={initialSignals} />;
}
