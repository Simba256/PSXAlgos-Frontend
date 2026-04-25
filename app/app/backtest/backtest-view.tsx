"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import type {
  BacktestResultResponse,
  BacktestJobPending,
  BacktestJobStatus,
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

function formatRan(ms: number): string {
  if (ms < 1000) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
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
  const router = useRouter();
  const [result, setResult] = useState<BacktestResultResponse | null>(initialResult);
  const [lastRun, setLastRun] = useState<number>(() => {
    if (initialResult?.created_at) {
      const t = new Date(initialResult.created_at).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return Date.now();
  });
  const [running, setRunning] = useState(false);
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

  async function pollJob(jobId: string): Promise<BacktestJobStatus> {
    // Poll every 1.5s, give up after ~30 attempts (≈ 45s) to match backend's
    // 30-min timeout but keep the UI from hanging forever on a stuck job.
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(`/api/strategies/${strategyId}/backtest/job/${jobId}`);
      if (!res.ok) throw new Error(`Poll failed (${res.status})`);
      const status = (await res.json()) as BacktestJobStatus;
      if (status.status === "completed" || status.status === "failed") return status;
    }
    throw new Error("Backtest taking longer than expected — try again later.");
  }

  const handleRerun = async () => {
    if (running || !strategyId) return;
    setRunning(true);
    setRanLabel("running…");
    try {
      // Default range: last 12 months back from today.
      const end = new Date();
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      const body = {
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        initial_capital: Number(initialResult?.initial_capital ?? 1_000_000),
      };
      const startRes = await fetch(`/api/strategies/${strategyId}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        if (startRes.status === 403) throw new Error("Backtests require the Pro plan.");
        throw new Error(typeof err?.error === "string" ? err.error : `Start failed (${startRes.status})`);
      }
      const started = (await startRes.json()) as BacktestJobPending | BacktestResultResponse;
      // Sync mode (Redis off) returns a full result directly.
      if (!("job_id" in started)) {
        setResult(started);
        setLastRun(Date.now());
        setFlash("Backtest complete");
        router.refresh();
        return;
      }
      const final = await pollJob(started.job_id);
      if (final.status === "failed") {
        throw new Error(final.error ?? "Backtest failed");
      }
      // Pull the URL into sync with the new backtest_id so refresh shows it.
      if (final.backtest_id) {
        const url = new URL(window.location.href);
        url.searchParams.set("backtest_id", String(final.backtest_id));
        window.history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString());
      }
      setLastRun(Date.now());
      setFlash("Backtest complete");
      router.refresh();
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setRunning(false);
    }
  };

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
  const profitFactor = num(result?.profit_factor);
  const avgHold = num(result?.avg_holding_days);
  const equityValues = result?.equity_curve?.map((p) => num(p.equity)) ?? [];
  const slug = strategyId != null ? String(strategyId) : "—";
  const dateRange = result
    ? `${formatDateLabel(result.start_date)} → ${formatDateLabel(result.end_date)}`
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
              <span style={{ color: running ? T.warning : T.gain }}>{ranLabel}</span>
            </>
          }
          actions={
            <>
              <Btn variant="ghost" size="sm" onClick={handleRerun}>
                {running ? "Running…" : "Re-run"}
              </Btn>
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
              value={result ? profitFactor.toFixed(2) : "—"}
              sub="gross win ÷ loss"
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
                    <span style={{ color: T.gain }}>━</span> strategy &nbsp;{" "}
                    <span style={{ color: T.text3 }}>┄┄</span> KSE-100
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
                      ? "no backtest yet — click Re-run to generate one"
                      : "open this from a strategy to run a backtest"}
                  </div>
                )}
              </div>
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
                <span>Apr &apos;25</span>
                <span>Jul &apos;25</span>
                <span>Oct &apos;25</span>
                <span>Jan &apos;26</span>
                <span>Apr &apos;26</span>
              </div>

              <div style={{ marginTop: 36 }}>
                <Ribbon kicker="monthly returns" />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, 1fr)",
                    gap: 4,
                    marginTop: 12,
                    alignItems: "end",
                  }}
                >
                  {[2.1, -1.4, 3.2, 0.8, -2.1, 1.7, 2.9, -0.5, 4.1, -1.2, 2.3, 2.6].map((v, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div
                        style={{
                          height: 16 + Math.abs(v) * 8,
                          background: v >= 0 ? T.gain : T.loss,
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
                        {v >= 0 ? "+" : ""}
                        {v.toFixed(1)}
                      </div>
                      <div
                        style={{
                          fontFamily: T.fontMono,
                          fontSize: 9,
                          color: T.text3,
                          marginTop: 2,
                        }}
                      >
                        {["M", "J", "J", "A", "S", "O", "N", "D", "J", "F", "M", "A"][i]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Ribbon kicker="by sector" />
              <div
                style={{
                  marginTop: 6,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 90px max-content",
                }}
              >
                {(
                  [
                    ["Oil & Gas", 18.2, 9],
                    ["Banks", 11.4, 8],
                    ["Cement", 15.1, 6],
                    ["Fertilizer", 9.8, 5],
                    ["Power", -2.1, 4],
                    ["Tech", 4.3, 2],
                  ] as const
                ).map(([s, r]) => (
                  <div
                    key={s}
                    style={{
                      display: "grid",
                      gridColumn: "1 / -1",
                      gridTemplateColumns: "subgrid",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 0",
                      borderBottom: `1px dotted ${T.outlineFaint}`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: T.text2 }}>{s}</span>
                    <div style={{ position: "relative", height: 4, background: T.surface3 }}>
                      <div
                        style={{
                          position: "absolute",
                          left: r >= 0 ? "50%" : `${50 + r * 2}%`,
                          width: `${Math.abs(r) * 2.5}%`,
                          height: 4,
                          background: r >= 0 ? T.gain : T.loss,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: -2,
                          width: 1,
                          height: 8,
                          background: T.text3,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: T.fontMono,
                        color: r >= 0 ? T.gain : T.loss,
                        fontSize: 11,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r > 0 ? "+" : ""}
                      {r}%
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 32 }}>
                <Ribbon kicker="deploy?" color={T.deploy} />
                <div
                  style={{ fontSize: 13, color: T.text2, lineHeight: 1.55, marginTop: 6 }}
                >
                  Sharpe <span style={{ color: T.text }}>1.84</span> and{" "}
                  <span style={{ color: T.gain }}>+6.1pp</span> edge over KSE-100. Consider
                  paper-trading via a Bot before committing capital.
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
