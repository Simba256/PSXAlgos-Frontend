"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
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
import { EquityCurve } from "@/components/charts";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";

interface LogEntry {
  time: string;
  kind: "buy" | "sell" | "scan" | "info" | "warn";
  text: ReactNode;
}

const LOG_ENTRIES: LogEntry[] = [
  { time: "14:32:08", kind: "buy", text: "BUY HBL 2,500 @ 88.60 · signal fired" },
  { time: "14:20:44", kind: "scan", text: "scan 47 symbols · 1 signal" },
  { time: "13:04:11", kind: "sell", text: "SELL LUCK 200 @ 619.00 · stop hit" },
  { time: "11:48:22", kind: "buy", text: "BUY ENGRO 600 @ 278.50 · signal fired" },
  { time: "10:31:02", kind: "scan", text: "scan 47 symbols · 0 signals" },
  { time: "10:00:00", kind: "info", text: "Market open · bot active" },
  { time: "09:58:02", kind: "info", text: "pre-market warm-up · loaded 100 tickers" },
  { time: "Apr 19 · 15:30", kind: "info", text: "Market close · 0 open positions carried" },
  { time: "Apr 19 · 13:22", kind: "sell", text: "SELL OGDC 1,500 @ 132.60 · take profit" },
  { time: "Apr 19 · 10:01", kind: "warn", text: "safety rail · daily loss 1.2% of 3% cap" },
];

export default function BotDashboardPage() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const [running, setRunning] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);
  const { flash, setFlash } = useFlash();

  const handlePauseToggle = () => {
    setRunning((r) => {
      const next = !r;
      setFlash(next ? "Bot resumed · signals active" : "Bot paused · scans halted");
      return next;
    });
  };

  const handleSettings = () => {
    setFlash("Settings panel coming soon · adjust caps, window, and kill-switch");
  };

  const statusColor = running ? T.gain : T.warning;
  const statusLabel = running ? "Running" : "Paused";
  const nextScan = running ? "next scan in 00:42" : "scanning halted";

  return (
    <AppFrame route="/bots">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/bots" style={{ color: T.primaryLight }}>
                Bots
              </Link>{" "}
              / momentum_live
            </>
          }
          title={
            <>
              Momentum{" "}
              <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
                · live
              </span>
            </>
          }
          meta={
            <>
              <span style={{ color: statusColor }}>
                <span style={{ color: statusColor }}>●</span> {statusLabel}
              </span>
              <span>
                Bound to{" "}
                <span style={{ color: T.primaryLight }}>Momentum Breakout</span>
              </span>
              <span>Started Apr 08 · 12d 4h uptime</span>
              <span style={{ color: T.text3 }}>{nextScan}</span>
            </>
          }
          actions={
            <>
              <Btn variant="ghost" size="sm" onClick={() => setLogsOpen(true)}>
                Logs
              </Btn>
              <Btn variant="outline" size="sm" onClick={handlePauseToggle}>
                {running ? "Pause" : "Resume"}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={handleSettings}>
                Settings
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
                mobile: "minmax(0, 1fr) minmax(0, 1fr)",
                tablet: "repeat(3, minmax(0, 1fr))",
                desktop: "repeat(6, minmax(0, 1fr))",
              }),
              gap: pick(bp, { mobile: 20, desktop: 36 }),
              paddingBottom: 26,
              borderBottom: `1px solid ${T.outlineFaint}`,
            }}
          >
            <Lede label="Equity" value="PKR 1,124,850" sub="+PKR 124,850 total" size="clamp(22px, 2.5vw, 28px)" />
            <Lede label="P&L" value="+12.48%" color={T.gain} sub="since start" size="clamp(22px, 2.5vw, 28px)" />
            <Lede label="Today" value="+PKR 3,240" color={T.gain} sub="+0.29%" size="clamp(22px, 2.5vw, 28px)" />
            <Lede label="Win rate" value="64%" sub="30 / 47 trades" size="clamp(22px, 2.5vw, 28px)" />
            <Lede label="Open" value="3" sub="of 5 max" size="clamp(22px, 2.5vw, 28px)" />
            <Lede label="Cash" value="PKR 682K" sub="60.6% free" size="clamp(22px, 2.5vw, 28px)" />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: pick(bp, {
                mobile: "minmax(0, 1fr)",
                tablet: "minmax(0, 1fr)",
                desktop: "minmax(0, 1.9fr) minmax(0, 1fr)",
              }),
              gap: pick(bp, { mobile: 28, desktop: 48 }),
              marginTop: 28,
            }}
          >
            <div>
              <Ribbon
                kicker="equity curve · 12 days"
                right={
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
                    <span style={{ color: T.gain }}>━</span> bot &nbsp;{" "}
                    <span style={{ color: T.text3 }}>┄┄</span> KSE-100
                  </span>
                }
              />
              <div style={{ marginTop: 8 }}>
                <EquityCurve
                  width={760}
                  height={210}
                  data={Array.from(
                    { length: 120 },
                    (_, i) => 100 + i * 0.11 + Math.sin(i / 5) * 1.8 + (i > 70 ? 2.5 : 0)
                  )}
                  benchmark={Array.from(
                    { length: 120 },
                    (_, i) => 100 + i * 0.05 + Math.cos(i / 7) * 1.2
                  )}
                />
              </div>

              <div style={{ marginTop: 32 }}>
                <Ribbon
                  kicker="open positions"
                  right={
                    <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
                      3 of 5
                    </span>
                  }
                />
                <div style={{ marginTop: 8 }}>
                  <OpenPositions />
                </div>
              </div>
            </div>

            <div>
              <Ribbon kicker="safety rails" color={T.warning} />
              <div style={{ marginTop: 10 }}>
                <DotRow label="Max drawdown" value="−15% → pause" color={T.loss} />
                <DotRow label="Daily loss cap" value="−3% → halt today" color={T.loss} />
                <DotRow label="Max position size" value="2% of equity" />
                <DotRow label="Max concurrent" value="5 open" />
                <DotRow label="Trading window" value="10:00 – 15:15 PKT" />
                <DotRow label="Kill-switch" value="Active" color={T.gain} bold />
              </div>

              <div style={{ marginTop: 32 }}>
                <Ribbon kicker="recent activity" />
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: T.fontMono,
                    fontSize: 11.5,
                    color: T.text2,
                    lineHeight: 1.9,
                  }}
                >
                  <div>
                    <span style={{ color: T.text3 }}>14:32:08</span>{" "}
                    <span style={{ color: T.gain }}>BUY</span> HBL 2,500 @ 88.60{" "}
                    <span style={{ color: T.text3 }}>· signal fired</span>
                  </div>
                  <div>
                    <span style={{ color: T.text3 }}>14:20:44</span>{" "}
                    <span style={{ color: T.text3 }}>scan</span> 47 symbols · 1 signal
                  </div>
                  <div>
                    <span style={{ color: T.text3 }}>13:04:11</span>{" "}
                    <span style={{ color: T.loss }}>SELL</span> LUCK 200 @ 619.00{" "}
                    <span style={{ color: T.loss }}>· stop hit</span>
                  </div>
                  <div>
                    <span style={{ color: T.text3 }}>11:48:22</span>{" "}
                    <span style={{ color: T.gain }}>BUY</span> ENGRO 600 @ 278.50
                  </div>
                  <div>
                    <span style={{ color: T.text3 }}>10:31:02</span>{" "}
                    <span style={{ color: T.text3 }}>scan</span> 47 symbols · 0 signals
                  </div>
                  <div>
                    <span style={{ color: T.text3 }}>10:00:00</span>{" "}
                    <span style={{ color: T.gain }}>●</span>{" "}
                    <span style={{ color: T.text2 }}>Market open · bot active</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLogsOpen(true)}
                  style={{
                    marginTop: 10,
                    fontFamily: T.fontMono,
                    fontSize: 10.5,
                    color: T.primaryLight,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  view full log →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {logsOpen && <LogsModal onClose={() => setLogsOpen(false)} />}
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function LogsModal({ onClose }: { onClose: () => void }) {
  const T = useT();

  return (
    <Modal onClose={onClose} width={620} label="Bot activity log" fullHeight>
        <div style={{ padding: "22px 26px 12px", borderBottom: `1px solid ${T.outlineFaint}` }}>
          <Kicker color={T.primaryLight}>bot activity log</Kicker>
          <h2
            style={{
              fontFamily: T.fontHead,
              fontSize: 22,
              fontWeight: 500,
              margin: "10px 0 4px",
              letterSpacing: -0.5,
            }}
          >
            Momentum · live
          </h2>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            {LOG_ENTRIES.length} entries · last 48 hours
          </div>
        </div>

        <div
          style={{
            padding: "14px 26px",
            overflowY: "auto",
            fontFamily: T.fontMono,
            fontSize: 12,
            lineHeight: 1.9,
          }}
        >
          {LOG_ENTRIES.map((entry, i) => {
            const kindColor: Record<LogEntry["kind"], string> = {
              buy: T.gain,
              sell: T.loss,
              scan: T.text3,
              info: T.text2,
              warn: T.warning,
            };
            return (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ color: T.text3, minWidth: 110 }}>{entry.time}</span>
                <span style={{ color: kindColor[entry.kind], flex: 1 }}>{entry.text}</span>
              </div>
            );
          })}
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
            Close
          </Btn>
          <Btn variant="primary" size="sm" icon={Icon.check} onClick={onClose}>
            Acknowledge
          </Btn>
        </div>
    </Modal>
  );
}

function OpenPositions() {
  const T = useT();
  const cols: Col[] = [
    { label: "symbol", width: "100px", primary: true },
    { label: "dir", width: "60px" },
    { label: "entry", width: "130px", mobileFullWidth: true },
    { label: "now", align: "right", width: "90px" },
    { label: "qty", align: "right", width: "90px" },
    { label: "p&l", align: "right", width: "120px" },
    { label: "return", align: "right", width: "100px" },
    { label: "held", align: "right", width: "70px" },
    { label: "stop", align: "right", width: "80px" },
  ];
  const rows: unknown[][] = [
    ["OGDC", "BUY", "Apr 15 · 128.40", "132.60", "1,500", "+6,300", "+3.27%", "5d", "124.55"],
    ["ENGRO", "BUY", "Apr 17 · 278.50", "281.20", "  600", "+1,620", "+0.97%", "3d", "270.15"],
    ["HBL", "BUY", "Apr 18 · 88.60", "89.95", "2,500", "+3,375", "+1.52%", "2d", "85.94"],
  ];
  return (
    <TerminalTable
      cols={cols}
      rows={rows}
      renderCell={(cell, ci) => {
        if (ci === 0)
          return <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>;
        if (ci === 1) return <span style={{ color: T.gain }}>{cell as ReactNode}</span>;
        if (ci === 5 || ci === 6)
          return <span style={{ color: T.gain }}>{cell as ReactNode}</span>;
        if (ci === 7) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
        if (ci === 8) return <span style={{ color: T.loss }}>{cell as ReactNode}</span>;
        return cell as ReactNode;
      }}
    />
  );
}
