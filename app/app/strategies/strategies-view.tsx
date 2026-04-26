"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  EditorialHeader,
  Kicker,
  Ribbon,
  TerminalTable,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

export type Status = "DEPLOYED" | "DRAFT" | "PAUSED" | "ARCHIVED";
type StatusFilter = "all" | "deployed" | "draft" | "paused" | "archived";
export type OutputKind = "bt" | "sig" | "bot";
type SortKey = "updated" | "name" | "backtest" | "sharpe" | "today";
type SortDir = "asc" | "desc";

export interface Strategy {
  id: string;
  name: string;
  type: string;
  status: Status;
  signals: number;
  // Number of non-STOPPED bots bound to this strategy. Populated from
  // backend `bots_count` (single-query aggregate); 0 means no live bots.
  botsCount: number;
  bt: string;
  sharpe: number | null;
  outputs: OutputKind[];
  universe: string;
  updated: string;
  updatedMin: number;
  // Minutes since the signal scanner last ran this strategy. Used to render
  // the "last scan Xm ago" footer chip. Number.MAX_SAFE_INTEGER means
  // never scanned.
  lastScanMin: number;
  pinned?: boolean;
}

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "updated", label: "updated", defaultDir: "asc" }, // smallest minutes-ago = most recent
  { key: "name", label: "name", defaultDir: "asc" },
  { key: "backtest", label: "backtest", defaultDir: "desc" },
  { key: "sharpe", label: "sharpe", defaultDir: "desc" },
  { key: "today", label: "signals today", defaultDir: "desc" },
];

function parseBt(s: string): number | null {
  if (!s || s === "—") return null;
  // handles unicode minus "−" and ascii "-"
  const normalized = s.replace("−", "-").replace("%", "").trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function compare(a: Strategy, b: Strategy, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  // pinned rows always float up within the same sort
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name) * sign;
    case "updated":
      return (a.updatedMin - b.updatedMin) * sign;
    case "sharpe": {
      const av = a.sharpe ?? -Infinity;
      const bv = b.sharpe ?? -Infinity;
      return (av - bv) * sign;
    }
    case "backtest": {
      const av = parseBt(a.bt) ?? -Infinity;
      const bv = parseBt(b.bt) ?? -Infinity;
      return (av - bv) * sign;
    }
    case "today":
      return (a.signals - b.signals) * sign;
  }
}

export function StrategiesView({
  initialStrategies,
}: {
  initialStrategies: Strategy[];
}) {
  // Empty preview toggle is a design tool; real "no strategies" still falls
  // through to EmptyState when initialStrategies is [].
  const [empty, setEmpty] = useState(false);
  const [rows, setRows] = useState<Strategy[]>(initialStrategies);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importMsg, setImportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), 4000);
    return () => clearTimeout(t);
  }, [importMsg]);

  function onImportClick() {
    fileRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const imported: Strategy[] = list.map((raw, i) => coerceStrategy(raw, i));
      const existingIds = new Set(rows.map((r) => r.id));
      const fresh = imported.filter((r) => !existingIds.has(r.id));
      const skipped = imported.length - fresh.length;
      setRows((prev) => {
        const prevIds = new Set(prev.map((r) => r.id));
        return [...imported.filter((r) => !prevIds.has(r.id)), ...prev];
      });
      const msg = skipped > 0 ? `imported ${fresh.length} · skipped ${skipped} duplicate` : `imported ${fresh.length}`;
      setImportMsg({ kind: "ok", text: msg });
    } catch (err) {
      setImportMsg({ kind: "err", text: err instanceof Error ? err.message : "invalid JSON" });
    }
  }

  return (
    <AppFrame route="/strategies">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={onImportFile}
      />
      <ListBody
        empty={empty}
        toggleEmpty={() => setEmpty((e) => !e)}
        rows={rows}
        status={status}
        setStatus={setStatus}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(k, d) => {
          setSortKey(k);
          setSortDir(d);
        }}
        onImport={onImportClick}
        importMsg={importMsg}
      />
    </AppFrame>
  );
}

function ListBody({
  empty,
  toggleEmpty,
  rows,
  status,
  setStatus,
  sortKey,
  sortDir,
  onSort,
  onImport,
  importMsg,
}: {
  empty: boolean;
  toggleEmpty: () => void;
  rows: Strategy[];
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey, d: SortDir) => void;
  onImport: () => void;
  importMsg: { kind: "ok" | "err"; text: string } | null;
}) {
  const T = useT();
  const source = empty ? [] : rows;

  const counts = useMemo(() => {
    const c = { all: source.length, deployed: 0, draft: 0, paused: 0, archived: 0 };
    for (const r of source) {
      if (r.status === "DEPLOYED") c.deployed++;
      else if (r.status === "DRAFT") c.draft++;
      else if (r.status === "PAUSED") c.paused++;
      else if (r.status === "ARCHIVED") c.archived++;
    }
    return c;
  }, [source]);

  const signalsToday = useMemo(
    () => source.reduce((acc, r) => acc + r.signals, 0),
    [source]
  );
  // Sum per-row botsCount (the real backend aggregate). Previously this
  // counted strategies that had any bot, not the actual number of bots —
  // and even that was structurally broken because outputs never included
  // "bot". Now it matches what the user sees in the bots dashboard.
  const botsBound = useMemo(
    () => source.reduce((acc, r) => acc + (r.botsCount ?? 0), 0),
    [source]
  );

  // Most recent scan across all strategies. Number.MAX_SAFE_INTEGER means
  // no strategy has ever been scanned. Anything else gets formatted as
  // "Xm/Xh/Xd ago" matching the per-row "updated" column.
  const lastScanLabel = useMemo(() => {
    if (source.length === 0) return "no scans yet";
    const min = Math.min(...source.map((r) => r.lastScanMin));
    if (min === Number.MAX_SAFE_INTEGER) return "no scans yet";
    if (min < 1) return "last scan just now";
    if (min < 60) return `last scan ${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `last scan ${h}h ago`;
    const d = Math.floor(h / 24);
    return `last scan ${d}d ago`;
  }, [source]);

  const filtered = useMemo(() => {
    if (status === "all") return source;
    const match: Status = status.toUpperCase() as Status;
    return source.filter((r) => r.status === match);
  }, [source, status]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compare(a, b, sortKey, sortDir));
    return copy;
  }, [filtered, sortKey, sortDir]);

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "all", count: counts.all },
    { key: "deployed", label: "deployed", count: counts.deployed },
    { key: "draft", label: "draft", count: counts.draft },
    { key: "paused", label: "paused", count: counts.paused },
    { key: "archived", label: "archived", count: counts.archived },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <EditorialHeader
        kicker="Authoring · strategy is the unit of work"
        title={
          <>
            Strategies{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>·</span>{" "}
            {empty ? (
              <span style={{ color: T.text3, fontWeight: 400, fontSize: "0.7em" }}>
                you haven&apos;t built one yet
              </span>
            ) : (
              `${counts.all} total`
            )}
          </>
        }
        meta={
          empty ? (
            <>
              <span>0 deployed</span>
              <span>0 signals today</span>
              <span>0 bots</span>
            </>
          ) : (
            <>
              <span>
                <span style={{ color: T.gain }}>●</span> {counts.deployed} deployed
              </span>
              <span>
                {signalsToday} {signalsToday === 1 ? "signal" : "signals"} today
              </span>
              <span>
                {botsBound} {botsBound === 1 ? "bot" : "bots"} bound
              </span>
              <span style={{ color: T.text3 }}>{lastScanLabel}</span>
            </>
          )
        }
        actions={
          <>
            {importMsg && (
              <span
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: importMsg.kind === "ok" ? T.gain : T.loss,
                }}
              >
                {importMsg.text}
              </span>
            )}
            <Btn variant="ghost" size="sm" onClick={toggleEmpty}>
              {empty ? "Show populated" : "Show empty"}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={onImport}>
              Import JSON
            </Btn>
            <Link href="/strategies/new" style={{ textDecoration: "none" }}>
              <Btn variant="primary" size="sm" icon={Icon.plus}>
                New strategy
              </Btn>
            </Link>
          </>
        }
      />

      {empty ? (
        <EmptyState onImport={onImport} />
      ) : rows.length === 0 ? (
        <EmptyState onImport={onImport} />
      ) : (
        <FilteredList
          filters={filters}
          status={status}
          setStatus={setStatus}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          sorted={sorted}
        />
      )}
    </div>
  );
}

function FilteredList({
  filters,
  status,
  setStatus,
  sortKey,
  sortDir,
  onSort,
  sorted,
}: {
  filters: { key: StatusFilter; label: string; count: number }[];
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey, d: SortDir) => void;
  sorted: Strategy[];
}) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  return (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `16px ${padX} 28px`,
              desktop: `20px ${padX} 40px`,
            }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: isMobile ? "stretch" : "center",
              gap: isMobile ? 10 : 18,
              paddingBottom: 14,
              borderBottom: `1px solid ${T.outlineFaint}`,
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                rowGap: 8,
              }}
            >
              <Kicker>filter</Kicker>
              {filters.map((f) => {
                const active = status === f.key;
                return (
                  <FilterPill
                    key={f.key}
                    active={active}
                    onClick={() => setStatus(f.key)}
                    disabled={f.count === 0 && f.key !== "all"}
                  >
                    {f.label} {f.count}
                  </FilterPill>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
            <SortControl
              sortKey={sortKey}
              sortDir={sortDir}
              onChange={(k, d) => onSort(k, d)}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            {sorted.length === 0 ? (
              <FilteredEmpty
                onReset={() => setStatus("all")}
                label={filters.find((f) => f.key === status)?.label ?? "this filter"}
              />
            ) : (
              <StrategyTable rows={sorted} />
            )}
          </div>
        </div>
  );
}

function FilterPill({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 11.5,
        fontFamily: T.fontMono,
        background: active ? T.surface3 : "transparent",
        color: active ? T.text : disabled ? T.text3 : T.text2,
        boxShadow: `0 0 0 1px ${active ? T.outlineVariant : T.outlineFaint}`,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function SortControl({
  sortKey,
  sortDir,
  onChange,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onChange: (k: SortKey, d: SortDir) => void;
}) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.key === sortKey) ?? SORT_OPTIONS[0];
  const arrow = sortDir === "asc" ? "↑" : "↓";
  // "updated" uses minutes-ago numbers where asc = most recent first, so flip visible arrow
  const displayArrow = sortKey === "updated" ? (sortDir === "asc" ? "↓" : "↑") : arrow;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.text3,
          background: open ? T.surface3 : "transparent",
          border: "none",
          boxShadow: `0 0 0 1px ${open ? T.outlineVariant : "transparent"}`,
          borderRadius: 4,
          padding: "4px 8px",
          cursor: "pointer",
        }}
        aria-expanded={open}
      >
        sort:{" "}
        <span style={{ color: T.text2 }}>
          {current.label} {displayArrow}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 200,
            background: T.surface2,
            border: `1px solid ${T.outlineVariant}`,
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 20,
            padding: 4,
            fontFamily: T.fontMono,
            fontSize: 11.5,
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const selected = opt.key === sortKey;
            const shownArrow =
              opt.key === "updated"
                ? sortDir === "asc"
                  ? "↓"
                  : "↑"
                : sortDir === "asc"
                ? "↑"
                : "↓";
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (selected) {
                    onChange(opt.key, sortDir === "asc" ? "desc" : "asc");
                  } else {
                    onChange(opt.key, opt.defaultDir);
                  }
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "7px 10px",
                  background: selected ? T.surface3 : "transparent",
                  color: selected ? T.text : T.text2,
                  border: "none",
                  borderRadius: 4,
                  fontFamily: T.fontMono,
                  fontSize: 11.5,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span>{opt.label}</span>
                <span style={{ color: selected ? T.primaryLight : T.text3 }}>
                  {selected ? shownArrow : " "}
                </span>
              </button>
            );
          })}
          <div style={{ height: 1, background: T.outlineFaint, margin: "4px 0" }} />
          <div style={{ padding: "4px 10px 6px", color: T.text3, fontSize: 10.5 }}>
            click active row to flip direction
          </div>
        </div>
      )}
    </div>
  );
}

function FilteredEmpty({ onReset, label }: { onReset: () => void; label: string }) {
  const T = useT();
  return (
    <div
      style={{
        padding: "48px 20px",
        textAlign: "center",
        color: T.text3,
        fontFamily: T.fontMono,
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        no strategies match <span style={{ color: T.text2 }}>{label}</span>
      </div>
      <Btn variant="ghost" size="sm" onClick={onReset}>
        clear filter
      </Btn>
    </div>
  );
}

function coerceStrategy(raw: unknown, idx: number): Strategy {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = typeof r.name === "string" && r.name.trim() ? r.name : `Imported ${idx + 1}`;
  const id =
    typeof r.id === "string" && r.id
      ? r.id
      : name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const statusRaw = typeof r.status === "string" ? r.status.toUpperCase() : "DRAFT";
  const status: Status = (["DEPLOYED", "DRAFT", "PAUSED", "ARCHIVED"] as const).includes(
    statusRaw as Status
  )
    ? (statusRaw as Status)
    : "DRAFT";
  const outputs = Array.isArray(r.outputs)
    ? (r.outputs.filter((o): o is OutputKind => o === "bt" || o === "sig" || o === "bot"))
    : [];
  return {
    id,
    name,
    type: typeof r.type === "string" ? r.type : "Custom",
    status,
    signals: typeof r.signals === "number" ? r.signals : 0,
    botsCount: typeof r.botsCount === "number" ? r.botsCount : 0,
    bt: typeof r.bt === "string" ? r.bt : "—",
    sharpe: typeof r.sharpe === "number" ? r.sharpe : null,
    outputs,
    universe: typeof r.universe === "string" ? r.universe : "KSE-100",
    updated: "just now",
    updatedMin: 0,
    lastScanMin: Number.MAX_SAFE_INTEGER,
    pinned: r.pinned === true,
  };
}

function StrategyTable({ rows }: { rows: Strategy[] }) {
  const T = useT();
  const cols: Col[] = [
    { label: "name", width: "1.5fr", mono: false, primary: true },
    { label: "type", width: "140px", mono: false },
    { label: "status", width: "110px" },
    { label: "universe", width: "110px" },
    { label: "backtest", align: "right", width: "90px" },
    { label: "sharpe", align: "right", width: "70px" },
    { label: "outputs", width: "120px", mobileFullWidth: true },
    { label: "today", align: "right", width: "80px" },
    { label: "updated", align: "right", width: "90px" },
  ];
  const glyphs: Record<OutputKind, [string, string, string]> = {
    bt: ["⎈", T.primary, "Backtest"],
    sig: ["◉", T.deploy, "Signals"],
    bot: ["◇", T.accent, "Bot"],
  };
  const tableRows: unknown[][] = rows.map((s) => [
    s,
    s.type,
    s.status,
    s.universe,
    s.bt,
    s.sharpe,
    s.outputs,
    s.signals,
    s.updated,
  ]);
  return (
    <TerminalTable
      cols={cols}
      rows={tableRows}
      renderCell={(cell, ci) => {
        if (ci === 0) {
          const s = cell as Strategy;
          return (
            <Link href={`/strategies/${s.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <span
                style={{
                  fontFamily: T.fontHead,
                  fontSize: 14,
                  color: T.text,
                  fontWeight: 500,
                  letterSpacing: -0.2,
                }}
              >
                {s.name}
              </span>
              {s.pinned && <span style={{ color: T.accent, fontSize: 10 }}>★</span>}
            </Link>
          );
        }
        if (ci === 1) return <span style={{ color: T.text2 }}>{cell as string}</span>;
        if (ci === 2) {
          const st = cell as Status;
          const c = { DEPLOYED: T.deploy, DRAFT: T.text3, PAUSED: T.warning, ARCHIVED: T.text3 }[st];
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
                  boxShadow: st === "DEPLOYED" ? `0 0 0 2px ${c}33` : undefined,
                }}
              />
              {st.toLowerCase()}
            </span>
          );
        }
        if (ci === 3) return <span style={{ color: T.text3 }}>{cell as string}</span>;
        if (ci === 4) {
          const str = String(cell);
          if (str === "—") return <span style={{ color: T.text3 }}>{str}</span>;
          return <span style={{ color: str.startsWith("+") ? T.gain : T.loss }}>{str}</span>;
        }
        if (ci === 5)
          return cell == null ? (
            <span style={{ color: T.text3 }}>—</span>
          ) : (
            <span style={{ color: T.text2 }}>{(cell as number).toFixed(2)}</span>
          );
        if (ci === 6) {
          const outs = cell as OutputKind[];
          return (
            <span style={{ display: "inline-flex", gap: 5 }}>
              {outs.length === 0 ? (
                <span style={{ color: T.text3, fontSize: 10.5 }}>—</span>
              ) : (
                outs.map((o, i) => {
                  const [g, c, title] = glyphs[o];
                  return (
                    <span
                      key={i}
                      title={title}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: c + "22",
                        color: c,
                        fontFamily: T.fontHead,
                        fontSize: 11,
                      }}
                    >
                      {g}
                    </span>
                  );
                })
              )}
            </span>
          );
        }
        if (ci === 7) {
          const n = cell as number;
          return (
            <span style={{ color: n > 0 ? T.text : T.text3, fontWeight: n > 0 ? 600 : 400 }}>
              {n || "—"}
            </span>
          );
        }
        if (ci === 8) return <span style={{ color: T.text3 }}>{cell as string}</span>;
        return cell as ReactNode;
      }}
    />
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const presets: { title: string; desc: string; badge: string | null }[] = [
    { title: "Mean reversion", desc: "RSI-based oversold bounce", badge: "popular" },
    { title: "Momentum breakout", desc: "Price breaks SMA with volume", badge: null },
    { title: "Golden cross", desc: "SMA(50) crosses above SMA(200)", badge: null },
    { title: "Bollinger squeeze", desc: "Volatility contraction breakout", badge: "new" },
    { title: "MACD cross", desc: "Classic 12/26/9 trend follow", badge: null },
    { title: "Blank canvas", desc: "Start from scratch", badge: null },
  ];
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
            tablet: "1.4fr 1fr",
            desktop: "1.4fr 1fr",
          }),
          gap: pick(bp, { mobile: 32, tablet: 36, desktop: 48 }),
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div>
          <Kicker>start here</Kicker>
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
            Build your first{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
              strategy
            </span>
            .
          </h2>
          <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.7, maxWidth: 520 }}>
            A strategy is a tree of conditions — RSI oversold, SMA crossovers, volume surges — that
            fires a signal when they all agree. From there you can backtest it, deploy it to signals
            you trade manually, or bind a paper-trading bot.
          </p>
          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/strategies/new" style={{ textDecoration: "none" }}>
              <Btn variant="primary" size="lg" icon={Icon.plus}>
                New strategy
              </Btn>
            </Link>
            <Btn variant="ghost" size="lg" onClick={onImport}>
              Import JSON
            </Btn>
          </div>

          <div style={{ marginTop: 40 }}>
            <Ribbon kicker="the three outputs" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
                gap: 14,
                marginTop: 8,
              }}
            >
              {(
                [
                  ["⎈", T.primary, "Backtest", "Run it on history"],
                  ["◉", T.deploy, "Signals", "Fire to your feed"],
                  ["◇", T.accent, "Bot", "Paper-trade live"],
                ] as const
              ).map(([g, c, t, d]) => (
                <div
                  key={t}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0" }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: c + "22",
                      color: c,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.fontHead,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {g}
                  </span>
                  <div>
                    <div style={{ fontFamily: T.fontHead, fontSize: 13, fontWeight: 500 }}>{t}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Kicker>start from a preset</Kicker>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 1 }}>
            {presets.map((p, i) => (
              <div
                key={p.title}
                style={{
                  padding: "14px 16px",
                  background: i === 0 ? T.surfaceLow : "transparent",
                  borderTop: `1px solid ${T.outlineFaint}`,
                  borderBottom:
                    i === presets.length - 1 ? `1px solid ${T.outlineFaint}` : undefined,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: T.fontHead,
                        fontSize: 14,
                        fontWeight: 500,
                        color: T.text,
                      }}
                    >
                      {p.title}
                    </span>
                    {p.badge && (
                      <span
                        style={{
                          fontFamily: T.fontMono,
                          fontSize: 9.5,
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: T.primaryLight + "22",
                          color: T.primaryLight,
                        }}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3 }}>{p.desc}</div>
                </div>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.primaryLight }}>
                  use →
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
