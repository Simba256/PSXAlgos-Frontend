"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
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

const TRADES: Trade[] = [
  { n: 1, sym: "OGDC", dir: "BUY", entry: "Apr 02 · 118.40", exit: "Apr 19 · 132.60", qty: "1,500", pnl: "+21,300", ret: "+12.0%", hold: "17d", reason: "Take profit", outcome: "win" },
  { n: 2, sym: "LUCK", dir: "BUY", entry: "Apr 08 · 642.00", exit: "Apr 14 · 619.00", qty: "200", pnl: "−4,600", ret: "−3.6%", hold: "6d", reason: "Stop loss", outcome: "loss" },
  { n: 3, sym: "ENGRO", dir: "BUY", entry: "Apr 10 · 278.50", exit: "— open —", qty: "600", pnl: "—", ret: "—", hold: "11d", reason: "Open", outcome: "open" },
  { n: 4, sym: "FFC", dir: "BUY", entry: "Mar 20 · 95.20", exit: "Apr 04 · 108.10", qty: "3,000", pnl: "+38,700", ret: "+13.5%", hold: "15d", reason: "Take profit", outcome: "win" },
  { n: 5, sym: "HBL", dir: "BUY", entry: "Mar 12 · 88.60", exit: "Mar 28 · 92.10", qty: "2,500", pnl: "+8,750", ret: "+3.9%", hold: "16d", reason: "Exit signal", outcome: "win" },
  { n: 6, sym: "MCB", dir: "BUY", entry: "Mar 01 · 204.10", exit: "Mar 14 · 198.80", qty: "1,200", pnl: "−6,360", ret: "−2.6%", hold: "13d", reason: "Stop loss", outcome: "loss" },
];

const TOTAL_TRADES = 34;
const TOTAL_WINS = 21;
const TOTAL_LOSSES = 13;

function formatRan(ms: number): string {
  if (ms < 1000) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

export default function BacktestPage() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const [lastRun, setLastRun] = useState<number>(() => Date.now() - 12_000);
  const [running, setRunning] = useState(false);
  const [benchmarkSaved, setBenchmarkSaved] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [loadedAll, setLoadedAll] = useState(false);
  const { flash, setFlash } = useFlash();
  const [ranLabel, setRanLabel] = useState("ran 12s ago · 14ms compute");

  useEffect(() => {
    const tick = () => setRanLabel(`ran ${formatRan(Date.now() - lastRun)} · 14ms compute`);
    tick();
    const iv = setInterval(tick, 10_000);
    return () => clearInterval(iv);
  }, [lastRun]);

  const handleRerun = () => {
    if (running) return;
    setRunning(true);
    setRanLabel("running…");
    setTimeout(() => {
      setRunning(false);
      setLastRun(Date.now());
      setFlash("Backtest complete · 14ms compute");
    }, 1200);
  };

  const handleSaveBenchmark = () => {
    setBenchmarkSaved((b) => {
      const next = !b;
      setFlash(next ? "Saved as benchmark · v1" : "Benchmark removed");
      return next;
    });
  };

  const handleDeploy = () => {
    setDeployed((d) => {
      const next = !d;
      setFlash(next ? "Strategy deployed · live signals active" : "Strategy paused · signals halted");
      return next;
    });
  };

  const handleLoadAll = () => {
    setLoadedAll(true);
    setFlash(`Loaded all ${TOTAL_TRADES} trades`);
  };

  const visibleTrades = useMemo(() => {
    if (filter === "wins") return TRADES.filter((t) => t.outcome === "win");
    if (filter === "losses") return TRADES.filter((t) => t.outcome === "loss");
    return TRADES;
  }, [filter]);

  const filterCounts: Record<TradeFilter, number> = {
    all: TOTAL_TRADES,
    wins: TOTAL_WINS,
    losses: TOTAL_LOSSES,
  };

  return (
    <AppFrame route="/backtest">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/strategies" style={{ color: T.primaryLight }}>
                Strategies
              </Link>{" "}
              / rsi_bounce_v1 / <span style={{ color: T.text2 }}>backtest</span>
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
              <span>Apr 20 &apos;25 → Apr 20 &apos;26 · 252 bars</span>
              <span>KSE-100 · 100 symbols</span>
              <span>PKR 1,000,000 initial</span>
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
            <Lede label="Total return" value="+14.2%" color={T.gain} sub="vs KSE-100 +8.1%" />
            <Lede label="Sharpe" value="1.84" sub="risk-adjusted" />
            <Lede label="Max DD" value="−8.4%" color={T.loss} sub="Feb 12 → Mar 03" />
            <Lede label="Win rate" value="62%" sub="21 / 34 trades" />
            <Lede label="Profit factor" value="2.31" sub="gross win ÷ loss" />
            <Lede label="Avg hold" value="11d" sub="median 9 days" />
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
                <EquityCurve
                  width={760}
                  height={220}
                  data={Array.from(
                    { length: 120 },
                    (_, i) => 100 + i * 0.12 + Math.sin(i / 7) * 3 + (i > 60 ? 3 : 0)
                  )}
                  benchmark={Array.from(
                    { length: 120 },
                    (_, i) => 100 + i * 0.07 + Math.cos(i / 9) * 2
                  )}
                />
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
              showing {visibleTrades.length} of {filterCounts[filter]} ·{" "}
              {loadedAll ? (
                <span style={{ color: T.text3 }}>all loaded</span>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadAll}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.primaryLight,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    padding: 0,
                  }}
                >
                  load all →
                </button>
              )}
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
