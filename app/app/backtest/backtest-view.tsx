"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import type {
  BacktestEquityPoint,
  BacktestResultResponse,
  EffectiveRiskResolution,
  EffectiveRiskSnapshot,
} from "@/lib/api/strategies";
import {
  Btn,
  EditorialHeader,
  FlashToast,
  Lede,
  Ribbon,
  TerminalTable,
  useFlash,
  type Col,
} from "@/components/atoms";
import { EquityCurve } from "@/components/charts";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";

type TradeFilter = "all" | "wins" | "losses";

interface Trade {
  n: number;
  sym: string;
  dir: "BUY" | "SELL";
  entry: string;
  exit: string;
  qty: string;
  pnl: string;
  ret: string;
  hold: string;
  reason: string;
  outcome: "win" | "loss" | "open";
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function fmtPctSigned(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtPctAbs(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtPkr(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "−";
  return `${sign}PKR ${Math.round(Math.abs(v)).toLocaleString()}`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

// Header range formatter. Includes year on the boundary that needs it so a
// multi-year backtest doesn't collapse to "May 01 → May 01" (the bug the
// terse formatter has). When start/end share a year, the year is shown
// once on the right; when they differ, both sides carry their year.
function formatRangeDate(iso: string, withYear: boolean): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function formatRangeHeader(startIso: string, endIso: string): string {
  const sd = new Date(startIso);
  const ed = new Date(endIso);
  if (isNaN(sd.getTime()) || isNaN(ed.getTime())) {
    return `${startIso} → ${endIso}`;
  }
  const sameYear = sd.getFullYear() === ed.getFullYear();
  const left = formatRangeDate(startIso, !sameYear);
  const right = formatRangeDate(endIso, true);
  return `${left} → ${right}`;
}

function formatRan(ms: number): string {
  if (ms < 1000) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

// Bucket equity_curve by year-month, take the last close per month, then
// compute month-over-month % change. Backend doesn't ship monthly_returns
// directly so we derive it here. Returns the most recent 12 buckets.
function computeMonthlyReturns(
  equity_curve: BacktestEquityPoint[] | null | undefined,
): Array<{ label: string; pct: number }> {
  if (!equity_curve || equity_curve.length === 0) return [];
  const buckets = new Map<string, { date: Date; equity: number }>();
  for (const p of equity_curve) {
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const eq = num(p.equity);
    const prev = buckets.get(key);
    if (!prev || d > prev.date) buckets.set(key, { date: d, equity: eq });
  }
  const sorted = Array.from(buckets.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const out: Array<{ label: string; pct: number }> = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].equity;
    const cur = sorted[i].equity;
    if (prev <= 0) continue;
    const pct = (cur / prev - 1) * 100;
    const label = sorted[i].date
      .toLocaleDateString("en-US", { month: "short" })
      .charAt(0);
    out.push({ label, pct });
  }
  return out.slice(-12);
}

interface PnlBin {
  lower: number;
  upper: number;
  count: number;
}

function computePnlHistogram(
  trades: BacktestResultResponse["trades"],
  binCount = 20,
): { bins: PnlBin[]; maxCount: number; min: number; max: number } | null {
  if (!trades || trades.length < 4) return null;
  const values = trades.map((t) => num(t.pnl));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const step = (max - min) / binCount;
  const bins: PnlBin[] = Array.from({ length: binCount }, (_, i) => ({
    lower: min + i * step,
    upper: i === binCount - 1 ? max : min + (i + 1) * step,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / step);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  const maxCount = bins.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return { bins, maxCount, min, max };
}

interface HoldBucket {
  label: string;
  color: string;
  count: number;
}

function computeHoldBuckets(
  trades: BacktestResultResponse["trades"],
  T: ReturnType<typeof useT>,
): { buckets: HoldBucket[]; maxCount: number } {
  const defs: Array<{ label: string; match: (h: number) => boolean; color: string }> = [
    { label: "<1d", match: (h) => h < 1, color: T.gain },
    { label: "1–5d", match: (h) => h >= 1 && h < 6, color: T.primaryLight },
    { label: "5–20d", match: (h) => h >= 6 && h < 21, color: T.primary },
    { label: "20d+", match: (h) => h >= 21, color: T.text3 },
  ];
  const buckets: HoldBucket[] = defs.map((d) => ({ label: d.label, color: d.color, count: 0 }));
  if (trades) {
    for (const t of trades) {
      const h = num(t.holding_days);
      const idx = defs.findIndex((d) => d.match(h));
      if (idx >= 0) buckets[idx].count += 1;
    }
  }
  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return { buckets, maxCount };
}

interface ExitSegment {
  reason: string;
  label: string;
  color: string;
  count: number;
}

function computeExitReasonBreakdown(
  trades: BacktestResultResponse["trades"],
  T: ReturnType<typeof useT>,
): { segments: ExitSegment[]; total: number } {
  const meta: Record<string, { label: string; color: string }> = {
    take_profit: { label: "Take profit", color: T.gain },
    stop_loss: { label: "Stop loss", color: T.loss },
    trailing_stop: { label: "Trailing stop", color: T.primaryLight },
    max_holding: { label: "Time stop", color: T.text3 },
    signal: { label: "Signal exit", color: T.primaryContainer },
    end_of_backtest: { label: "Forced close", color: T.outline },
  };
  const counts = new Map<string, number>();
  if (trades) {
    for (const t of trades) {
      counts.set(t.exit_reason, (counts.get(t.exit_reason) ?? 0) + 1);
    }
  }
  const segments: ExitSegment[] = Array.from(counts.entries()).map(([reason, count]) => {
    const m = meta[reason] ?? { label: reason, color: T.outline };
    return { reason, label: m.label, color: m.color, count };
  });
  segments.sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return { segments, total };
}

function resultToTrades(result: BacktestResultResponse | null): Trade[] {
  if (!result?.trades) return [];
  return result.trades.map((t, i) => {
    const pnl = num(t.pnl);
    const ret = num(t.pnl_pct);
    const outcome: Trade["outcome"] = pnl > 0 ? "win" : pnl < 0 ? "loss" : "open";
    return {
      n: i + 1,
      sym: t.symbol,
      dir: (t.side === "SELL" ? "SELL" : "BUY") as Trade["dir"],
      entry: `${formatDateLabel(t.entry_date)} · ${num(t.entry_price).toFixed(2)}`,
      exit: `${formatDateLabel(t.exit_date)} · ${num(t.exit_price).toFixed(2)}`,
      qty: t.quantity.toLocaleString(),
      pnl: `${pnl >= 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}`,
      ret: `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%`,
      hold: `${t.holding_days}d`,
      reason: t.exit_reason,
      outcome,
    };
  });
}

export function BacktestView({
  strategyId,
  strategyName,
  initialResult,
}: {
  strategyId: number | null;
  strategyName: string | null;
  initialResult: BacktestResultResponse | null;
}) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  // Run lifecycle now lives on /backtest/new — this view is purely for
  // displaying a stored result. `result` is set once from the server-fetched
  // initialResult and never mutated locally.
  const result = initialResult;
  const lastRun = useMemo<number>(() => {
    if (initialResult?.created_at) {
      const t = new Date(initialResult.created_at).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return Date.now();
  }, [initialResult?.created_at]);
  const [benchmarkSaved, setBenchmarkSaved] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [filter, setFilter] = useState<TradeFilter>("all");
  const { flash, setFlash } = useFlash();
  const [ranLabel, setRanLabel] = useState<string>(
    initialResult ? `ran ${formatRan(Date.now() - lastRun)}` : "no run yet",
  );

  useEffect(() => {
    if (!result) return;
    const tick = () => setRanLabel(`ran ${formatRan(Date.now() - lastRun)}`);
    tick();
    const iv = setInterval(tick, 10_000);
    return () => clearInterval(iv);
  }, [lastRun, result]);

  // Re-run pre-fills the run page with the saved result's window, so the
  // user can tweak it (or just click Run again) instead of remembering the
  // exact dates.
  const rerunHref = strategyId
    ? `/backtest/new?strategy_id=${strategyId}` +
      (result?.start_date ? `&start=${result.start_date}` : "") +
      (result?.end_date ? `&end=${result.end_date}` : "")
    : "/backtest";

  const handleSaveBenchmark = () => {
    setBenchmarkSaved((b) => {
      const next = !b;
      setFlash(next ? "Saved as benchmark · v1" : "Benchmark removed");
      return next;
    });
  };

  const handleDeploy = async () => {
    if (!strategyId) {
      setFlash("Open a strategy to deploy");
      return;
    }
    const next = !deployed;
    setDeployed(next);
    try {
      const res = await fetch(`/api/strategies/${strategyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "ACTIVE" : "PAUSED" }),
      });
      if (!res.ok) throw new Error(`Deploy failed (${res.status})`);
      setFlash(next ? "Strategy deployed · live signals active" : "Strategy paused · signals halted");
    } catch (err) {
      setDeployed(!next);
      setFlash(err instanceof Error ? err.message : "Deploy failed");
    }
  };

  const allTrades = useMemo(() => resultToTrades(result), [result]);
  const totalTrades = result?.total_trades ?? 0;
  const wins = result?.winning_trades ?? 0;
  const losses = result?.losing_trades ?? 0;

  const visibleTrades = useMemo(() => {
    if (filter === "wins") return allTrades.filter((t) => t.outcome === "win");
    if (filter === "losses") return allTrades.filter((t) => t.outcome === "loss");
    return allTrades;
  }, [allTrades, filter]);

  const filterCounts: Record<TradeFilter, number> = {
    all: totalTrades,
    wins,
    losses,
  };

  // Convenience values for the Lede tiles.
  const totalReturnPct = num(result?.total_return_pct);
  const sharpe = num(result?.sharpe_ratio);
  const maxDd = num(result?.max_drawdown);
  const winRate = num(result?.win_rate);
  // Profit factor is null on the backend when gross_loss == 0
  // (division undefined). Backend can't return +∞ — Numeric column,
  // Pydantic Decimal field, and JSON encoder all reject Infinity — so
  // the response carries null and we disambiguate here using the
  // winning/losing counts that the response already exposes:
  //   - winning_trades > 0, losing_trades == 0  → flawless run, render "∞"
  //   - otherwise (no trades, or all-breakeven) → render "—"
  // Pre-W19 this used (total_trades > 0) which incorrectly rendered
  // "∞" for the rare all-breakeven case.
  const profitFactorRaw = result?.profit_factor;
  const profitFactor = num(profitFactorRaw);
  const profitFactorInfinite =
    result != null &&
    (profitFactorRaw === null || profitFactorRaw === undefined) &&
    (result.winning_trades ?? 0) > 0 &&
    (result.losing_trades ?? 0) === 0;
  const avgHold = num(result?.avg_holding_days);
  const equityValues = result?.equity_curve?.map((p) => num(p.equity)) ?? [];
  const monthlyReturns = useMemo(
    () => computeMonthlyReturns(result?.equity_curve ?? null),
    [result?.equity_curve],
  );

  // Drawdown points are non-positive on the backend (0 at peaks, negative at
  // troughs). If a future run ships them positive, the sign-flip below keeps
  // the chart's "lower = worse" reading intact.
  const drawdownValues = useMemo(() => {
    const pts = result?.equity_curve?.map((p) => num(p.drawdown)) ?? [];
    if (pts.length === 0) return pts;
    const maxAbs = Math.max(...pts.map(Math.abs));
    const flip = pts.every((v) => v >= 0) && maxAbs > 0;
    return flip ? pts.map((v) => -v) : pts;
  }, [result?.equity_curve]);
  const drawdownHasMovement = drawdownValues.length > 1 && drawdownValues.some((v) => v !== 0);

  const pnlHistogram = useMemo(
    () => computePnlHistogram(result?.trades ?? null),
    [result?.trades],
  );
  const holdBuckets = useMemo(
    () => computeHoldBuckets(result?.trades ?? null, T),
    [result?.trades, T],
  );
  const exitBreakdown = useMemo(
    () => computeExitReasonBreakdown(result?.trades ?? null, T),
    [result?.trades, T],
  );
  const hasTrades = (result?.trades?.length ?? 0) > 0;
  const slug = strategyId != null ? String(strategyId) : "—";
  const dateRange = result
    ? formatRangeHeader(result.start_date, result.end_date)
    : "no run yet";
  const initialCapital = num(result?.initial_capital ?? 1_000_000);

  return (
    <AppFrame route="/backtest">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/strategies" style={{ color: T.primaryLight }}>
                Strategies
              </Link>{" "}
              / {strategyName ?? slug} / <span style={{ color: T.text2 }}>backtest</span>
              {benchmarkSaved && (
                <span
                  style={{
                    marginLeft: 10,
                    color: T.primaryLight,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    fontSize: 10.5,
                  }}
                >
                  · benchmark saved
                </span>
              )}
              {deployed && (
                <span
                  style={{
                    marginLeft: 10,
                    color: T.deploy,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    fontSize: 10.5,
                  }}
                >
                  · deployed
                </span>
              )}
            </>
          }
          title={
            <>
              <span style={{ fontWeight: 400, color: T.text2 }}>Backtest</span>{" "}
              <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
                results
              </span>
            </>
          }
          meta={
            <>
              <span>{dateRange}</span>
              <span>{result ? `${result.equity_curve?.length ?? 0} bars` : "no equity curve yet"}</span>
              <span>PKR {initialCapital.toLocaleString()} initial</span>
              <span style={{ color: T.gain }}>{ranLabel}</span>
            </>
          }
          actions={
            <>
              <Link href={rerunHref} style={{ textDecoration: "none" }}>
                <Btn variant="ghost" size="sm">
                  {result ? "Re-run" : "Run backtest"}
                </Btn>
              </Link>
              <Btn variant="outline" size="sm" onClick={handleSaveBenchmark}>
                {benchmarkSaved ? "Remove benchmark" : "Save as benchmark"}
              </Btn>
              <Btn variant="deploy" size="sm" onClick={handleDeploy}>
                {deployed ? "Pause" : "Deploy →"}
              </Btn>
            </>
          }
        />

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `20px ${padX} 28px`,
              desktop: `32px ${padX} 40px`,
            }),
          }}
        >
          {result && result.warnings && result.warnings.length > 0 && (
            <WarningsBanner warnings={result.warnings} />
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: pick(bp, {
                mobile: "1fr 1fr",
                tablet: "repeat(3, 1fr)",
                desktop: "repeat(6, 1fr)",
              }),
              gap: pick(bp, { mobile: 22, desktop: 40 }),
              paddingBottom: 28,
              borderBottom: `1px solid ${T.outlineFaint}`,
            }}
          >
            <Lede
              label="Total return"
              value={result ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%` : "—"}
              color={totalReturnPct >= 0 ? T.gain : T.loss}
              sub="strategy"
            />
            <Lede
              label="Sharpe"
              value={result ? sharpe.toFixed(2) : "—"}
              sub="risk-adjusted"
            />
            <Lede
              label="Max DD"
              value={result ? `${maxDd.toFixed(1)}%` : "—"}
              color={T.loss}
              sub="peak-to-trough"
            />
            <Lede
              label="Win rate"
              value={result && totalTrades > 0 ? `${winRate.toFixed(0)}%` : "—"}
              sub={totalTrades > 0 ? `${wins} / ${totalTrades} trades` : "no trades"}
            />
            <Lede
              label="Profit factor"
              value={
                !result
                  ? "—"
                  : profitFactorInfinite
                    ? "∞"
                    : profitFactorRaw === null || profitFactorRaw === undefined
                      ? "—"
                      : profitFactor.toFixed(2)
              }
              sub={profitFactorInfinite ? "no losing trades" : "gross win ÷ loss"}
            />
            <Lede
              label="Avg hold"
              value={result ? `${avgHold.toFixed(0)}d` : "—"}
              sub="trading days"
            />
          </div>

          {result && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: pick(bp, {
                  mobile: "1fr 1fr",
                  tablet: "repeat(4, 1fr)",
                  desktop: "repeat(6, 1fr)",
                }),
                gap: pick(bp, { mobile: 22, desktop: 40 }),
                paddingTop: 28,
                paddingBottom: 28,
                borderBottom: `1px solid ${T.outlineFaint}`,
              }}
            >
              <Lede
                label="Sortino"
                value={result.sortino_ratio == null ? "—" : num(result.sortino_ratio).toFixed(2)}
                sub="downside-risk-adjusted"
              />
              <Lede
                label="CAGR"
                value={result.cagr == null ? "—" : fmtPctSigned(num(result.cagr))}
                color={result.cagr == null ? undefined : num(result.cagr) >= 0 ? T.gain : T.loss}
                sub="annualized return"
              />
              <Lede
                label="Volatility"
                value={result.volatility == null ? "—" : fmtPctAbs(num(result.volatility))}
                sub="annualized stdev"
              />
              <Lede
                label="DD duration"
                value={
                  result.max_drawdown_duration == null
                    ? "—"
                    : `${Math.round(num(result.max_drawdown_duration)).toLocaleString()}d`
                }
                color={T.loss}
                sub="longest underwater run"
              />
              <Lede
                label="Avg win"
                value={result.avg_win == null ? "—" : fmtPkr(num(result.avg_win))}
                color={T.gain}
                sub="mean PKR per win"
              />
              <Lede
                label="Avg loss"
                value={result.avg_loss == null ? "—" : fmtPkr(num(result.avg_loss))}
                color={T.loss}
                sub="mean PKR per loss"
              />
              <Lede
                label="Largest win"
                value={result.largest_win == null ? "—" : fmtPkr(num(result.largest_win))}
                color={T.gain}
                sub="best single trade"
              />
              <Lede
                label="Largest loss"
                value={result.largest_loss == null ? "—" : fmtPkr(num(result.largest_loss))}
                color={T.loss}
                sub="worst single trade"
              />
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: pick(bp, {
                mobile: "1fr",
                tablet: "1.9fr 1fr",
                desktop: "1.9fr 1fr",
              }),
              gap: pick(bp, { mobile: 28, tablet: 32, desktop: 48 }),
              marginTop: 32,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Ribbon
                kicker="equity curve"
                right={
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
                    <span style={{ color: T.gain }}>━</span> strategy
                  </span>
                }
              />
              <div style={{ marginTop: 8 }}>
                {equityValues.length > 0 ? (
                  <EquityCurve width={760} height={220} data={equityValues} />
                ) : (
                  <div
                    style={{
                      height: 220,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.fontMono,
                      fontSize: 12,
                      color: T.text3,
                      border: `1px dashed ${T.outlineFaint}`,
                      borderRadius: 4,
                    }}
                  >
                    {strategyId
                      ? "no backtest yet — click Run backtest to set a date range"
                      : "open this from a strategy to run a backtest"}
                  </div>
                )}
              </div>
              {result?.equity_curve && result.equity_curve.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: T.text3,
                    fontFamily: T.fontMono,
                    marginTop: 4,
                  }}
                >
                  {(() => {
                    const c = result.equity_curve!;
                    const fmt = (iso: string) => {
                      const d = new Date(iso);
                      return Number.isNaN(d.getTime())
                        ? iso
                        : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                    };
                    const ticks = 5;
                    return Array.from({ length: ticks }, (_, i) => {
                      const idx = Math.round((i * (c.length - 1)) / (ticks - 1));
                      return <span key={i}>{fmt(c[idx].date)}</span>;
                    });
                  })()}
                </div>
              )}

              {drawdownHasMovement && (
                <div style={{ marginTop: 4 }}>
                  <Ribbon
                    kicker="drawdown"
                    color={T.loss}
                    right={
                      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
                        <span style={{ color: T.loss }}>━</span> underwater %
                      </span>
                    }
                  />
                  <EquityCurve
                    width={760}
                    height={74}
                    data={drawdownValues}
                    color={T.loss}
                    grid={false}
                  />
                </div>
              )}

              <div style={{ marginTop: 36 }}>
                <Ribbon kicker="monthly returns" />
                {monthlyReturns.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${monthlyReturns.length}, 1fr)`,
                      gap: 4,
                      marginTop: 12,
                      alignItems: "end",
                    }}
                  >
                    {monthlyReturns.map((m, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div
                          style={{
                            height: 16 + Math.min(Math.abs(m.pct), 20) * 8,
                            background: m.pct >= 0 ? T.gain : T.loss,
                            opacity: 0.65,
                            borderRadius: 2,
                          }}
                        />
                        <div
                          style={{
                            fontFamily: T.fontMono,
                            fontSize: 9.5,
                            color: T.text3,
                            marginTop: 4,
                          }}
                        >
                          {m.pct >= 0 ? "+" : ""}
                          {m.pct.toFixed(1)}
                        </div>
                        <div
                          style={{
                            fontFamily: T.fontMono,
                            fontSize: 9,
                            color: T.text3,
                            marginTop: 2,
                          }}
                        >
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 12,
                      height: 56,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.fontMono,
                      fontSize: 11,
                      color: T.text3,
                      border: `1px dashed ${T.outlineFaint}`,
                      borderRadius: 4,
                    }}
                  >
                    {result
                      ? "not enough history to derive monthly returns"
                      : "run a backtest to see monthly returns"}
                  </div>
                )}
              </div>
            </div>

            <div>
              {/* Per-sector breakdown is intentionally omitted: the backend's
                  BacktestResultResponse doesn't carry a sector decomposition,
                  and inferring one client-side from result.trades would
                  require a symbol→sector map we don't load on this page. The
                  panel that lived here previously rendered hardcoded mock
                  numbers (Oil & Gas +18.2%, Banks +11.4%…) regardless of the
                  actual run, which is misleading. Add it back once the
                  backend exposes a real breakdown. */}

              {result && (
                <div style={{ marginBottom: 28 }}>
                  <EffectiveRiskPanel
                    snapshot={result.run_config?.effective_risk ?? null}
                  />
                </div>
              )}

              <div>
                <Ribbon kicker="deploy?" color={T.deploy} />
                <div
                  style={{ fontSize: 13, color: T.text2, lineHeight: 1.55, marginTop: 6 }}
                >
                  {result ? (
                    <>
                      Sharpe{" "}
                      <span style={{ color: T.text }}>{sharpe.toFixed(2)}</span> ·{" "}
                      total return{" "}
                      <span style={{ color: totalReturnPct >= 0 ? T.gain : T.loss }}>
                        {totalReturnPct >= 0 ? "+" : ""}
                        {totalReturnPct.toFixed(1)}%
                      </span>
                      . Consider paper-trading via a Bot before committing capital.
                    </>
                  ) : (
                    <>Run a backtest to see Sharpe and total return for this strategy.</>
                  )}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <Btn variant="deploy" size="sm" icon={Icon.spark} onClick={handleDeploy}>
                    {deployed ? "Pause strategy" : "Deploy strategy"}
                  </Btn>
                  <Link href="/bots/new" style={{ textDecoration: "none" }}>
                    <Btn variant="outline" size="sm">
                      + Bot
                    </Btn>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 44 }}>
            <Ribbon
              kicker="trade log"
              right={
                <div style={{ display: "flex", gap: 4, fontSize: 10.5, fontFamily: T.fontMono }}>
                  {(["all", "wins", "losses"] as TradeFilter[]).map((key) => {
                    const active = filter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        aria-pressed={active}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: active ? T.surface3 : "transparent",
                          color: active ? T.text : T.text3,
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontSize: "inherit",
                        }}
                      >
                        {key} {filterCounts[key]}
                      </button>
                    );
                  })}
                </div>
              }
            />
            <div style={{ marginTop: 8 }}>
              <TradeLog trades={visibleTrades} />
            </div>
            <div
              style={{
                padding: "14px 12px",
                fontFamily: T.fontMono,
                fontSize: 11,
                color: T.text3,
              }}
            >
              showing {visibleTrades.length} of {filterCounts[filter]} trade
              {filterCounts[filter] === 1 ? "" : "s"}
            </div>

            {result && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: pick(bp, {
                    mobile: "1fr",
                    tablet: "1fr 1fr",
                    desktop: "1fr 1fr 1fr",
                  }),
                  gap: pick(bp, { mobile: 28, tablet: 28, desktop: 32 }),
                  marginTop: 36,
                  paddingTop: 28,
                  borderTop: `1px solid ${T.outlineFaint}`,
                }}
              >
                <PnLHistogram histogram={pnlHistogram} hasTrades={hasTrades} />
                <HoldTimeHistogram
                  buckets={holdBuckets.buckets}
                  maxCount={holdBuckets.maxCount}
                  hasTrades={hasTrades}
                />
                <ExitReasonDonut
                  segments={exitBreakdown.segments}
                  total={exitBreakdown.total}
                  hasTrades={hasTrades}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function TradeLog({ trades }: { trades: Trade[] }) {
  const T = useT();
  const cols: Col[] = [
    { label: "#", width: "40px", hideOnMobile: true },
    { label: "symbol", width: "90px", primary: true },
    { label: "dir", width: "60px" },
    { label: "entry", width: "130px", mobileFullWidth: true },
    { label: "exit", width: "130px", mobileFullWidth: true },
    { label: "qty", align: "right", width: "90px" },
    { label: "pnl", align: "right", width: "120px" },
    { label: "return", align: "right", width: "100px" },
    { label: "hold", align: "right", width: "70px" },
    { label: "reason", width: "1fr", mono: false, mobileFullWidth: true },
  ];
  if (trades.length === 0) {
    return (
      <div
        style={{
          padding: "18px 12px",
          fontFamily: T.fontMono,
          fontSize: 12,
          color: T.text3,
          fontStyle: "italic",
        }}
      >
        No trades match this filter.
      </div>
    );
  }
  const rows: unknown[][] = trades.map((t) => [
    t.n,
    t.sym,
    t.dir,
    t.entry,
    t.exit,
    t.qty,
    t.pnl,
    t.ret,
    t.hold,
    t.reason,
  ]);
  return (
    <TerminalTable
      cols={cols}
      rows={rows}
      renderCell={(cell, ci) => {
        if (ci === 0) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
        if (ci === 1)
          return (
            <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>
          );
        if (ci === 2) return <span style={{ color: T.gain }}>{cell as ReactNode}</span>;
        if (ci === 6 || ci === 7) {
          const s = String(cell);
          const isGain = s.startsWith("+");
          const isLoss = s.startsWith("−");
          return (
            <span style={{ color: isGain ? T.gain : isLoss ? T.loss : T.text3 }}>{s}</span>
          );
        }
        if (ci === 9) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
        return cell as ReactNode;
      }}
    />
  );
}

// Phase 7 — read-only attribution panel for the four scalar risk guardrails
// the engine ran under. The backend's `_resolve_run_config` snapshots each
// field's resolved value plus its source onto `BacktestResult.run_config.
// effective_risk` so we don't have to re-resolve against a strategy that
// may have changed since the run. Empty / missing snapshot (older results,
// or runs that predate Phase 2) renders a single muted "not recorded" line
// instead of guessing — the UI shouldn't fabricate values that weren't
// captured.

const RISK_ROWS: ReadonlyArray<{
  field: keyof EffectiveRiskSnapshot;
  label: string;
  unit: "%" | "d";
  integer?: boolean;
}> = [
  { field: "stop_loss_pct", label: "Stop loss", unit: "%" },
  { field: "take_profit_pct", label: "Take profit", unit: "%" },
  { field: "trailing_stop_pct", label: "Trailing", unit: "%" },
  { field: "max_holding_days", label: "Max hold", unit: "d", integer: true },
];

function formatRiskValue(
  value: number | null,
  unit: "%" | "d",
  integer: boolean,
): string {
  if (value == null) return "—";
  if (integer) return `${Math.round(value)}${unit}`;
  // Trim trailing zeros, cap at 2 decimals — matches the InheritableField
  // and inheritance-warning-modal formatters so values read consistently
  // across the app.
  return `${Number(value.toFixed(2))}${unit}`;
}

function EffectiveRiskPanel({
  snapshot,
}: {
  snapshot: EffectiveRiskSnapshot | null;
}) {
  const T = useT();

  return (
    <div>
      <Ribbon kicker="effective risk" />
      {snapshot ? (
        <div style={{ marginTop: 6 }}>
          {RISK_ROWS.map((row) => (
            <RiskRow
              key={row.field}
              label={row.label}
              unit={row.unit}
              integer={row.integer ?? false}
              resolution={snapshot[row.field]}
            />
          ))}
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 11,
              color: T.text3,
              fontFamily: T.fontMono,
              lineHeight: 1.5,
            }}
          >
            captured at run time · sources won&apos;t shift if the strategy
            default changes
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 6,
            padding: "10px 12px",
            border: `1px dashed ${T.outlineFaint}`,
            borderRadius: 4,
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
            lineHeight: 1.5,
          }}
        >
          risk snapshot not recorded for this run
        </div>
      )}
    </div>
  );
}

function WarningsBanner({
  warnings,
}: {
  warnings: NonNullable<BacktestResultResponse["warnings"]>;
}) {
  const T = useT();
  return (
    <div
      style={{
        marginBottom: 24,
        padding: "12px 16px",
        borderRadius: 4,
        border: `1px solid ${T.warning}33`,
        background: `${T.warning}14`,
        borderLeft: `3px solid ${T.warning}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.warning,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: T.warning, display: "inline-flex" }}>{Icon.warn}</span>
        Methodology notes
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "10px 0 0",
          display: "grid",
          gap: 8,
        }}
      >
        {warnings.map((w, i) => {
          const bullet = w.severity === "warning" ? T.warning : T.text3;
          return (
            <li
              key={`${w.code}-${i}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontFamily: T.fontSans,
                fontSize: 13,
                lineHeight: 1.55,
                color: T.text2,
              }}
            >
              <span style={{ color: bullet, lineHeight: 1.55 }}>•</span>
              <span>{w.message || w.code}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PnLHistogram({
  histogram,
  hasTrades,
}: {
  histogram: ReturnType<typeof computePnlHistogram>;
  hasTrades: boolean;
}) {
  const T = useT();
  const summary =
    histogram == null
      ? null
      : { min: histogram.min, max: histogram.max };
  return (
    <div>
      <Ribbon kicker="pnl distribution" />
      {!hasTrades ? (
        <EmptyAnalyticsBody label="no trades yet" />
      ) : histogram == null ? (
        <EmptyAnalyticsBody label="needs ≥4 trades for a distribution" />
      ) : (
        <>
          <svg
            viewBox="0 0 200 90"
            preserveAspectRatio="none"
            width="100%"
            height={90}
            style={{ display: "block", marginTop: 12 }}
          >
            {(() => {
              const { bins, maxCount, min, max } = histogram;
              const binWidth = 200 / bins.length;
              const zeroIn = min <= 0 && max >= 0;
              const zeroX = zeroIn ? ((0 - min) / (max - min)) * 200 : null;
              return (
                <>
                  {bins.map((b, i) => {
                    const h = maxCount > 0 ? (b.count / maxCount) * 90 : 0;
                    const mid = (b.lower + b.upper) / 2;
                    const fill = mid >= 0 ? T.gain : T.loss;
                    return (
                      <rect
                        key={i}
                        x={i * binWidth + 0.5}
                        y={90 - h}
                        width={Math.max(0, binWidth - 1)}
                        height={h}
                        fill={fill}
                        opacity={b.count === 0 ? 0.2 : 0.85}
                      />
                    );
                  })}
                  {zeroX != null && (
                    <line
                      x1={zeroX}
                      x2={zeroX}
                      y1={0}
                      y2={90}
                      stroke={T.outlineVariant}
                      strokeDasharray="2 2"
                    />
                  )}
                </>
              );
            })()}
          </svg>
          {summary && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: T.fontMono,
                fontSize: 10,
                color: T.text3,
                marginTop: 8,
              }}
            >
              <span>{fmtPkr(summary.min)}</span>
              <span>{fmtPkr(summary.max)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HoldTimeHistogram({
  buckets,
  maxCount,
  hasTrades,
}: {
  buckets: HoldBucket[];
  maxCount: number;
  hasTrades: boolean;
}) {
  const T = useT();
  return (
    <div>
      <Ribbon kicker="hold time" />
      {!hasTrades || maxCount === 0 ? (
        <EmptyAnalyticsBody label="no trades yet" />
      ) : (
        <>
          <svg
            viewBox="0 0 200 90"
            preserveAspectRatio="none"
            width="100%"
            height={90}
            style={{ display: "block", marginTop: 12 }}
          >
            {buckets.map((b, i) => {
              const barWidth = 40;
              const gap = 10;
              const total = buckets.length * barWidth + (buckets.length - 1) * gap;
              const startX = (200 - total) / 2;
              const x = startX + i * (barWidth + gap);
              const h = (b.count / maxCount) * 90;
              return (
                <rect
                  key={b.label}
                  x={x}
                  y={90 - h}
                  width={barWidth}
                  height={h}
                  fill={b.color}
                  opacity={b.count === 0 ? 0.2 : 0.85}
                />
              );
            })}
          </svg>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
              gap: 4,
              marginTop: 8,
              fontFamily: T.fontMono,
              fontSize: 10,
              color: T.text3,
              textAlign: "center",
            }}
          >
            {buckets.map((b) => (
              <div key={b.label}>
                <div>{b.label}</div>
                <div style={{ color: T.text2, marginTop: 2 }}>{b.count}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ExitReasonDonut({
  segments,
  total,
  hasTrades,
}: {
  segments: ExitSegment[];
  total: number;
  hasTrades: boolean;
}) {
  const T = useT();
  return (
    <div>
      <Ribbon kicker="exit breakdown" />
      {!hasTrades || total === 0 ? (
        <EmptyAnalyticsBody label="no trades yet" />
      ) : (
        <>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
            <svg
              viewBox="0 0 120 120"
              width="100%"
              height={160}
              style={{ display: "block", maxHeight: 160 }}
              preserveAspectRatio="xMidYMid meet"
            >
              {(() => {
                const r = 48;
                const cx = 60;
                const cy = 60;
                const circ = 2 * Math.PI * r;
                let offset = 0;
                const arcs = segments.map((s) => {
                  const len = (s.count / total) * circ;
                  const node = (
                    <circle
                      key={s.reason}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={18}
                      strokeDasharray={`${len} ${circ - len}`}
                      strokeDashoffset={-offset}
                      transform={`rotate(-90 ${cx} ${cy})`}
                    />
                  );
                  offset += len;
                  return node;
                });
                return (
                  <>
                    {arcs}
                    <text
                      x={cx}
                      y={cy + 2}
                      textAnchor="middle"
                      style={{
                        fontFamily: T.fontHead,
                        fontSize: 24,
                        fill: T.text,
                        fontWeight: 500,
                      }}
                    >
                      {total}
                    </text>
                    <text
                      x={cx}
                      y={cy + 18}
                      textAnchor="middle"
                      style={{
                        fontFamily: T.fontMono,
                        fontSize: 10,
                        fill: T.text3,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                      }}
                    >
                      trades
                    </text>
                  </>
                );
              })()}
            </svg>
          </div>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 12px",
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.text2,
            }}
          >
            {segments.map((s) => {
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              return (
                <div
                  key={s.reason}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: s.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, color: T.text2 }}>{s.label}</span>
                  <span style={{ color: T.text3 }}>
                    {s.count} · {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyAnalyticsBody({ label }: { label: string }) {
  const T = useT();
  return (
    <div
      style={{
        marginTop: 12,
        height: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.text3,
        border: `1px dashed ${T.outlineFaint}`,
        borderRadius: 4,
      }}
    >
      {label}
    </div>
  );
}

function RiskRow({
  label,
  unit,
  integer,
  resolution,
}: {
  label: string;
  unit: "%" | "d";
  integer: boolean;
  resolution: EffectiveRiskResolution;
}) {
  const T = useT();
  const display = formatRiskValue(resolution.value, unit, integer);
  // Source-driven typography: explicit overrides get the brand tint so the
  // user can scan for "what did I change?" at a glance; defaults read as
  // primary text (the run honored what the strategy authored); inactive
  // fields fade so the absence is visible but not noisy.
  const valueColor =
    resolution.source === "explicit"
      ? T.primaryLight
      : resolution.source === "default"
      ? T.text
      : T.text3;
  const sourceLabel =
    resolution.source === "explicit"
      ? "override"
      : resolution.source === "default"
      ? "default"
      : "inactive";
  const sourceColor =
    resolution.source === "explicit" ? T.primaryLight : T.text3;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        padding: "7px 0",
        borderBottom: `1px solid ${T.outlineFaint}`,
        fontFamily: T.fontMono,
        fontSize: 12,
      }}
    >
      <span style={{ color: T.text2, flex: 1 }}>{label}</span>
      <span style={{ color: valueColor, fontVariantNumeric: "tabular-nums" }}>
        {display}
      </span>
      <span
        style={{
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: sourceColor,
          minWidth: 56,
          textAlign: "right",
        }}
      >
        {sourceLabel}
      </span>
    </div>
  );
}
