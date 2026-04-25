"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [openSignal, setOpenSignal] = useState<Signal | null>(null);
  const { flash, setFlash } = useFlash();

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

  const loggedCount = signals.filter((s) => s.logged).length;

  return (
    <AppFrame route="/signals">
      <Body signals={signals} loggedCount={loggedCount} onLog={setOpenSignal} />
      {openSignal && (
        <LogTradeModal
          signal={openSignal}
          onClose={() => setOpenSignal(null)}
          onLogged={handleLogged}
        />
      )}
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function Body({
  signals,
  loggedCount,
  onLog,
}: {
  signals: Signal[];
  loggedCount: number;
  onLog: (s: Signal) => void;
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
              {signals.length} signals · {new Set(signals.map((s) => s.symbol)).size} symbols
            </span>
            <span>
              {loggedCount} logged to portfolio
            </span>
          </>
        }
        actions={
          <>
            <Btn variant="ghost" size="sm">
              Filter
            </Btn>
            <Btn variant="outline" size="sm">
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
