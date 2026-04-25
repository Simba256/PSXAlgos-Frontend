import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { getBots, type BotResponse } from "@/lib/api/bots";
import { BotsView } from "./bots-view";

interface BotRow {
  id: string;
  name: string;
  strat: string;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  equity: number;
  start: number;
  pnl: number;
  today: number;
  open: number;
  trades: number;
  uptime: string;
}

function uptime(b: BotResponse): string {
  if (b.status !== "ACTIVE" || !b.started_at) return "—";
  const t = new Date(b.started_at).getTime();
  if (Number.isNaN(t)) return "—";
  const totalMin = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h - d * 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

function num(v: BotResponse["allocated_capital"] | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function mapBot(b: BotResponse): BotRow {
  // Backend ACTIVE → UI RUNNING (matches the existing label vocabulary).
  const status: BotRow["status"] =
    b.status === "ACTIVE" ? "RUNNING" : (b.status as "PAUSED" | "STOPPED");
  const allocated = num(b.allocated_capital);
  return {
    id: String(b.id),
    name: b.name,
    strat: b.strategy_name ?? "—",
    status,
    equity: num(b.total_equity ?? b.allocated_capital),
    start: allocated,
    pnl: num(b.total_return_pct),
    // daily_pnl is on BotDetailResponse, not BotResponse — list shows "today"
    // as 0 until users open a bot's detail page. Documented in tracker.
    today: 0,
    open: b.open_positions_count ?? 0,
    trades: b.total_trades ?? 0,
    uptime: uptime(b),
  };
}

export default async function BotsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/bots");
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  const res = await getBots(jwt);
  const initialBots = res.items.map(mapBot);
  return <BotsView initialBots={initialBots} />;
}
