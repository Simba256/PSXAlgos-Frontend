"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  DotRow,
  EditorialHeader,
  FlashToast,
  Kicker,
  Modal,
  Ribbon,
  TerminalTable,
  useFlash,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import { enqueueSignalTrade } from "@/lib/signal-log-bridge";

type DirectionFilter = "ALL" | "BUY" | "SELL";

interface FilterCriteria {
  direction: DirectionFilter;
  symbolSearch: string;
  rsiMin: number;
  rsiMax: number;
  strategies: string[]; // empty = all strategies
}

const DEFAULT_FILTER: FilterCriteria = {
  direction: "ALL",
  symbolSearch: "",
  rsiMin: 0,
  rsiMax: 100,
  strategies: [],
};

function isFilterActive(f: FilterCriteria): boolean {
  return (
    f.direction !== "ALL" ||
    f.symbolSearch.trim() !== "" ||
    f.rsiMin !== 0 ||
    f.rsiMax !== 100 ||
    f.strategies.length > 0
  );
}

function applyFilter(signals: Signal[], f: FilterCriteria): Signal[] {
  const search = f.symbolSearch.trim().toLowerCase();
  return signals.filter((s) => {
    if (f.direction !== "ALL" && s.dir !== f.direction) return false;
    if (search && !s.symbol.toLowerCase().includes(search)) return false;
    if (s.rsi < f.rsiMin || s.rsi > f.rsiMax) return false;
    if (f.strategies.length > 0 && !f.strategies.includes(s.strategy)) return false;
    return true;
  });
}

function exportSignalsCsv(signals: Signal[]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["time", "strategy", "symbol", "direction", "price", "rsi", "conf", "age", "logged"];
  const rows = signals.map((s) =>
    [
      escape(s.time),
      escape(s.strategy),
      escape(s.symbol),
      s.dir,
      s.price.toFixed(2),
      String(s.rsi),
      s.conf.toFixed(2),
      escape(s.age),
      s.logged ? "yes" : "no",
    ].join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signals-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface Signal {
  id: string;
  time: string;
  strategy: string;
  symbol: string;
  price: number;
  rsi: number;
  conf: number;
  age: string;
  dir: "BUY" | "SELL";
  logged?: boolean;
}

const todayLabel = (): string => {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

export function SignalsView({ initialSignals }: { initialSignals: Signal[] }) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals);
  const [filter, setFilter] = useState<FilterCriteria>(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openSignal, setOpenSignal] = useState<Signal | null>(null);
  const { flash, setFlash } = useFlash();

  const filteredSignals = useMemo(() => applyFilter(signals, filter), [signals, filter]);
  const filterActive = isFilterActive(filter);
  const availableStrategies = useMemo(
    () => Array.from(new Set(signals.map((s) => s.strategy))).sort(),
    [signals],
  );

  function handleLogged(sig: Signal, qty: number) {
    enqueueSignalTrade({
      sym: sig.symbol,
      qty,
      entry: sig.price,
      now: sig.price,
      source: "signal",
      strat: sig.strategy,
      date: todayLabel(),
      stop: Number((sig.price * 0.95).toFixed(2)),
      target: Number((sig.price * 1.15).toFixed(2)),
    });
    setSignals((rows) => rows.map((r) => (r.id === sig.id ? { ...r, logged: true } : r)));
    setOpenSignal(null);
    setFlash(`Logged ${sig.symbol} · ${qty.toLocaleString()} @ ${sig.price.toFixed(2)} to portfolio`);
  }

  function handleExport() {
    if (filteredSignals.length === 0) {
      setFlash("No signals to export");
      return;
    }
    exportSignalsCsv(filteredSignals);
    setFlash(`Exported ${filteredSignals.length} signal${filteredSignals.length === 1 ? "" : "s"} to CSV`);
  }

  function handleApplyFilter(next: FilterCriteria) {
    setFilter(next);
    setFilterOpen(false);
    if (isFilterActive(next)) {
      setFlash("Filter applied");
    } else {
      setFlash("Filter cleared");
    }
  }

  const loggedCount = signals.filter((s) => s.logged).length;

  return (
    <AppFrame route="/signals">
      <Body
        signals={filteredSignals}
        totalCount={signals.length}
        filterActive={filterActive}
        loggedCount={loggedCount}
        onLog={setOpenSignal}
        onOpenFilter={() => setFilterOpen(true)}
        onExport={handleExport}
      />
      {openSignal && (
        <LogTradeModal
          signal={openSignal}
          onClose={() => setOpenSignal(null)}
          onLogged={handleLogged}
        />
      )}
      {filterOpen && (
        <FilterModal
          initial={filter}
          strategies={availableStrategies}
          onClose={() => setFilterOpen(false)}
          onApply={handleApplyFilter}
        />
      )}
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function Body({
  signals,
  totalCount,
  filterActive,
  loggedCount,
  onLog,
  onOpenFilter,
  onExport,
}: {
  signals: Signal[];
  totalCount: number;
  filterActive: boolean;
  loggedCount: number;
  onLog: (s: Signal) => void;
  onOpenFilter: () => void;
  onExport: () => void;
}) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const cols: Col[] = [
    { label: "time", width: "80px" },
    { label: "strategy", width: "1.4fr", mono: false, mobileFullWidth: true },
    { label: "symbol", width: "90px", primary: true },
    { label: "dir", width: "60px" },
    { label: "price", align: "right", width: "90px" },
    { label: "rsi", align: "right", width: "70px" },
    { label: "conf", align: "right", width: "110px" },
    { label: "age", align: "right", width: "60px" },
    { label: "", align: "right", width: "220px" },
  ];
  const rows: unknown[][] = signals.map((s) => [
    s.time,
    s.strategy,
    s.symbol,
    s.dir,
    s.price.toFixed(2),
    s.rsi,
    s.conf,
    s.age,
    s,
  ]);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <EditorialHeader
        kicker="Live feed · 3 deployed strategies"
        title={
          <>
            Today&apos;s{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
              signals
            </span>
          </>
        }
        meta={
          <>
            <span>
              <span style={{ color: T.gain }}>●</span> market open ·{" "}
              <span style={{ color: T.text2 }}>09:58:12 PKT</span>
            </span>
            <span>
              {filterActive ? `${signals.length} of ${totalCount}` : `${signals.length}`} signals ·{" "}
              {new Set(signals.map((s) => s.symbol)).size} symbols
            </span>
            <span>{loggedCount} logged to portfolio</span>
          </>
        }
        actions={
          <>
            <Btn
              variant={filterActive ? "primary" : "ghost"}
              size="sm"
              onClick={onOpenFilter}
              title="Filter signals"
            >
              {filterActive ? "Filter ●" : "Filter"}
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              onClick={onExport}
              title="Export signals to CSV"
              disabled={signals.length === 0}
            >
              Export
            </Btn>
          </>
        }
      />

      <div
        style={{
          padding: `14px ${padX}`,
          borderBottom: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 20,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: T.fontMono,
            fontSize: 10.5,
            color: T.text3,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          sourced from
        </span>
        <StrategyChip name="RSI Bounce v1" count={2} color={T.primaryLight} />
        <StrategyChip name="Momentum Breakout" count={2} color={T.accent} />
        <StrategyChip name="Golden Cross · KSE30" count={1} color="#c7a885" />
        <StrategyChip name="Mean Rev · Banks" count={1} color={T.deploy} />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          auto-refresh <span style={{ color: T.gain }}>on</span> · every 30s
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: pick(bp, {
            mobile: `12px ${padX} 28px`,
            desktop: `12px ${padX} 40px`,
          }),
        }}
      >
        <TerminalTable
          cols={cols}
          rows={rows}
          renderCell={(cell, ci) => {
            if (ci === 0) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
            if (ci === 1) {
              const s = String(cell);
              const color = s.startsWith("RSI")
                ? T.primaryLight
                : s.startsWith("Momentum")
                ? T.accent
                : s.startsWith("Golden")
                ? "#c7a885"
                : T.deploy;
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ width: 6, height: 6, borderRadius: 3, background: color }}
                  />
                  <span style={{ color: T.text2 }}>{s}</span>
                </span>
              );
            }
            if (ci === 2)
              return (
                <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>
              );
            if (ci === 3)
              return (
                <span style={{ color: T.gain, fontWeight: 500 }}>{cell as ReactNode}</span>
              );
            if (ci === 5) {
              const v = cell as number;
              const isLow = v < 30;
              return <span style={{ color: isLow ? T.primaryLight : T.text2 }}>{v}</span>;
            }
            if (ci === 6) return <ConfBar v={cell as number} />;
            if (ci === 7) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
            if (ci === 8) {
              const sig = cell as Signal;
              return sig.logged ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: T.gain,
                    fontFamily: T.fontMono,
                    fontSize: 11,
                    justifyContent: "flex-end",
                  }}
                >
                  <span>✓</span> logged ·{" "}
                  <Link href="/portfolio" style={{ color: T.text3 }}>
                    view in ledger →
                  </Link>
                </span>
              ) : (
                <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                  <Btn variant="ghost" size="sm">
                    chart
                  </Btn>
                  <Btn variant="primary" size="sm" onClick={() => onLog(sig)}>
                    log trade →
                  </Btn>
                </span>
              );
            }
            return cell as ReactNode;
          }}
        />

        <div style={{ marginTop: 36 }}>
          <Ribbon
            kicker="earlier · pre-market"
            right={
              <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
                hidden · 14 signals
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

function StrategyChip({ name, count, color }: { name: string; count: number; color: string }) {
  const T = useT();
  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.fontSans, fontSize: 12 }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: color,
          boxShadow: `0 0 0 3px ${color}22`,
        }}
      />
      <span style={{ color: T.text2 }}>{name}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>×{count}</span>
    </div>
  );
}

function ConfBar({ v }: { v: number }) {
  const T = useT();
  const color = v >= 0.75 ? T.gain : v >= 0.6 ? T.primaryLight : T.text3;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
      }}
    >
      <span
        style={{
          position: "relative",
          width: 54,
          height: 4,
          borderRadius: 2,
          background: T.surface3,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            width: `${v * 100}%`,
            background: color,
            borderRadius: 2,
          }}
        />
      </span>
      <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{v.toFixed(2)}</span>
    </span>
  );
}

function LogTradeModal({
  signal,
  onClose,
  onLogged,
}: {
  signal: Signal;
  onClose: () => void;
  onLogged: (s: Signal, qty: number) => void;
}) {
  const T = useT();
  const qty = 1500;
  const notional = Math.round(qty * signal.price);
  const bookAfter = 1_142_300 - notional;
  return (
    <Modal onClose={onClose} width={560} label="Log manual trade">
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
            <span style={{ fontStyle: "italic", color: T.primaryLight }}>{signal.symbol}</span> ·{" "}
            {signal.dir === "BUY" ? "Buy" : "Sell"} {qty.toLocaleString()} @ {signal.price.toFixed(2)}
          </h2>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            from {signal.strategy} · {signal.time} · conf {signal.conf.toFixed(2)}
          </div>
        </div>

        <div style={{ padding: "14px 26px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <ModalField label="Side" value="Buy" />
            <ModalField label="Quantity" value={qty.toLocaleString()} suffix="sh" />
            <ModalField label="Entry price" value={signal.price.toFixed(2)} suffix="PKR" />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}
          >
            <ModalField label="Stop loss" value={(signal.price * 0.95).toFixed(2)} suffix="−5%" />
            <ModalField label="Take profit" value={(signal.price * 1.15).toFixed(2)} suffix="+15%" />
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
            <DotRow label="Notional" value={`PKR ${notional.toLocaleString()}`} bold />
            <DotRow label="% of book" value={`${((notional / 1_142_300) * 100).toFixed(1)}%`} />
            <DotRow
              label="Book after"
              value={`PKR ${bookAfter.toLocaleString()} cash`}
            />
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              color: T.text2,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: T.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 10,
              }}
            >
              ✓
            </span>
            Link this entry to the signal — P&amp;L will back-reference it.
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderTop: `1px solid ${T.outlineFaint}`,
            display: "flex",
            gap: 8,
          }}
        >
          <Btn variant="ghost" size="sm" onClick={onClose}>
            Dismiss signal
          </Btn>
          <div style={{ flex: 1 }} />
          <Btn variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            icon={Icon.check}
            onClick={() => onLogged(signal, qty)}
          >
            Log to portfolio →
          </Btn>
        </div>
    </Modal>
  );
}

function ModalField({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const T = useT();
  return (
    <div>
      <Kicker>{label}</Kicker>
      <div
        style={{
          marginTop: 6,
          padding: "10px 12px",
          background: T.surface,
          borderRadius: 8,
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.text }}>{value}</span>
        {suffix && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

function FilterModal({
  initial,
  strategies,
  onClose,
  onApply,
}: {
  initial: FilterCriteria;
  strategies: string[];
  onClose: () => void;
  onApply: (next: FilterCriteria) => void;
}) {
  const T = useT();
  const [draft, setDraft] = useState<FilterCriteria>(initial);

  function setField<K extends keyof FilterCriteria>(key: K, value: FilterCriteria[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleStrategy(name: string) {
    setDraft((d) => {
      const next = d.strategies.includes(name)
        ? d.strategies.filter((s) => s !== name)
        : [...d.strategies, name];
      return { ...d, strategies: next };
    });
  }

  const dirOptions: { value: DirectionFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "BUY", label: "Buy" },
    { value: "SELL", label: "Sell" },
  ];

  return (
    <Modal onClose={onClose} width={560} label="Filter signals">
      <div style={{ padding: "22px 26px 10px" }}>
        <Kicker color={T.primaryLight}>refine the feed</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 26,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.5,
          }}
        >
          Filter <span style={{ fontStyle: "italic", color: T.primaryLight }}>signals</span>
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          combine criteria · matches all selected
        </div>
      </div>

      <div style={{ padding: "14px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Kicker>Direction</Kicker>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {dirOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField("direction", opt.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: T.fontSans,
                  fontSize: 12.5,
                  fontWeight: 500,
                  background: draft.direction === opt.value ? T.primary : T.surface,
                  color: draft.direction === opt.value ? "#fff" : T.text2,
                  border: `1px solid ${
                    draft.direction === opt.value ? T.primary : T.outlineFaint
                  }`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Kicker>Symbol contains</Kicker>
          <input
            type="text"
            value={draft.symbolSearch}
            onChange={(e) => setField("symbolSearch", e.target.value)}
            placeholder="e.g. ENGRO"
            style={{
              marginTop: 8,
              width: "100%",
              padding: "10px 12px",
              background: T.surface,
              border: `1px solid ${T.outlineFaint}`,
              borderRadius: 8,
              fontFamily: T.fontMono,
              fontSize: 13,
              color: T.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <Kicker>RSI range</Kicker>
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <RangeInput
              label="min"
              value={draft.rsiMin}
              onChange={(n) => setField("rsiMin", n)}
            />
            <RangeInput
              label="max"
              value={draft.rsiMax}
              onChange={(n) => setField("rsiMax", n)}
            />
          </div>
        </div>

        {strategies.length > 0 && (
          <div>
            <Kicker>Strategies {draft.strategies.length === 0 && "(all)"}</Kicker>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {strategies.map((name) => {
                const on = draft.strategies.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleStrategy(name)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontFamily: T.fontSans,
                      fontSize: 11.5,
                      fontWeight: 500,
                      background: on ? T.primary : T.surface,
                      color: on ? "#fff" : T.text2,
                      border: `1px solid ${on ? T.primary : T.outlineFaint}`,
                    }}
                  >
                    {on ? "✓ " : ""}
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
        }}
      >
        <Btn variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_FILTER)}>
          Reset
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" size="sm" onClick={() => onApply(draft)}>
          Apply filter →
        </Btn>
      </div>
    </Modal>
  );
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        padding: "8px 12px",
        background: T.surface,
        borderRadius: 8,
        boxShadow: `0 0 0 1px ${T.outlineFaint}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          onChange(Math.max(0, Math.min(100, raw)));
        }}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: T.fontMono,
          fontSize: 13,
          color: T.text,
          textAlign: "right",
          width: "100%",
          minWidth: 0,
        }}
      />
    </div>
  );
}
