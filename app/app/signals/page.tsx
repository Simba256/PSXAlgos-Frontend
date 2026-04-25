import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { getSignals, type TradingSignalWithSymbol } from "@/lib/api/signals";
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

function mapSignal(row: TradingSignalWithSymbol, idx: number): Signal {
  const dir: "BUY" | "SELL" = row.signal_type === "SELL" ? "SELL" : "BUY";
  return {
    id: `${row.symbol}-${idx}`,
    time: row.signal_date,
    strategy: row.strength_label || row.time_horizon || "Signal",
    symbol: row.symbol,
    price: Number(row.entry_price ?? 0),
    rsi: row.rsi_value != null ? Math.round(Number(row.rsi_value)) : 0,
    conf: Number(row.confidence) / 100,
    age: ageFromDate(row.signal_date),
    dir,
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

  const res = await getSignals(jwt, { active_only: true, limit: 50 });
  const initialSignals = res.items.map(mapSignal);

  return <SignalsView initialSignals={initialSignals} />;
}
