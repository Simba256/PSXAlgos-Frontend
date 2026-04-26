"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  EditorialHeader,
  TerminalTable,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";

export type IndexStatus = "DEPLOYED" | "DRAFT" | "PAUSED" | "ARCHIVED";

export interface BacktestIndexRow {
  id: string;
  name: string;
  status: IndexStatus;
  // null = strategy has never been backtested
  totalReturn: number | null;
  sharpe: number | null;
  maxDD: number | null;
  totalTrades: number | null;
  // Relative recency string for display ("just now", "2d ago", "never")
  ranLabel: string;
  // Minutes since the latest backtest completed; MAX_SAFE_INTEGER if never.
  // Used for sorting; "newest run first" puts smallest values at the top.
  ranMinutes: number;
}

type SortKey = "ran" | "name" | "return" | "sharpe";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  // smallest minutes-ago = most recent
  { key: "ran", label: "most recent run", defaultDir: "asc" },
  { key: "return", label: "total return", defaultDir: "desc" },
  { key: "sharpe", label: "sharpe", defaultDir: "desc" },
  { key: "name", label: "name", defaultDir: "asc" },
];

function compare(a: BacktestIndexRow, b: BacktestIndexRow, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (key) {
    case "ran":
      return (a.ranMinutes - b.ranMinutes) * sign;
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "return": {
      const av = a.totalReturn ?? -Infinity;
      const bv = b.totalReturn ?? -Infinity;
      return (av - bv) * sign;
    }
    case "sharpe": {
      const av = a.sharpe ?? -Infinity;
      const bv = b.sharpe ?? -Infinity;
      return (av - bv) * sign;
    }
  }
}

export function BacktestIndexView({ rows }: { rows: BacktestIndexRow[] }) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  const [sortKey, setSortKey] = useState<SortKey>("ran");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const copy = rows.slice();
    copy.sort((a, b) => compare(a, b, sortKey, sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  const total = rows.length;
  const withBacktest = rows.filter((r) => r.totalTrades !== null).length;
  const withoutBacktest = total - withBacktest;
  const empty = total === 0;

  return (
    <AppFrame route="/backtest">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker="Validation · prove the rules before they trade"
          title={
            <>
              <span style={{ fontWeight: 400, color: T.text2 }}>Backtest</span>{" "}
              <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
                {empty ? "·" : `· ${total} ${total === 1 ? "strategy" : "strategies"}`}
              </span>
            </>
          }
          meta={
            empty ? (
              <span>no strategies yet — build one to backtest it</span>
            ) : (
              <>
                <span>
                  <span style={{ color: T.gain }}>●</span> {withBacktest} backtested
                </span>
                <span>{withoutBacktest} pending</span>
                <span style={{ color: T.text3 }}>
                  pick a row to view results · re-run from the strategy editor
                </span>
              </>
            )
          }
          actions={
            <Link href="/strategies/new" style={{ textDecoration: "none" }}>
              <Btn variant="primary" size="sm" icon={Icon.plus}>
                New strategy
              </Btn>
            </Link>
          }
        />

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `20px ${padX} 28px`,
              desktop: `28px ${padX} 40px`,
            }),
          }}
        >
          {empty ? (
            <EmptyState />
          ) : (
            <>
              <SortBar sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }} />
              <BacktestTable rows={sorted} />
            </>
          )}
        </div>
      </div>
    </AppFrame>
  );
}

function EmptyState() {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 14,
        padding: "32px 0",
        maxWidth: 560,
      }}
    >
      <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.text3, letterSpacing: 0.6, textTransform: "uppercase" }}>
        nothing to backtest yet
      </div>
      <div style={{ fontSize: 15, color: T.text2, lineHeight: 1.55 }}>
        Backtests run against strategies — the entry/exit rules you author over on{" "}
        <Link href="/strategies" style={{ color: T.primaryLight }}>
          Strategies
        </Link>
        . Build one first, then come back here (or hit the Run backtest button on the strategy editor) to validate it against historical PSX data.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Link href="/strategies/new" style={{ textDecoration: "none" }}>
          <Btn variant="primary" size="sm" icon={Icon.plus}>
            Build a strategy
          </Btn>
        </Link>
        <Link href="/strategies" style={{ textDecoration: "none" }}>
          <Btn variant="ghost" size="sm">
            See strategies
          </Btn>
        </Link>
      </div>
    </div>
  );
}

function SortBar({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey, d: SortDir) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 14,
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.text3,
      }}
    >
      <span style={{ marginRight: 4 }}>sort:</span>
      {SORT_OPTIONS.map((opt) => {
        const active = sortKey === opt.key;
        const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              if (active) {
                onSort(opt.key, sortDir === "asc" ? "desc" : "asc");
              } else {
                onSort(opt.key, opt.defaultDir);
              }
            }}
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
            {opt.label} {arrow}
          </button>
        );
      })}
    </div>
  );
}

function BacktestTable({ rows }: { rows: BacktestIndexRow[] }) {
  const T = useT();
  const router = useRouter();
  // Compact, fits comfortably without horizontal scroll. Whole row is the
  // affordance — clicking opens results, or kicks off a first run for
  // strategies that haven't been backtested yet.
  const cols: Col[] = [
    { label: "strategy", width: "1.5fr", primary: true, mono: false },
    { label: "status", width: "100px" },
    { label: "total return", align: "right", width: "100px" },
    { label: "sharpe", align: "right", width: "70px" },
    { label: "max DD", align: "right", width: "80px" },
    { label: "trades", align: "right", width: "70px" },
    { label: "ran", align: "right", width: "100px", mobileFullWidth: true },
    { label: "", width: "32px", align: "right" },
  ];

  type Cell = ReactNode | string | number;

  const data: Cell[][] = rows.map((r) => {
    const totalReturn = r.totalReturn;
    const sharpe = r.sharpe;
    const maxDD = r.maxDD;
    const trades = r.totalTrades;
    return [
      r.name,
      r.status,
      totalReturn === null ? "—" : `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`,
      sharpe === null ? "—" : sharpe.toFixed(2),
      maxDD === null ? "—" : `${maxDD.toFixed(1)}%`,
      trades === null ? "—" : trades.toLocaleString(),
      r.ranLabel,
      r.totalTrades === null ? "▸" : "→",
    ];
  });

  return (
    <TerminalTable
      cols={cols}
      rows={data}
      onRowClick={(_, ri) => {
        const row = rows[ri];
        const hasRun = row.totalTrades !== null;
        router.push(
          hasRun
            ? `/backtest?strategy_id=${row.id}`
            : `/backtest?strategy_id=${row.id}&run=1`,
        );
      }}
      renderCell={(cell, ci, ri) => {
        const row = rows[ri];
        if (ci === 0) {
          return (
            <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>
          );
        }
        if (ci === 1) {
          const color =
            row.status === "DEPLOYED"
              ? T.gain
              : row.status === "DRAFT"
                ? T.text3
                : row.status === "PAUSED"
                  ? T.warning
                  : T.text3;
          return <span style={{ color, fontFamily: T.fontMono, fontSize: 11 }}>{row.status}</span>;
        }
        if (ci === 2) {
          if (row.totalReturn === null) return <span style={{ color: T.text3 }}>—</span>;
          const isGain = row.totalReturn >= 0;
          return <span style={{ color: isGain ? T.gain : T.loss }}>{cell as ReactNode}</span>;
        }
        if (ci === 4) {
          if (row.maxDD === null) return <span style={{ color: T.text3 }}>—</span>;
          return <span style={{ color: T.loss }}>{cell as ReactNode}</span>;
        }
        if (ci === 6) {
          return (
            <span style={{ color: row.ranMinutes === Number.MAX_SAFE_INTEGER ? T.text3 : T.text2 }}>
              {cell as ReactNode}
            </span>
          );
        }
        if (ci === 7) {
          // Glyph affordance: → for "open results", ▸ for "run first backtest".
          const hasRun = row.totalTrades !== null;
          return (
            <span style={{ color: hasRun ? T.text3 : T.primaryLight, fontSize: 13 }}>
              {cell as ReactNode}
            </span>
          );
        }
        return cell as ReactNode;
      }}
    />
  );
}
