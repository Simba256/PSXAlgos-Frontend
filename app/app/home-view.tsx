"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { Btn, Kicker } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DashStrategy {
  id: string;
  name: string;
  status: "DEPLOYED" | "DRAFT" | "PAUSED" | "ARCHIVED";
  bt: string;
  sharpe: number | null;
  signals: number;
  botsCount: number;
}

export interface DashSignal {
  id: string;
  strategy: string;
  symbol: string;
  price: number;
  dir: "BUY" | "SELL";
  age: string;
}

export interface DashBot {
  id: string;
  name: string;
  strategy: string;
  strategyId: string | null;
  pnl: number;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  openPositions: number;
}

export interface DashPosition {
  id: string;
  sym: string;
  qty: number;
  entry: number;
  now: number | null;
  strat: string | null;
  date: string;
}

export interface DashboardViewProps {
  totalStrategies: number;
  deployedStrategies: number;
  draftStrategies: number;
  signalsToday: number;
  strategiesToday: number;
  bestBt: string;
  bestSharpe: number | null;
  bestBtName: string;
  runningBots: number;
  pausedBots: number;
  totalBots: number;
  openPositionCount: number;
  closedTradeCount: number;
  realizedPnl: number;
  strategies: DashStrategy[];
  signals: DashSignal[];
  bots: DashBot[];
  positions: DashPosition[];
  userName: string | null;
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export function DashboardView({
  totalStrategies,
  deployedStrategies,
  draftStrategies,
  signalsToday,
  strategiesToday,
  bestBt,
  bestSharpe,
  bestBtName,
  runningBots,
  pausedBots,
  totalBots,
  openPositionCount,
  closedTradeCount,
  realizedPnl,
  strategies,
  signals,
  bots,
  positions,
  userName,
}: DashboardViewProps) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const router = useRouter();

  const firstName = userName ? userName.split(" ")[0] : null;

  const pnlLabel =
    realizedPnl !== 0
      ? `${realizedPnl >= 0 ? "+" : ""}PKR ${Math.abs(Math.round(realizedPnl)).toLocaleString()} realized`
      : closedTradeCount > 0
      ? `${closedTradeCount} closed trades`
      : "no closed trades";

  return (
    <AppFrame route="/">
      {/* ── Page header ── */}
      <div
        style={{
          padding: pick(bp, {
            mobile: `20px ${padX} 0`,
            desktop: `28px ${padX} 0`,
          }),
        }}
      >
        <Kicker>Dashboard · overview</Kicker>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 10,
          }}
        >
          <h1
            style={{
              fontFamily: T.fontHead,
              fontSize: clampPx(26, 5, 38),
              fontWeight: 500,
              letterSpacing: -0.5,
              color: T.text,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Welcome back{firstName ? `, ${firstName}` : ""}.{" "}
            <span style={{ color: T.text3, fontWeight: 400, fontStyle: "italic" }}>
              Here&apos;s what&apos;s happening.
            </span>
          </h1>
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              flexShrink: 0,
            }}
          >
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <div style={{ height: 1, background: T.outlineFaint, marginTop: 16 }} />
      </div>

      {/* ── Scrollable content ── */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: pick(bp, {
            mobile: `16px ${padX} 40px`,
            desktop: `24px ${padX} 56px`,
          }),
          display: "flex",
          flexDirection: "column",
          gap: pick(bp, { mobile: 20, desktop: 28 }),
        }}
      >
        {/* ── Stat cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)",
            gap: 10,
          }}
        >
          <StatCard
            label="Strategies"
            value={totalStrategies === 0 ? "0" : String(totalStrategies)}
            sub={
              totalStrategies === 0
                ? "none yet"
                : `${deployedStrategies} deployed · ${draftStrategies} draft`
            }
            accentColor={T.primary}
            href="/strategies"
          />
          <StatCard
            label="Signals today"
            value={String(signalsToday)}
            sub={
              signalsToday === 0
                ? "no signals yet"
                : `across ${strategiesToday} ${strategiesToday === 1 ? "strategy" : "strategies"}`
            }
            accentColor={T.deploy}
            href="/signals"
          />
          <StatCard
            label="Active bots"
            value={String(runningBots)}
            sub={
              totalBots === 0
                ? "no bots yet"
                : pausedBots > 0
                ? `${pausedBots} paused · ${totalBots} total`
                : `${totalBots} total`
            }
            accentColor={T.accent}
            href="/bots"
          />
          <StatCard
            label="Best backtest"
            value={bestBt}
            sub={
              bestBt === "—"
                ? "no backtests yet"
                : bestSharpe != null
                ? `sharpe ${bestSharpe.toFixed(2)}`
                : bestBtName
            }
            accentColor={
              bestBt === "—"
                ? T.text3
                : bestBt.startsWith("+")
                ? T.gain
                : T.loss
            }
            href="/backtest"
          />
          <StatCard
            label="Portfolio"
            value={String(openPositionCount)}
            sub={pnlLabel}
            accentColor={T.text2}
            href="/portfolio"
          />
        </div>

        {/* ── Main content grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "3fr 2fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Left: strategies */}
          <ContentCard
            kicker="Your strategies"
            meta={`${totalStrategies} total`}
            href="/strategies"
            linkLabel="View all →"
            empty={strategies.length === 0}
            emptyText="You haven't built any strategies yet."
            emptyAction={
              <Btn
                variant="primary"
                size="sm"
                icon={Icon.plus}
                onClick={() => router.push("/strategies")}
              >
                New strategy
              </Btn>
            }
          >
            <div style={{ marginTop: 4 }}>
              {/* Column headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 74px 70px 54px",
                  padding: "6px 14px",
                  borderBottom: `1px solid ${T.outlineVariant}`,
                  fontFamily: T.fontMono,
                  fontSize: 9.5,
                  color: T.text3,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                <span>Name</span>
                <span style={{ textAlign: "right" }}>Backtest</span>
                <span style={{ textAlign: "right" }}>Sharpe</span>
                <span style={{ textAlign: "right" }}>Signals</span>
              </div>
              {strategies.map((s) => (
                <StrategyRow key={s.id} s={s} />
              ))}
            </div>
          </ContentCard>

          {/* Right: signals + bots */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Signals */}
            <ContentCard
              kicker="Today's signals"
              meta={`${signalsToday} fired`}
              href="/signals"
              linkLabel="View all →"
              empty={signals.length === 0}
              emptyText="No signals have fired today."
            >
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {signals.map((sig) => (
                  <SignalRow key={sig.id} sig={sig} />
                ))}
              </div>
            </ContentCard>

            {/* Bots */}
            <ContentCard
              kicker="Active bots"
              meta={`${runningBots} running`}
              href="/bots"
              linkLabel="View all →"
              empty={bots.length === 0}
              emptyText="No active bots yet."
              emptyAction={
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/bots")}
                >
                  Set up a bot
                </Btn>
              }
            >
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {bots.map((b) => (
                  <BotItem key={b.id} bot={b} />
                ))}
              </div>
            </ContentCard>
          </div>
        </div>

        {/* ── Portfolio snapshot ── */}
        {positions.length > 0 && (
          <ContentCard
            kicker="Open positions"
            meta={`${openPositionCount} open`}
            href="/portfolio"
            linkLabel="View portfolio →"
            empty={false}
          >
            <div style={{ marginTop: 4 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "70px 1fr 80px"
                    : "70px 60px 90px 90px 90px 1fr",
                  padding: "6px 14px",
                  borderBottom: `1px solid ${T.outlineVariant}`,
                  fontFamily: T.fontMono,
                  fontSize: 9.5,
                  color: T.text3,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                <span>Symbol</span>
                {!isMobile && <span style={{ textAlign: "right" }}>Qty</span>}
                {!isMobile && <span style={{ textAlign: "right" }}>Entry</span>}
                {!isMobile && <span style={{ textAlign: "right" }}>Now</span>}
                <span style={{ textAlign: "right" }}>P&amp;L</span>
                <span style={{ paddingLeft: isMobile ? 0 : 14 }}>Strategy</span>
              </div>
              {positions.map((p) => (
                <PositionRow key={p.id} pos={p} isMobile={isMobile} />
              ))}
            </div>
          </ContentCard>
        )}

        {/* ── Quick actions ── */}
        <div>
          <Kicker>Quick actions</Kicker>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            <Btn
              variant="primary"
              size="sm"
              icon={Icon.plus}
              style={{ boxShadow: `0 3px 10px ${T.primary}55` }}
              onClick={() => router.push("/strategies")}
            >
              New strategy
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => router.push("/signals")}
            >
              View signals
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => router.push("/bots")}
            >
              Manage bots
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => router.push("/portfolio")}
            >
              Log a trade
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => router.push("/backtest")}
            >
              Run backtest
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => router.push("/leaderboard")}
            >
              Leaderboard
            </Btn>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accentColor,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  accentColor: string;
  href: string;
}) {
  const T = useT();
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "16px 18px 14px",
        background: T.surface2,
        borderRadius: 10,
        boxShadow: `0 0 0 1px ${T.outlineFaint}`,
        textDecoration: "none",
        borderLeft: `3px solid ${accentColor}`,
        transition: "box-shadow 120ms ease",
      }}
    >
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 9.5,
          color: T.text3,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 30,
          fontWeight: 500,
          color: accentColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.3,
          marginTop: 8,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          marginTop: 8,
          lineHeight: 1.4,
        }}
      >
        {sub}
      </div>
    </Link>
  );
}

function ContentCard({
  kicker,
  meta,
  href,
  linkLabel,
  children,
  empty,
  emptyText,
  emptyAction,
}: {
  kicker: string;
  meta?: string;
  href: string;
  linkLabel?: string;
  children?: ReactNode;
  empty: boolean;
  emptyText?: string;
  emptyAction?: ReactNode;
}) {
  const T = useT();
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 12,
        boxShadow: `0 0 0 1px ${T.outlineFaint}`,
        padding: "16px 0 4px",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 16px 12px",
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Kicker>{kicker}</Kicker>
          {meta && (
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 10.5,
                color: T.text3,
              }}
            >
              {meta}
            </span>
          )}
        </div>
        {linkLabel && (
          <Link
            href={href}
            style={{
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.primaryLight,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {linkLabel}
          </Link>
        )}
      </div>

      {empty ? (
        <div
          style={{
            padding: "24px 16px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 11.5,
              color: T.text3,
            }}
          >
            {emptyText}
          </span>
          {emptyAction}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function StrategyRow({ s }: { s: DashStrategy }) {
  const T = useT();
  const statusColors: Record<string, string> = {
    DEPLOYED: T.deploy,
    DRAFT: T.text3,
    PAUSED: T.warning,
    ARCHIVED: T.text3,
  };
  const c = statusColors[s.status] ?? T.text3;

  return (
    <Link
      href={`/strategies/${s.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 74px 70px 54px",
        padding: "9px 14px",
        borderBottom: `1px solid ${T.outlineFaint}`,
        textDecoration: "none",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            background: c,
            flexShrink: 0,
            boxShadow: s.status === "DEPLOYED" ? `0 0 0 2px ${c}33` : "none",
          }}
        />
        <span
          style={{
            fontFamily: T.fontSans,
            fontSize: 13,
            color: T.text,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {s.name}
        </span>
      </div>
      <span
        style={{
          textAlign: "right",
          fontFamily: T.fontMono,
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color:
            s.bt === "—"
              ? T.text3
              : s.bt.startsWith("+")
              ? T.gain
              : T.loss,
        }}
      >
        {s.bt}
      </span>
      <span
        style={{
          textAlign: "right",
          fontFamily: T.fontMono,
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: T.text2,
        }}
      >
        {s.sharpe != null ? s.sharpe.toFixed(2) : "—"}
      </span>
      <span
        style={{
          textAlign: "right",
          fontFamily: T.fontMono,
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: s.signals > 0 ? T.deploy : T.text3,
          fontWeight: s.signals > 0 ? 600 : 400,
        }}
      >
        {s.signals > 0 ? String(s.signals) : "—"}
      </span>
    </Link>
  );
}

function SignalRow({ sig }: { sig: DashSignal }) {
  const T = useT();
  const isBuy = sig.dir === "BUY";
  const dirColor = isBuy ? T.gain : T.loss;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        borderBottom: `1px solid ${T.outlineFaint}`,
      }}
    >
      {/* Direction badge */}
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 0.4,
          color: dirColor,
          background: dirColor + "18",
          padding: "2px 6px",
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        {sig.dir}
      </span>
      {/* Symbol */}
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 13,
          color: T.text,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {sig.symbol}
      </span>
      {/* Price */}
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 11.5,
          color: T.text2,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {sig.price > 0 ? sig.price.toFixed(2) : ""}
      </span>
      {/* Strategy */}
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sig.strategy}
      </span>
      {/* Age */}
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          flexShrink: 0,
        }}
      >
        {sig.age}
      </span>
    </div>
  );
}

function BotItem({ bot }: { bot: DashBot }) {
  const T = useT();
  const isRunning = bot.status === "RUNNING";
  const dotColor = isRunning ? T.gain : bot.status === "PAUSED" ? T.warning : T.text3;
  const pnlColor = bot.pnl >= 0 ? T.gain : T.loss;

  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        borderBottom: `1px solid ${T.outlineFaint}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: dotColor,
          boxShadow: isRunning ? `0 0 0 2px ${dotColor}33` : "none",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: T.fontSans,
          fontSize: 13,
          color: T.text,
          fontWeight: 500,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {bot.name}
      </span>
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {bot.strategy}
      </span>
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: pnlColor,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {bot.pnl >= 0 ? "+" : ""}
        {bot.pnl.toFixed(1)}%
      </span>
    </div>
  );

  return bot.id ? (
    <Link href={`/bots/${bot.id}`} style={{ textDecoration: "none" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function PositionRow({
  pos,
  isMobile,
}: {
  pos: DashPosition;
  isMobile: boolean;
}) {
  const T = useT();
  const pnlPct =
    pos.now != null && pos.entry > 0
      ? ((pos.now - pos.entry) / pos.entry) * 100
      : null;
  const pnlColor =
    pnlPct == null ? T.text3 : pnlPct >= 0 ? T.gain : T.loss;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "70px 1fr 80px"
          : "70px 60px 90px 90px 90px 1fr",
        padding: "9px 14px",
        borderBottom: `1px solid ${T.outlineFaint}`,
        alignItems: "center",
      }}
    >
      {/* Symbol */}
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 13,
          color: T.text,
          fontWeight: 600,
        }}
      >
        {pos.sym}
      </span>

      {/* Qty — desktop only */}
      {!isMobile && (
        <span
          style={{
            textAlign: "right",
            fontFamily: T.fontMono,
            fontSize: 12,
            color: T.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pos.qty.toLocaleString()}
        </span>
      )}

      {/* Entry — desktop only */}
      {!isMobile && (
        <span
          style={{
            textAlign: "right",
            fontFamily: T.fontMono,
            fontSize: 12,
            color: T.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pos.entry.toFixed(2)}
        </span>
      )}

      {/* Now — desktop only */}
      {!isMobile && (
        <span
          style={{
            textAlign: "right",
            fontFamily: T.fontMono,
            fontSize: 12,
            color: T.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pos.now != null ? pos.now.toFixed(2) : "—"}
        </span>
      )}

      {/* P&L */}
      <span
        style={{
          textAlign: "right",
          fontFamily: T.fontMono,
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: pnlColor,
          fontWeight: pnlPct != null ? 600 : 400,
        }}
      >
        {pnlPct != null
          ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`
          : "—"}
      </span>

      {/* Strategy */}
      <span
        style={{
          paddingLeft: isMobile ? 0 : 14,
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {pos.strat ?? "Manual"}
      </span>
    </div>
  );
}
