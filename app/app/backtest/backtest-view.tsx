"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import type {
  BacktestEquityPoint,
  BacktestResultResponse,
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
  // Profit factor is null on the backend when there are no losing trades
  // (gross_loss == 0 → division undefined). Distinguish that from a real
  // 0.00 so the tile reads "∞" instead of misleading "0.00".
  const profitFactorRaw = result?.profit_factor;
  const profitFactor = num(profitFactorRaw);
  const profitFactorUndefined =
    result != null &&
    (profitFactorRaw === null || profitFactorRaw === undefined) &&
    (result.total_trades ?? 0) > 0;
  const avgHold = num(result?.avg_holding_days);
  const equityValues = result?.equity_curve?.map((p) => num(p.equity)) ?? [];
  const monthlyReturns = useMemo(
    () => computeMonthlyReturns(result?.equity_curve ?? null),
    [result?.equity_curve],
  );
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
                  : profitFactorUndefined
                    ? "∞"
                    : profitFactor.toFixed(2)
              }
              sub={profitFactorUndefined ? "no losing trades" : "gross win ÷ loss"}
            />
            <Lede
              label="Avg hold"
              value={result ? `${avgHold.toFixed(0)}d` : "—"}
              sub="trading days"
            />
          </div>

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

