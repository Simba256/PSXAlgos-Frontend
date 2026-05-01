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

// One backtest run, flattened for table rendering. Different time windows
// of the same strategy = different rows (matched 1:1 with backend rows
// from GET /strategies/runs).
export interface RunRow {
  id: number;
  strategyId: number;
  strategyName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  totalReturn: number | null;
  sharpe: number | null;
  maxDD: number | null;
  totalTrades: number;
  ranLabel: string;
  ranMinutes: number;
}

type SortKey = "ran" | "strategy" | "return" | "sharpe" | "trades";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "ran", label: "most recent run", defaultDir: "asc" },
  { key: "return", label: "total return", defaultDir: "desc" },
  { key: "sharpe", label: "sharpe", defaultDir: "desc" },
  { key: "trades", label: "trades", defaultDir: "desc" },
  { key: "strategy", label: "strategy", defaultDir: "asc" },
];

function compare(a: RunRow, b: RunRow, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (key) {
    case "ran":
      return (a.ranMinutes - b.ranMinutes) * sign;
    case "strategy":
      return a.strategyName.localeCompare(b.strategyName) * sign;
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
    case "trades":
      return (a.totalTrades - b.totalTrades) * sign;
  }
}

// "Mar 1 → Jun 30, '24" when the window stays in one calendar year,
// "Mar 1 '24 → Jun 30 '25" when it crosses. Day precision is enough.
function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} → ${endIso}`;
  }
  const monthDay = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const yr2 = (d: Date) => String(d.getUTCFullYear()).slice(2);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${monthDay(start)} → ${monthDay(end)}, '${yr2(end)}`;
  }
  return `${monthDay(start)} '${yr2(start)} → ${monthDay(end)} '${yr2(end)}`;
}

export function BacktestIndexView({
  rows,
  hasStrategies,
}: {
  rows: RunRow[];
  hasStrategies: boolean;
}) {
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
  const empty = total === 0;
  const distinctStrategies = useMemo(
    () => new Set(rows.map((r) => r.strategyId)).size,
    [rows],
  );

  return (
    <AppFrame route="/backtest">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker="Validation · prove the rules before they trade"
          title={
            <>
              <span style={{ fontWeight: 400, color: T.text2 }}>Backtest</span>{" "}
              <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
                {empty ? "·" : `· ${total} ${total === 1 ? "run" : "runs"}`}
              </span>
            </>
          }
          meta={
            empty ? (
              <span>
                {hasStrategies
                  ? "no runs yet — pick a strategy and run a backtest"
                  : "no strategies yet — build one to backtest it"}
              </span>
            ) : (
              <>
                <span>
                  across {distinctStrategies}{" "}
                  {distinctStrategies === 1 ? "strategy" : "strategies"}
                </span>
                <span style={{ color: T.text3 }}>
                  pick a row to open results · re-run from the strategy editor
                </span>
              </>
            )
          }
          actions={
            <>
              <Link href="/strategies" style={{ textDecoration: "none" }}>
                <Btn variant="ghost" size="sm">
                  Strategies
                </Btn>
              </Link>
              {hasStrategies && (
                <Link href="/backtest/new" style={{ textDecoration: "none" }}>
                  <Btn variant="primary" size="sm" icon={Icon.plus}>
                    Run new backtest
                  </Btn>
                </Link>
              )}
            </>
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
            <EmptyState hasStrategies={hasStrategies} />
          ) : (
            <>
              <SortBar sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }} />
              <RunsTable rows={sorted} />
            </>
          )}
        </div>
      </div>
    </AppFrame>
  );
}

function EmptyState({ hasStrategies }: { hasStrategies: boolean }) {
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
        {hasStrategies ? "no runs yet" : "nothing to backtest yet"}
      </div>
      <div style={{ fontSize: 15, color: T.text2, lineHeight: 1.55 }}>
        {hasStrategies ? (
          <>
            You have strategies but none have been backtested yet. Hit{" "}
            <em>Run new backtest</em> below to pick a strategy and date range —
            every run you execute will land here, including different time
            windows of the same strategy.
          </>
        ) : (
          <>
            Backtests run against strategies — the entry/exit rules you author
            over on{" "}
            <Link href="/strategies" style={{ color: T.primaryLight }}>
              Strategies
            </Link>
            . Build one first, then come back here to validate it against
            historical PSX data.
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {hasStrategies ? (
          <Link href="/backtest/new" style={{ textDecoration: "none" }}>
            <Btn variant="primary" size="sm" icon={Icon.plus}>
              Run new backtest
            </Btn>
          </Link>
        ) : (
          <Link href="/strategies/new" style={{ textDecoration: "none" }}>
            <Btn variant="primary" size="sm" icon={Icon.plus}>
              Build a strategy
            </Btn>
          </Link>
        )}
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
        flexWrap: "wrap",
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

function RunsTable({ rows }: { rows: RunRow[] }) {
  const T = useT();
  const router = useRouter();
  const cols: Col[] = [
    { label: "strategy", width: "1.4fr", primary: true, mono: false },
    { label: "window", width: "1fr", mono: true },
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
    return [
      r.strategyName,
      formatRange(r.startDate, r.endDate),
      totalReturn === null ? "—" : `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`,
      sharpe === null ? "—" : sharpe.toFixed(2),
      maxDD === null ? "—" : `${maxDD.toFixed(1)}%`,
      r.totalTrades.toLocaleString(),
      r.ranLabel,
      "→",
    ];
  });

  return (
    <TerminalTable
      cols={cols}
      rows={data}
      onRowClick={(_, ri) => {
        const row = rows[ri];
        // Deep link to this specific run; backtest-view hydrates it from the
        // backtest_id query param (page.tsx:107-118).
        router.push(`/backtest?strategy_id=${row.strategyId}&backtest_id=${row.id}`);
      }}
      renderCell={(cell, ci, ri) => {
        const row = rows[ri];
        if (ci === 0) {
          return <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>;
        }
        if (ci === 1) {
          return <span style={{ color: T.text3, fontSize: 11 }}>{cell as ReactNode}</span>;
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
          return <span style={{ color: T.text3, fontSize: 13 }}>{cell as ReactNode}</span>;
        }
        return cell as ReactNode;
      }}
    />
  );
}
