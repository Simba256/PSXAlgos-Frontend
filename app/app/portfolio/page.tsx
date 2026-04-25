"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT, type Tokens } from "@/components/theme";
import {
  Btn,
  DotRow,
  EditorialHeader,
  FlashToast,
  Kicker,
  Lede,
  Modal,
  Ribbon,
  TerminalTable,
  useFlash,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";
import { drainSignalTrades } from "@/lib/signal-log-bridge";
import {
  fromCSV,
  newId,
  todayLabel,
  toCSV,
  type ClosedTrade,
  type CloseReason,
  type OpenPosition,
  type TradeSource,
} from "@/lib/portfolio-csv";

/* ────────── Seed + metadata ────────── */

const SEED_POSITIONS: OpenPosition[] = [
  { id: "p1", sym: "OGDC", qty: 2000, entry: 118.4, now: 132.6, source: "signal", strat: "RSI Bounce v1", date: "Apr 02", stop: 115.0, target: 130.0 },
  { id: "p2", sym: "LUCK", qty: 300, entry: 642.0, now: 619.0, source: "signal", strat: "Momentum Breakout", date: "Apr 08", stop: 625.0, target: 690.0 },
  { id: "p3", sym: "ENGRO", qty: 800, entry: 265.1, now: 281.2, source: "manual", strat: null, date: "Mar 20", stop: 255.0, target: 290.0 },
  { id: "p4", sym: "FFC", qty: 4000, entry: 95.2, now: 108.1, source: "signal", strat: "Mean Rev · Banks", date: "Mar 20", stop: 92.0, target: 108.0 },
  { id: "p5", sym: "HBL", qty: 1800, entry: 86.1, now: 89.95, source: "manual", strat: null, date: "Mar 12", stop: 83.0, target: 95.0 },
];

const SEED_CLOSED: ClosedTrade[] = [
  { id: "c1", sym: "MCB", qty: 1200, entry: 204.1, exit: 198.8, pnl: -6360, ret: -2.6, date: "Mar 14", reason: "Stop loss", source: "manual", strat: null },
  { id: "c2", sym: "PPL", qty: 2500, entry: 92.4, exit: 101.2, pnl: 22000, ret: 9.5, date: "Feb 28", reason: "Target hit", source: "signal", strat: "RSI Bounce v1" },
  { id: "c3", sym: "NBP", qty: 3000, entry: 48.6, exit: 52.1, pnl: 10500, ret: 7.2, date: "Feb 14", reason: "Manual close", source: "manual", strat: null },
];

const SECTOR_MAP: Record<string, string> = {
  OGDC: "Oil & Gas", PPL: "Oil & Gas", POL: "Oil & Gas", MARI: "Oil & Gas",
  LUCK: "Cement", DGKC: "Cement", MLCF: "Cement", FCCL: "Cement",
  HBL: "Banks", UBL: "Banks", MCB: "Banks", NBP: "Banks", BAFL: "Banks", BAHL: "Banks", MEBL: "Banks",
  FFC: "Fertilizer", FFBL: "Fertilizer", ENGRO: "Fertilizer", EFERT: "Fertilizer",
  PSO: "Oil Marketing", SHEL: "Oil Marketing", APL: "Oil Marketing",
};
const SECTOR_COLOR = (T: Tokens): Record<string, string> => ({
  "Oil & Gas": T.primary,
  "Cement": T.accent,
  "Banks": T.deploy,
  "Fertilizer": T.warning,
  "Oil Marketing": T.primaryLight,
  "Other": T.text3,
});

/* ────────── Page ────────── */

export default function PortfolioPage() {
  const [positions, setPositions] = useState<OpenPosition[]>(SEED_POSITIONS);
  const [closed, setClosed] = useState<ClosedTrade[]>(SEED_CLOSED);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<OpenPosition | null>(null);
  const { flash, setFlash } = useFlash();
  const importRef = useRef<HTMLInputElement>(null);

  const showEmpty = forceEmpty || (positions.length === 0 && closed.length === 0);
  const visiblePositions = forceEmpty ? [] : positions;
  const visibleClosed = forceEmpty ? [] : closed;

  useEffect(() => {
    const pending = drainSignalTrades();
    if (pending.length === 0) return;
    const incoming: OpenPosition[] = pending.map((p) => ({ ...p, id: newId("p") }));
    setPositions((rows) => [...incoming, ...rows]);
    setForceEmpty(false);
    const label =
      incoming.length === 1
        ? `Logged from signals · ${incoming[0].sym}`
        : `Logged ${incoming.length} trades from signals`;
    setFlash(label);
  }, []);

  function handleLog(p: Omit<OpenPosition, "id">) {
    setPositions((rows) => [{ ...p, id: newId("p") }, ...rows]);
    setLogOpen(false);
    setForceEmpty(false);
    setFlash(`Logged ${p.sym} · ${p.qty.toLocaleString()} @ ${p.entry.toFixed(2)}`);
  }

  function handleClose(pos: OpenPosition, exit: number, reason: CloseReason, date: string) {
    const pnl = Math.round((exit - pos.entry) * pos.qty);
    const ret = ((exit - pos.entry) / pos.entry) * 100;
    const record: ClosedTrade = {
      id: newId("c"),
      sym: pos.sym,
      qty: pos.qty,
      entry: pos.entry,
      exit,
      pnl,
      ret: Number(ret.toFixed(2)),
      date,
      reason,
      source: pos.source,
      strat: pos.strat,
    };
    setClosed((rows) => [record, ...rows]);
    setPositions((rows) => rows.filter((r) => r.id !== pos.id));
    setCloseTarget(null);
    setFlash(`Closed ${pos.sym} · ${pnl >= 0 ? "+" : ""}${pnl.toLocaleString()} P&L`);
  }

  function handleExport() {
    const csv = toCSV(positions, closed);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFlash(`Exported ${positions.length + closed.length} rows`);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = fromCSV(text);
      if (!parsed.open.length && !parsed.closed.length) {
        setFlash("No valid rows found in file");
        return;
      }
      setPositions((rows) => [...parsed.open, ...rows]);
      setClosed((rows) => [...parsed.closed, ...rows]);
      setForceEmpty(false);
      setFlash(`Imported ${parsed.open.length} open · ${parsed.closed.length} closed`);
    } catch (err) {
      setFlash(`Import failed: ${err instanceof Error ? err.message : "bad file"}`);
    }
  }

  function triggerImport() {
    importRef.current?.click();
  }

  return (
    <AppFrame route="/portfolio">
      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = "";
        }}
      />
      <Body
        positions={visiblePositions}
        closed={visibleClosed}
        empty={showEmpty}
        toggleEmpty={() => setForceEmpty((v) => !v)}
        onLogClick={() => setLogOpen(true)}
        onExport={handleExport}
        onImport={triggerImport}
        onRowClick={(p) => setCloseTarget(p)}
        flash={flash}
      />
      {logOpen && (
        <LogTradeModal onClose={() => setLogOpen(false)} onSubmit={handleLog} />
      )}
      {closeTarget && (
        <ClosePositionModal
          position={closeTarget}
          onClose={() => setCloseTarget(null)}
          onSubmit={handleClose}
        />
      )}
    </AppFrame>
  );
}

/* ────────── Body ────────── */

interface BodyProps {
  positions: OpenPosition[];
  closed: ClosedTrade[];
  empty: boolean;
  toggleEmpty: () => void;
  onLogClick: () => void;
  onExport: () => void;
  onImport: () => void;
  onRowClick: (p: OpenPosition) => void;
  flash: string | null;
}

function Body({
  positions,
  closed,
  empty,
  toggleEmpty,
  onLogClick,
  onExport,
  onImport,
  onRowClick,
  flash,
}: BodyProps) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  const totalCost = positions.reduce((s, p) => s + p.entry * p.qty, 0);
  const totalValue = positions.reduce((s, p) => s + p.now * p.qty, 0);
  const unrealized = totalValue - totalCost;
  const unrealizedPct = totalCost ? (unrealized / totalCost) * 100 : 0;
  const realizedYTD = closed.reduce((s, t) => s + t.pnl, 0);

  const wins = closed.filter((c) => c.pnl > 0).length;
  const losses = closed.length - wins;
  const winRatePct = closed.length ? (wins / closed.length) * 100 : 0;

  const attribution = useMemo(() => buildAttribution(positions, closed), [positions, closed]);
  const signalEdgePkr = attribution.signal.pnl - attribution.manual.pnl;

  const sectors = useMemo(() => buildSectors(positions, T), [positions, T]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <EditorialHeader
        kicker="Manual ledger · your actual broker trades"
        title={
          <>
            Portfolio{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>·</span>{" "}
            {empty ? (
              <span style={{ color: T.text3, fontWeight: 400, fontSize: "0.7em" }}>
                nothing logged yet
              </span>
            ) : (
              "live"
            )}
          </>
        }
        meta={
          empty ? (
            <span>No positions</span>
          ) : (
            <>
              <span>
                {positions.length} open · {closed.length} closed
              </span>
              <span>PKR {(totalValue / 1000).toFixed(0)}K invested</span>
              <span style={{ color: unrealized >= 0 ? T.gain : T.loss }}>
                {unrealized >= 0 ? "+" : ""}
                {unrealized.toLocaleString()} unrealized
              </span>
              <span style={{ color: T.text3 }}>last updated manually · just now</span>
            </>
          )
        }
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={toggleEmpty}>
              {empty ? "Show populated" : "Show empty"}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={onExport}>
              Export CSV
            </Btn>
            <Btn variant="primary" size="sm" icon={Icon.plus} onClick={onLogClick}>
              Log a trade
            </Btn>
          </>
        }
      />

      {flash && <FlashBar message={flash} />}

      {empty ? (
        <EmptyState onLogClick={onLogClick} onImport={onImport} />
      ) : (
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
                desktop: "repeat(5, 1fr)",
              }),
              gap: pick(bp, { mobile: 20, desktop: 36 }),
              paddingBottom: 26,
              borderBottom: `1px solid ${T.outlineFaint}`,
            }}
          >
            <Lede
              label="Market value"
              value={`PKR ${(totalValue / 1000).toFixed(0)}K`}
              sub={`cost ${(totalCost / 1000).toFixed(0)}K`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Unrealized P&L"
              value={`${unrealized >= 0 ? "+" : ""}${unrealized.toLocaleString()}`}
              color={unrealized >= 0 ? T.gain : T.loss}
              sub={`${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(2)}%`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Realized (YTD)"
              value={`${realizedYTD >= 0 ? "+" : ""}${realizedYTD.toLocaleString()}`}
              color={realizedYTD >= 0 ? T.gain : T.loss}
              sub={`${closed.length} trade${closed.length === 1 ? "" : "s"} closed`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Signal edge"
              value={`${signalEdgePkr >= 0 ? "+" : ""}PKR ${Math.abs(signalEdgePkr).toLocaleString()}`}
              color={signalEdgePkr >= 0 ? T.gain : T.loss}
              sub="signal P&L vs manual P&L"
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Win rate"
              value={closed.length ? `${winRatePct.toFixed(0)}%` : "—"}
              sub={closed.length ? `${wins} win${wins === 1 ? "" : "s"} / ${losses} loss${losses === 1 ? "" : "es"}` : "no closed trades yet"}
              size="clamp(22px, 2.5vw, 28px)"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: pick(bp, {
                mobile: "1fr",
                tablet: "1.1fr 1fr",
                desktop: "1.1fr 1fr",
              }),
              gap: pick(bp, { mobile: 28, tablet: 32, desktop: 48 }),
              marginTop: 28,
            }}
          >
            <div>
              <Ribbon
                kicker="source attribution"
                right={
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
                    where does your edge come from?
                  </span>
                }
              />
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: isMobile ? 12 : 24,
                }}
              >
                <AttributionCard
                  title="Signal trades"
                  data={attribution.signal}
                  accent={T.deploy}
                  bg={T.deploy + "11"}
                  border={`1px solid ${T.deploy}33`}
                />
                <AttributionCard
                  title="Manual trades"
                  data={attribution.manual}
                  accent={T.text3}
                  bg={T.surfaceLow}
                  border={`1px solid ${T.outlineFaint}`}
                />
              </div>
              <AttributionObservation
                signal={attribution.signal}
                manual={attribution.manual}
              />
            </div>

            <div>
              <Ribbon kicker="allocation by sector" />
              <div style={{ marginTop: 14 }}>
                {sectors.length === 0 ? (
                  <div
                    style={{
                      padding: "14px 0",
                      fontSize: 12.5,
                      color: T.text3,
                      fontStyle: "italic",
                    }}
                  >
                    No open positions — nothing to allocate.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "minmax(0, 1fr) 90px max-content"
                        : "minmax(0, 1fr) 160px max-content",
                    }}
                  >
                    {sectors.map(([s, pct, c]) => (
                      <div
                        key={s}
                        style={{
                          display: "grid",
                          gridColumn: "1 / -1",
                          gridTemplateColumns: "subgrid",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: `1px dotted ${T.outlineFaint}`,
                        }}
                      >
                        <span style={{ fontSize: 12.5, color: T.text2 }}>{s}</span>
                        <div style={{ position: "relative", height: 4, background: T.surface3 }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: 4, background: c }} />
                        </div>
                        <span
                          style={{
                            fontFamily: T.fontMono,
                            fontSize: 11,
                            color: T.text3,
                            textAlign: "right",
                          }}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 40 }}>
            <Ribbon
              kicker="open positions"
              right={
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
                  tap a row to log a close
                </span>
              }
            />
            <div style={{ marginTop: 8 }}>
              <OpenPositionsTable rows={positions} onRowClick={onRowClick} />
            </div>
          </div>

          <div style={{ marginTop: 36 }}>
            <Ribbon
              kicker="recently closed"
              right={
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
                  {closed.length} total
                </span>
              }
            />
            <div style={{ marginTop: 8 }}>
              <ClosedTable rows={closed} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────── Attribution ────────── */

interface SourceStats {
  open: number;
  closed: number;
  wins: number;
  pnl: number;
  avgRetPct: number | null;
}

interface Attribution {
  signal: SourceStats;
  manual: SourceStats;
}

function buildAttribution(positions: OpenPosition[], closed: ClosedTrade[]): Attribution {
  function pick(src: TradeSource): SourceStats {
    const cs = closed.filter((c) => c.source === src);
    const pnl = cs.reduce((s, c) => s + c.pnl, 0);
    const wins = cs.filter((c) => c.pnl > 0).length;
    const avgRetPct = cs.length ? cs.reduce((s, c) => s + c.ret, 0) / cs.length : null;
    return {
      open: positions.filter((p) => p.source === src).length,
      closed: cs.length,
      wins,
      pnl,
      avgRetPct,
    };
  }
  return { signal: pick("signal"), manual: pick("manual") };
}

function AttributionCard({
  title,
  data,
  accent,
  bg,
  border,
}: {
  title: string;
  data: SourceStats;
  accent: string;
  bg: string;
  border: string;
}) {
  const T = useT();
  const empty = data.open === 0 && data.closed === 0;
  const retColor =
    data.avgRetPct === null
      ? T.text2
      : data.avgRetPct >= 0
        ? T.gain
        : T.loss;
  const winPct = data.closed ? (data.wins / data.closed) * 100 : 0;
  return (
    <div style={{ padding: 20, background: bg, borderRadius: 6, border }}>
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: accent,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 34,
          fontWeight: 500,
          margin: "6px 0",
          color: empty ? T.text3 : retColor,
        }}
      >
        {data.avgRetPct === null
          ? "—"
          : `${data.avgRetPct >= 0 ? "+" : ""}${data.avgRetPct.toFixed(1)}%`}
      </div>
      <div style={{ fontSize: 12, color: T.text2 }}>
        {data.open} open · {data.closed} closed
        {data.closed > 0 && ` · ${winPct.toFixed(0)}% win`}
      </div>
      <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>
        {empty
          ? "no trades yet"
          : data.closed
            ? `${data.pnl >= 0 ? "+" : ""}${data.pnl.toLocaleString()} realized`
            : "open only · no closes"}
      </div>
    </div>
  );
}

function AttributionObservation({
  signal,
  manual,
}: {
  signal: SourceStats;
  manual: SourceStats;
}) {
  const T = useT();
  let text: ReactNode;
  if (signal.avgRetPct === null && manual.avgRetPct === null) {
    text = (
      <>
        <span style={{ color: T.primaryLight }}>Observation ·</span> No closed trades yet — close a
        position to start building attribution data.
      </>
    );
  } else if (signal.avgRetPct !== null && manual.avgRetPct !== null) {
    const diff = signal.avgRetPct - manual.avgRetPct;
    const direction = diff >= 0 ? "outperforming" : "underperforming";
    const color = diff >= 0 ? T.gain : T.loss;
    text = (
      <>
        <span style={{ color: T.primaryLight }}>Observation ·</span> Signal-driven trades are{" "}
        {direction} discretionary trades by
        <span style={{ color }}> {Math.abs(diff).toFixed(1)} percentage points</span>.
        {diff >= 0 ? " Consider deploying more strategies." : " Review recent signal quality."}
      </>
    );
  } else if (signal.avgRetPct !== null) {
    text = (
      <>
        <span style={{ color: T.primaryLight }}>Observation ·</span> Only signal-driven closes so
        far — log a manual close to compare.
      </>
    );
  } else {
    text = (
      <>
        <span style={{ color: T.primaryLight }}>Observation ·</span> Only manual closes so far —
        follow a signal to start building attribution.
      </>
    );
  }
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        background: T.surfaceLow,
        borderRadius: 6,
        fontSize: 12,
        color: T.text2,
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  );
}

/* ────────── Sectors ────────── */

function buildSectors(
  positions: OpenPosition[],
  T: Tokens,
): Array<[string, number, string]> {
  if (!positions.length) return [];
  const totals: Record<string, number> = {};
  let grand = 0;
  for (const p of positions) {
    const sector = SECTOR_MAP[p.sym] ?? "Other";
    const v = p.now * p.qty;
    totals[sector] = (totals[sector] ?? 0) + v;
    grand += v;
  }
  const colors = SECTOR_COLOR(T);
  return Object.entries(totals)
    .map(([s, v]): [string, number, string] => [s, (v / grand) * 100, colors[s] ?? T.text3])
    .sort((a, b) => b[1] - a[1]);
}

/* ────────── Tables ────────── */

function OpenPositionsTable({
  rows,
  onRowClick,
}: {
  rows: OpenPosition[];
  onRowClick: (p: OpenPosition) => void;
}) {
  const T = useT();
  const cols: Col[] = [
    { label: "symbol", width: "90px", primary: true },
    { label: "source", width: "100px", mono: false, mobileFullWidth: true },
    { label: "qty", align: "right", width: "80px" },
    { label: "entry", align: "right", width: "90px" },
    { label: "now", align: "right", width: "90px" },
    { label: "cost", align: "right", width: "120px" },
    { label: "value", align: "right", width: "120px" },
    { label: "p&l", align: "right", width: "110px" },
    { label: "return", align: "right", width: "90px" },
    { label: "held", align: "right", width: "70px" },
  ];
  const tableRows: unknown[][] = rows.map((p) => {
    const pnl = (p.now - p.entry) * p.qty;
    const ret = ((p.now - p.entry) / p.entry) * 100;
    return [p.sym, p, p.qty, p.entry, p.now, p.entry * p.qty, p.now * p.qty, pnl, ret, p.date];
  });
  if (!rows.length) {
    return (
      <div
        style={{
          padding: "22px 0",
          fontSize: 12.5,
          color: T.text3,
          fontStyle: "italic",
          borderTop: `1px solid ${T.outlineFaint}`,
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        No open positions. Use <span style={{ color: T.primaryLight }}>Log a trade</span> to add
        one.
      </div>
    );
  }
  return (
    <TerminalTable
      cols={cols}
      rows={tableRows}
      onRowClick={(_, ri) => onRowClick(rows[ri])}
      renderCell={(cell, ci) => {
        if (ci === 0)
          return <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>;
        if (ci === 1) {
          const p = cell as OpenPosition;
          if (p.source === "signal")
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: T.deploy, fontSize: 10 }}>◉</span>
                <span style={{ color: T.primaryLight, fontSize: 11 }}>{p.strat}</span>
              </span>
            );
          return <span style={{ color: T.text3, fontSize: 11 }}>manual</span>;
        }
        if (ci === 2) return <span style={{ color: T.text2 }}>{(cell as number).toLocaleString()}</span>;
        if (ci === 3 || ci === 4)
          return <span style={{ color: T.text2 }}>{(cell as number).toFixed(2)}</span>;
        if (ci === 5) return <span style={{ color: T.text3 }}>{(cell as number).toLocaleString()}</span>;
        if (ci === 6) return <span style={{ color: T.text }}>{(cell as number).toLocaleString()}</span>;
        if (ci === 7) {
          const n = cell as number;
          return (
            <span style={{ color: n >= 0 ? T.gain : T.loss }}>
              {n >= 0 ? "+" : ""}
              {Math.round(n).toLocaleString()}
            </span>
          );
        }
        if (ci === 8) {
          const n = cell as number;
          return (
            <span style={{ color: n >= 0 ? T.gain : T.loss }}>
              {n >= 0 ? "+" : ""}
              {n.toFixed(2)}%
            </span>
          );
        }
        if (ci === 9) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
        return cell as ReactNode;
      }}
    />
  );
}

function ClosedTable({ rows }: { rows: ClosedTrade[] }) {
  const T = useT();
  const cols: Col[] = [
    { label: "symbol", width: "90px", primary: true },
    { label: "qty", align: "right", width: "80px" },
    { label: "entry", align: "right", width: "90px" },
    { label: "exit", align: "right", width: "90px" },
    { label: "pnl", align: "right", width: "120px" },
    { label: "return", align: "right", width: "90px" },
    { label: "closed", width: "90px" },
    { label: "reason", width: "1fr", mono: false, mobileFullWidth: true },
  ];
  const tableRows: unknown[][] = rows.map((c) => [
    c.sym,
    c.qty,
    c.entry,
    c.exit,
    c.pnl,
    c.ret,
    c.date,
    c.reason,
  ]);
  if (!rows.length) {
    return (
      <div
        style={{
          padding: "22px 0",
          fontSize: 12.5,
          color: T.text3,
          fontStyle: "italic",
          borderTop: `1px solid ${T.outlineFaint}`,
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        No closed trades yet.
      </div>
    );
  }
  return (
    <TerminalTable
      cols={cols}
      rows={tableRows}
      renderCell={(cell, ci) => {
        if (ci === 0)
          return <span style={{ color: T.text2, fontWeight: 500 }}>{cell as ReactNode}</span>;
        if (ci === 1) return <span style={{ color: T.text3 }}>{(cell as number).toLocaleString()}</span>;
        if (ci === 2 || ci === 3)
          return <span style={{ color: T.text2 }}>{(cell as number).toFixed(2)}</span>;
        if (ci === 4) {
          const n = cell as number;
          return (
            <span style={{ color: n >= 0 ? T.gain : T.loss }}>
              {n >= 0 ? "+" : ""}
              {n.toLocaleString()}
            </span>
          );
        }
        if (ci === 5) {
          const n = cell as number;
          return (
            <span style={{ color: n >= 0 ? T.gain : T.loss }}>
              {n >= 0 ? "+" : ""}
              {n.toFixed(1)}%
            </span>
          );
        }
        if (ci === 6) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
        if (ci === 7) {
          const s = String(cell);
          const c = s.includes("Stop") ? T.loss : s.includes("Target") ? T.gain : T.text2;
          return <span style={{ color: c }}>{s}</span>;
        }
        return cell as ReactNode;
      }}
    />
  );
}

/* ────────── Flash ────────── */

function FlashBar({ message }: { message: string }) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  return (
    <div
      style={{
        padding: `8px ${padX}`,
        background: T.primary + "18",
        borderBottom: `1px solid ${T.primary}33`,
        fontFamily: T.fontMono,
        fontSize: 11.5,
        color: T.primaryLight,
        letterSpacing: 0.3,
      }}
    >
      ✓ {message}
    </div>
  );
}

/* ────────── Log Trade Modal ────────── */

function LogTradeModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: Omit<OpenPosition, "id">) => void;
}) {
  const T = useT();
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [source, setSource] = useState<TradeSource>("manual");
  const [strat, setStrat] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qtyN = Number(qty);
  const entryN = Number(entry);
  const stopN = Number(stop);
  const targetN = Number(target);
  const notional = qtyN && entryN ? qtyN * entryN : 0;
  const riskPct =
    stopN && entryN ? ((entryN - stopN) / entryN) * 100 : 0;
  const rewardPct =
    targetN && entryN ? ((targetN - entryN) / entryN) * 100 : 0;

  function submit() {
    if (!sym.trim()) return setError("Symbol is required");
    if (!qtyN || qtyN <= 0) return setError("Quantity must be > 0");
    if (!entryN || entryN <= 0) return setError("Entry price must be > 0");
    if (stopN && stopN >= entryN) return setError("Stop must be below entry");
    if (targetN && targetN <= entryN) return setError("Target must be above entry");
    if (source === "signal" && !strat.trim()) return setError("Strategy is required for signal trades");
    onSubmit({
      sym: sym.trim().toUpperCase(),
      qty: Math.round(qtyN),
      entry: Number(entryN.toFixed(2)),
      now: Number(entryN.toFixed(2)),
      source,
      strat: source === "signal" ? strat.trim() : null,
      date: todayLabel(),
      stop: stopN ? Number(stopN.toFixed(2)) : 0,
      target: targetN ? Number(targetN.toFixed(2)) : 0,
    });
  }

  return (
    <Modal onClose={onClose} width={600} label="Log manual trade">
      <div style={{ padding: "22px 26px 10px" }}>
        <Kicker color={T.primaryLight}>log manual trade to ledger</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 26,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.5,
          }}
        >
          New position
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          fill in what you actually bought — no broker sync
        </div>
      </div>

      <div style={{ padding: "14px 26px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <ModalInput
            label="Symbol"
            value={sym}
            onChange={setSym}
            placeholder="OGDC"
            transform={(v) => v.toUpperCase()}
            mono
          />
          <ModalInput
            label="Quantity"
            value={qty}
            onChange={setQty}
            placeholder="1000"
            suffix="sh"
            type="number"
            mono
          />
          <ModalInput
            label="Entry price"
            value={entry}
            onChange={setEntry}
            placeholder="118.40"
            suffix="PKR"
            type="number"
            mono
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <ModalInput
            label="Stop loss"
            value={stop}
            onChange={setStop}
            placeholder="optional"
            suffix={stopN && entryN ? `${riskPct >= 0 ? "−" : "+"}${Math.abs(riskPct).toFixed(1)}%` : "PKR"}
            type="number"
            mono
          />
          <ModalInput
            label="Take profit"
            value={target}
            onChange={setTarget}
            placeholder="optional"
            suffix={targetN && entryN ? `+${rewardPct.toFixed(1)}%` : "PKR"}
            type="number"
            mono
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <Kicker>Source</Kicker>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <SourcePill
              active={source === "manual"}
              onClick={() => setSource("manual")}
              label="Manual"
              sub="discretionary"
            />
            <SourcePill
              active={source === "signal"}
              onClick={() => setSource("signal")}
              label="Signal"
              sub="from a strategy"
              accent
            />
          </div>
        </div>

        {source === "signal" && (
          <div style={{ marginTop: 10 }}>
            <ModalInput
              label="Strategy name"
              value={strat}
              onChange={setStrat}
              placeholder="RSI Bounce v1"
            />
          </div>
        )}

        {qtyN > 0 && entryN > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: T.surface,
              borderRadius: 8,
              boxShadow: `0 0 0 1px ${T.outlineFaint}`,
            }}
          >
            <DotRow label="Notional" value={`PKR ${notional.toLocaleString()}`} bold />
            {stopN > 0 && (
              <DotRow
                label="Risk per share"
                value={`PKR ${(entryN - stopN).toFixed(2)} (${riskPct.toFixed(1)}%)`}
              />
            )}
            {targetN > 0 && stopN > 0 && (
              <DotRow
                label="R:R"
                value={`${((targetN - entryN) / (entryN - stopN)).toFixed(2)} : 1`}
              />
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: T.loss + "12",
              border: `1px solid ${T.loss}44`,
              borderRadius: 6,
              color: T.loss,
              fontFamily: T.fontMono,
              fontSize: 11.5,
            }}
          >
            ! {error}
          </div>
        )}
      </div>

      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <Btn variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" size="sm" icon={Icon.check} onClick={submit}>
          Log to portfolio →
        </Btn>
      </div>
    </Modal>
  );
}

/* ────────── Close Position Modal ────────── */

function ClosePositionModal({
  position,
  onClose,
  onSubmit,
}: {
  position: OpenPosition;
  onClose: () => void;
  onSubmit: (p: OpenPosition, exit: number, reason: CloseReason, date: string) => void;
}) {
  const T = useT();
  const [exit, setExit] = useState(position.now.toFixed(2));
  const [reason, setReason] = useState<CloseReason>("Manual close");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const exitN = Number(exit);
  const pnl = exitN ? Math.round((exitN - position.entry) * position.qty) : 0;
  const ret = exitN ? ((exitN - position.entry) / position.entry) * 100 : 0;
  const proceeds = exitN ? exitN * position.qty : 0;

  function submit() {
    if (!exitN || exitN <= 0) return setError("Exit price must be > 0");
    onSubmit(position, Number(exitN.toFixed(2)), reason, todayLabel());
  }

  return (
    <Modal onClose={onClose} width={540} label="Close position">
      <div style={{ padding: "22px 26px 10px" }}>
        <Kicker color={T.primaryLight}>close position</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 26,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.5,
          }}
        >
          <span style={{ fontStyle: "italic", color: T.primaryLight }}>{position.sym}</span> ·{" "}
          sell {position.qty.toLocaleString()}
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          entry {position.entry.toFixed(2)} · opened {position.date} ·{" "}
          {position.source === "signal" ? position.strat ?? "signal" : "manual"}
        </div>
      </div>

      <div style={{ padding: "14px 26px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ModalInput
            label="Exit price"
            value={exit}
            onChange={setExit}
            placeholder="e.g. 132.60"
            suffix="PKR"
            type="number"
            mono
          />
          <div>
            <Kicker>Reason</Kicker>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {(["Target hit", "Stop loss", "Manual close"] as const).map((r) => {
                const active = reason === r;
                const c =
                  r === "Target hit" ? T.gain : r === "Stop loss" ? T.loss : T.text2;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    style={{
                      padding: "6px 10px",
                      fontSize: 11.5,
                      fontFamily: T.fontSans,
                      borderRadius: 4,
                      border: `1px solid ${active ? c : T.outlineFaint}`,
                      background: active ? c + "18" : "transparent",
                      color: active ? c : T.text2,
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: T.surface,
            borderRadius: 8,
            boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          }}
        >
          <DotRow label="Proceeds" value={`PKR ${proceeds.toLocaleString()}`} />
          <DotRow
            label="Realized P&L"
            value={
              <span style={{ color: pnl >= 0 ? T.gain : T.loss }}>
                {pnl >= 0 ? "+" : ""}
                {pnl.toLocaleString()} ({ret >= 0 ? "+" : ""}
                {ret.toFixed(2)}%)
              </span>
            }
            bold
            color={pnl >= 0 ? T.gain : T.loss}
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: T.loss + "12",
              border: `1px solid ${T.loss}44`,
              borderRadius: 6,
              color: T.loss,
              fontFamily: T.fontMono,
              fontSize: 11.5,
            }}
          >
            ! {error}
          </div>
        )}
      </div>

      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <Btn variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" size="sm" icon={Icon.check} onClick={submit}>
          Close position →
        </Btn>
      </div>
    </Modal>
  );
}

/* ────────── Modal fields ────────── */

function ModalInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  type = "text",
  mono,
  transform,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  type?: "text" | "number";
  mono?: boolean;
  transform?: (v: string) => string;
}) {
  const T = useT();
  const boxStyle: CSSProperties = {
    marginTop: 6,
    padding: "8px 12px",
    background: T.surface,
    borderRadius: 8,
    boxShadow: `0 0 0 1px ${T.outlineFaint}`,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  };
  const inputStyle: CSSProperties = {
    background: "transparent",
    border: "none",
    color: T.text,
    fontFamily: mono ? T.fontMono : T.fontSans,
    fontSize: 13,
    width: "100%",
    padding: 0,
  };
  return (
    <div>
      <Kicker>{label}</Kicker>
      <div style={boxStyle}>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(transform ? transform(e.target.value) : e.target.value)}
          style={inputStyle}
          inputMode={type === "number" ? "decimal" : undefined}
        />
        {suffix && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, whiteSpace: "nowrap" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SourcePill({
  active,
  onClick,
  label,
  sub,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  const T = useT();
  const color = accent ? T.deploy : T.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 8,
        background: active ? color + "14" : "transparent",
        border: `1px solid ${active ? color : T.outlineFaint}`,
        color: active ? color : T.text2,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: T.fontSans,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, marginTop: 2 }}>
        {sub}
      </div>
    </button>
  );
}

/* ────────── Empty state ────────── */

function EmptyState({
  onLogClick,
  onImport,
}: {
  onLogClick: () => void;
  onImport: () => void;
}) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: pick(bp, {
          mobile: `28px ${padX}`,
          desktop: `48px ${padX}`,
        }),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: pick(bp, {
            mobile: "1fr",
            tablet: "1.3fr 1fr",
            desktop: "1.3fr 1fr",
          }),
          gap: pick(bp, { mobile: 32, tablet: 36, desktop: 48 }),
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div>
          <Kicker>manual ledger</Kicker>
          <h2
            style={{
              fontFamily: T.fontHead,
              fontSize: clampPx(30, 7, 44),
              fontWeight: 500,
              margin: "14px 0 18px",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Track{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
              your actual trades
            </span>
            .
          </h2>
          <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.7, maxWidth: 520 }}>
            No broker connection. You log trades by hand — what you bought, at what price, when. The
            portfolio tracks P&amp;L and shows how signal-driven trades compare to your
            discretionary ones.
          </p>
          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn variant="primary" size="lg" icon={Icon.plus} onClick={onLogClick}>
              Log a trade
            </Btn>
            <Btn variant="ghost" size="lg" onClick={onImport}>
              Import CSV
            </Btn>
          </div>

          <div style={{ marginTop: 40 }}>
            <Ribbon kicker="why manual?" />
            <div style={{ marginTop: 10, fontSize: 13, color: T.text2, lineHeight: 1.8 }}>
              PSX doesn&apos;t expose broker APIs, so we can&apos;t auto-sync. The upside: you
              decide what counts as a trade and when to log it. The ledger is{" "}
              <em style={{ color: T.text }}>yours</em>.
            </div>
          </div>
        </div>

        <div>
          <Kicker>what you&apos;ll see here</Kicker>
          <div style={{ marginTop: 12 }}>
            <DotRow label="Open positions" value="with live prices" />
            <DotRow label="Unrealized P&L" value="per position" />
            <DotRow label="Realized P&L" value="YTD from closed trades" />
            <DotRow
              label="Signal vs manual"
              value="attribution edge"
              color={T.deploy}
              bold
            />
            <DotRow label="Sector allocation" value="as % of portfolio" />
            <DotRow label="Win rate" value="over all closed trades" />
          </div>
          <div
            style={{
              marginTop: 22,
              padding: 16,
              background: T.surfaceLow,
              borderRadius: 6,
              border: `1px dashed ${T.outlineFaint}`,
            }}
          >
            <div
              style={{
                fontFamily: T.fontMono,
                fontSize: 10.5,
                color: T.primaryLight,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              tip
            </div>
            <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.55 }}>
              Every signal on the Signals page has a &ldquo;log this trade&rdquo; button — so if you
              follow a{" "}
              <Link href="/signals" style={{ color: T.primaryLight }}>
                signal
              </Link>
              , it lands here auto-tagged as signal-driven.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
