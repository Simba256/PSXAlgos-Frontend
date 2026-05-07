"use client";

import Link from "next/link";
import { useT } from "@/components/theme";
import { StatusDot } from "@/components/atoms";

// Compact bottom-right pill that replaces the three OutputPins (Backtest /
// Live signals / Automate) the canvas used to anchor on the right side. The
// canvas right side now belongs to the RiskDefaultsNode pin; backtest /
// deploy / automate status moved into this strip so the canvas isn't
// double-occupied. See `docs/EXITS_IMPLEMENTATION_PLAN.md` Phase 4.
//
// Each segment is a Link so clicks still route to the relevant page —
// keeping the navigational role the OutputPins had, just in a tighter form
// factor that doesn't compete with the new right-side risk-defaults pin.

export interface StatusStripProps {
  strategyId: number;
  deployed: boolean;
  // Last completed backtest summary, if any. Pulled from the strategy
  // response's `latest_backtest` join. Null when no backtest has been run.
  backtest: {
    totalReturnPct: number;
    completedAt: string;
  } | null;
  // Optional bot binding label — "Bot Alpha" / "3 bots". Null when no bot
  // is bound to this strategy. Phase 6 will wire this from the dependents
  // call; until then the editor passes null and the segment hides.
  botBinding: string | null;
}

export function StatusStrip({
  strategyId,
  deployed,
  backtest,
  botBinding,
}: StatusStripProps) {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "4px 6px",
        borderRadius: 999,
        background: T.surface2 + "e6",
        backdropFilter: "blur(10px)",
        border: `1px solid ${T.outlineFaint}`,
        fontFamily: T.fontMono,
        fontSize: 11,
        userSelect: "none",
      }}
    >
      <BacktestSegment strategyId={strategyId} backtest={backtest} />
      <Divider />
      <DeploySegment deployed={deployed} />
      {botBinding !== null && (
        <>
          <Divider />
          <BotSegment strategyId={strategyId} label={botBinding} />
        </>
      )}
    </div>
  );
}

function BacktestSegment({
  strategyId,
  backtest,
}: {
  strategyId: number;
  backtest: StatusStripProps["backtest"];
}) {
  const T = useT();
  const label = backtest
    ? `${backtest.totalReturnPct >= 0 ? "+" : ""}${backtest.totalReturnPct.toFixed(1)}% · ${formatRelative(backtest.completedAt)}`
    : "No backtest yet";
  const color = backtest ? (backtest.totalReturnPct >= 0 ? T.gain : T.loss) : T.text3;
  return (
    <Link
      href={
        backtest
          ? `/backtest?strategy_id=${strategyId}`
          : `/backtest/new?strategy_id=${strategyId}`
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        textDecoration: "none",
        color: T.text2,
      }}
    >
      <span style={{ color: T.text3, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" }}>
        Backtest
      </span>
      <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{label}</span>
    </Link>
  );
}

function DeploySegment({ deployed }: { deployed: boolean }) {
  const T = useT();
  return (
    <Link
      href="/signals"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        textDecoration: "none",
        color: T.text2,
      }}
    >
      <StatusDot color={deployed ? T.deploy : T.text3} pulse={deployed} />
      <span style={{ color: deployed ? T.deploy : T.text3 }}>
        {deployed ? "Deployed" : "Paused"}
      </span>
    </Link>
  );
}

function BotSegment({ strategyId, label }: { strategyId: number; label: string }) {
  const T = useT();
  return (
    <Link
      href={`/bots/new?strategy_id=${strategyId}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        textDecoration: "none",
        color: T.text2,
      }}
    >
      <span style={{ color: T.text3, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" }}>
        Bot
      </span>
      <span style={{ color: T.accent }}>{label}</span>
    </Link>
  );
}

function Divider() {
  const T = useT();
  return <span style={{ width: 1, height: 14, background: T.outlineFaint }} />;
}

// Compact relative-time formatter ("2m ago", "3h ago", "yesterday"). Stays
// client-side and locale-agnostic — the editor doesn't need full i18n here,
// just a tight pill-friendly string.
function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, (Date.now() - t) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 30) return `${diffDay}d ago`;
  // Older than a month — fall back to absolute date in YYYY-MM-DD shape.
  return iso.slice(0, 10);
}
