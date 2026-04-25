"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  EditorialHeader,
  FlashToast,
  Kicker,
  Lede,
  Ribbon,
  TerminalTable,
  useFlash,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

interface Bot {
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

const SEED_BOTS: Bot[] = [
  { id: "momentum_live", name: "Momentum · live", strat: "Momentum Breakout", status: "RUNNING", equity: 1124850, start: 1000000, pnl: 12.48, today: 3240, open: 3, trades: 47, uptime: "12d 4h" },
  { id: "rsi_paper", name: "RSI Paper", strat: "RSI Bounce v1", status: "RUNNING", equity: 1084200, start: 1000000, pnl: 8.42, today: -1150, open: 2, trades: 31, uptime: "7d 22h" },
  { id: "banks_sector_test", name: "Banks sector test", strat: "Mean Rev · Banks", status: "PAUSED", equity: 996400, start: 1000000, pnl: -0.36, today: 0, open: 0, trades: 14, uptime: "—" },
  { id: "golden_cross_bot", name: "Golden Cross bot", strat: "Golden Cross · KSE30", status: "STOPPED", equity: 1041200, start: 1000000, pnl: 4.12, today: 0, open: 0, trades: 8, uptime: "—" },
];

export default function BotsListPage() {
  const [empty, setEmpty] = useState(false);
  const [bots, setBots] = useState<Bot[]>(SEED_BOTS);
  const [refreshing, setRefreshing] = useState(false);
  const { flash, setFlash } = useFlash();

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      let updatedCount = 0;
      setBots((prev) => {
        updatedCount = prev.filter((b) => b.status === "RUNNING").length;
        return prev.map((b) =>
          b.status === "RUNNING"
            ? {
                ...b,
                today: b.today + Math.round((Math.random() - 0.45) * 400),
                equity: b.equity + Math.round((Math.random() - 0.45) * 400),
              }
            : b
        );
      });
      setRefreshing(false);
      setFlash(`Refreshed · ${updatedCount} running bots updated`);
    }, 900);
  };

  const runningCount = bots.filter((b) => b.status === "RUNNING").length;
  const pausedAll = runningCount === 0 && bots.some((b) => b.status === "PAUSED");

  const handlePauseAll = () => {
    if (pausedAll) {
      setBots((prev) => prev.map((b) => (b.status === "PAUSED" ? { ...b, status: "RUNNING" as const, uptime: b.uptime === "—" ? "just now" : b.uptime } : b)));
      setFlash("Resumed all paused bots");
    } else if (runningCount > 0) {
      setBots((prev) => prev.map((b) => (b.status === "RUNNING" ? { ...b, status: "PAUSED" as const, today: 0, uptime: "—" } : b)));
      setFlash(`Paused ${runningCount} running bot${runningCount === 1 ? "" : "s"}`);
    }
  };

  return (
    <AppFrame route="/bots">
      <Body
        empty={empty}
        bots={bots}
        refreshing={refreshing}
        runningCount={runningCount}
        pausedAll={pausedAll}
        toggle={() => setEmpty((e) => !e)}
        onRefresh={handleRefresh}
        onPauseAll={handlePauseAll}
      />
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function Body({
  empty,
  bots,
  refreshing,
  runningCount,
  pausedAll,
  toggle,
  onRefresh,
  onPauseAll,
}: {
  empty: boolean;
  bots: Bot[];
  refreshing: boolean;
  runningCount: number;
  pausedAll: boolean;
  toggle: () => void;
  onRefresh: () => void;
  onPauseAll: () => void;
}) {
  const T = useT();
  const visibleBots = empty ? [] : bots;
  const totalEquity = bots.reduce((s, b) => s + b.equity, 0);
  const todayTotal = bots.reduce((s, b) => s + b.today, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <EditorialHeader
        kicker="Automation · paper-trading runners"
        title={
          <>
            Bots{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>·</span>{" "}
            {empty ? (
              <span style={{ color: T.text3, fontWeight: 400, fontSize: "0.7em" }}>no bots yet</span>
            ) : (
              `${bots.length} total`
            )}
          </>
        }
        meta={
          empty ? (
            <>
              <span>0 running</span>
              <span>PKR 0 managed</span>
            </>
          ) : (
            <>
              <span>
                <span style={{ color: runningCount > 0 ? T.gain : T.text3 }}>●</span> {runningCount} running
              </span>
              <span>PKR {(totalEquity / 1_000_000).toFixed(2)}M managed</span>
              <span style={{ color: todayTotal >= 0 ? T.gain : T.loss }}>
                {todayTotal >= 0 ? "+" : ""}
                PKR {todayTotal.toLocaleString()} today
              </span>
              <span style={{ color: T.text3 }}>paper-trading · no real broker</span>
            </>
          )
        }
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={toggle}>
              {empty ? "Show populated" : "Show empty"}
            </Btn>
            {!empty && (
              <>
                <Btn variant="ghost" size="sm" onClick={onRefresh}>
                  {refreshing ? "Refreshing…" : "Refresh"}
                </Btn>
                <Btn variant="outline" size="sm" onClick={onPauseAll}>
                  {pausedAll ? "Resume all" : "Pause all"}
                </Btn>
              </>
            )}
          </>
        }
      />

      {empty ? <EmptyState /> : <Populated bots={visibleBots} />}
    </div>
  );
}

function Populated({ bots }: { bots: Bot[] }) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const cols: Col[] = [
    { label: "name", width: "1.4fr", mono: false, primary: true },
    { label: "strategy", width: "1.2fr", mono: false, mobileFullWidth: true },
    { label: "status", width: "100px" },
    { label: "equity", align: "right", width: "140px" },
    { label: "p&l", align: "right", width: "90px" },
    { label: "today", align: "right", width: "110px" },
    { label: "open", align: "right", width: "60px" },
    { label: "trades", align: "right", width: "70px" },
    { label: "uptime", align: "right", width: "80px" },
  ];
  const rows: unknown[][] = bots.map((b) => [
    b,
    b.strat,
    b.status,
    b.equity,
    b.pnl,
    b.today,
    b.open,
    b.trades,
    b.uptime,
  ]);

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: pick(bp, {
          mobile: `18px ${padX} 28px`,
          desktop: `24px ${padX} 40px`,
        }),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: pick(bp, {
            mobile: "1fr 1fr",
            tablet: "repeat(2, 1fr)",
            desktop: "repeat(4, 1fr)",
          }),
          gap: pick(bp, { mobile: 20, desktop: 36 }),
          paddingBottom: 24,
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        <Lede label="Total equity" value="PKR 4.25M" sub="across 4 bots" />
        <Lede label="Combined P&L" value="+6.17%" color={T.gain} sub="+PKR 246,650" />
        <Lede label="Today" value="+PKR 2,090" color={T.gain} sub="unrealized" />
        <Lede label="Open positions" value="5" sub="of 15 max combined" />
      </div>

      <div style={{ marginTop: 26 }}>
        <Ribbon
          kicker="all bots"
          right={
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
              sort: <span style={{ color: T.text2 }}>P&amp;L ↓</span>
            </span>
          }
        />
        <div style={{ marginTop: 8 }}>
          <TerminalTable
            cols={cols}
            rows={rows}
            renderCell={(cell, ci) => {
              if (ci === 0) {
                const b = cell as Bot;
                return (
                  <Link
                    href={`/bots/${b.id}`}
                    style={{
                      fontFamily: T.fontHead,
                      fontSize: 14,
                      color: T.text,
                      fontWeight: 500,
                      letterSpacing: -0.2,
                      textDecoration: "none",
                    }}
                  >
                    {b.name}
                  </Link>
                );
              }
              if (ci === 1)
                return <span style={{ color: T.primaryLight }}>{cell as ReactNode}</span>;
              if (ci === 2) {
                const st = cell as Bot["status"];
                const c = { RUNNING: T.gain, PAUSED: T.warning, STOPPED: T.text3 }[st];
                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: c,
                      fontSize: 10.5,
                      letterSpacing: 0.6,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        background: c,
                        boxShadow: st === "RUNNING" ? `0 0 0 2px ${c}33` : undefined,
                      }}
                    />
                    {st.toLowerCase()}
                  </span>
                );
              }
              if (ci === 3)
                return (
                  <span style={{ color: T.text }}>
                    {((cell as number) / 1000).toFixed(1)}K
                  </span>
                );
              if (ci === 4) {
                const n = Number(cell);
                return (
                  <span style={{ color: n >= 0 ? T.gain : T.loss }}>
                    {n > 0 ? "+" : ""}
                    {n.toFixed(2)}%
                  </span>
                );
              }
              if (ci === 5) {
                const n = Number(cell);
                if (n === 0) return <span style={{ color: T.text3 }}>—</span>;
                return (
                  <span style={{ color: n >= 0 ? T.gain : T.loss }}>
                    {n > 0 ? "+" : ""}
                    {n.toLocaleString()}
                  </span>
                );
              }
              if (ci === 6)
                return (
                  <span style={{ color: Number(cell) > 0 ? T.text : T.text3 }}>
                    {cell as ReactNode}
                  </span>
                );
              if (ci === 7 || ci === 8)
                return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
              return cell as ReactNode;
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: T.surfaceLow,
          border: `1px dashed ${T.outlineFaint}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ fontFamily: T.fontHead, fontSize: 20, color: T.accent }}>◇</span>
        <div style={{ flex: 1, fontSize: 13, color: T.text2 }}>
          <span style={{ color: T.text, fontWeight: 500 }}>Want another bot?</span> Open a strategy
          and hit <span style={{ color: T.accent }}>Spin up bot</span>. Bots are always bound to a
          strategy — they don&apos;t exist on their own.
        </div>
        <Link href="/strategies" style={{ textDecoration: "none" }}>
          <Btn variant="ghost" size="sm">
            Browse strategies →
          </Btn>
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: pick(bp, { mobile: `28px ${padX}`, desktop: `48px ${padX}` }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 720, textAlign: "center" }}>
        <div style={{ fontFamily: T.fontHead, fontSize: clampPx(48, 14, 72), color: T.accent, lineHeight: 1 }}>◇</div>
        <Kicker color={T.accent}>automation</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: clampPx(30, 7, 44),
            fontWeight: 500,
            margin: "14px 0 16px",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          No bots{" "}
          <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>yet</span>.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: T.text2,
            lineHeight: 1.7,
            maxWidth: 520,
            margin: "0 auto 22px",
          }}
        >
          A bot is a paper-trading runner bound to one of your strategies. It watches the market,
          fires the strategy&apos;s signals, and simulates a portfolio. No real broker — no real
          money.
        </p>
        <div style={{ display: "inline-flex", gap: 10 }}>
          <Link href="/strategies" style={{ textDecoration: "none" }}>
            <Btn variant="primary" size="lg" icon={Icon.plus}>
              Pick a strategy to bind
            </Btn>
          </Link>
        </div>
        <div
          style={{
            marginTop: 32,
            padding: 20,
            background: T.surfaceLow,
            borderRadius: 8,
            textAlign: "left",
            border: `1px solid ${T.outlineFaint}`,
          }}
        >
          <Kicker>the flow</Kicker>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: T.fontMono,
              fontSize: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: T.primaryLight }}>Strategies</span>
            <span style={{ color: T.text3 }}>→</span>
            <span style={{ color: T.text2 }}>Pick one</span>
            <span style={{ color: T.text3 }}>→</span>
            <span style={{ color: T.accent }}>Spin up bot</span>
            <span style={{ color: T.text3 }}>→</span>
            <span style={{ color: T.gain }}>Running</span>
          </div>
        </div>
      </div>
    </div>
  );
}
