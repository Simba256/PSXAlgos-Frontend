"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useT } from "@/components/theme";
import { useBreakpoint } from "@/components/responsive";
import type { BacktestOHLCBar } from "@/lib/hooks/useBacktestChartSeries";
import type { BacktestTrade } from "@/lib/api/strategies";

export interface BacktestPriceChartProps {
  symbol: string;
  bars: BacktestOHLCBar[];
  trades: BacktestTrade[];
  focusedTradeIndex: number | null;
  onClearFocus: () => void;
}

const PAD_L = 48;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;
const FOCUS_BARS_PAD = 5;

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
}

interface HoverState {
  x: number;
  y: number;
  index: number;
}

export default function BacktestPriceChart({
  symbol,
  bars,
  trades,
  focusedTradeIndex,
  onClearFocus,
}: BacktestPriceChartProps) {
  const T = useT();
  const { isMobile } = useBreakpoint();
  const height = isMobile ? 240 : 320;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(720);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Track container width with ResizeObserver so the SVG fills the column
  // and re-renders cleanly on viewport changes.
  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Stored on the element so the cleanup hook below can find it.
    (el as HTMLDivElement & { __ro?: ResizeObserver }).__ro = ro;
  }, []);

  // Build a date -> index map once per bars change so date-based markers
  // (entry/exit dates from trades) can resolve to bar positions in O(1).
  const dateIndex = useMemo(() => {
    const m = new Map<string, number>();
    bars.forEach((b, i) => m.set(isoFromMs(b.t), i));
    return m;
  }, [bars]);

  // When a trade row is focused, slice the bar window to entry-5d .. exit+5d
  // so the candle area zooms to that trade. Falls back to the full range
  // when no trade is focused or the dates don't resolve to bars.
  const { visibleBars, baseIndex } = useMemo(() => {
    if (focusedTradeIndex === null) {
      return { visibleBars: bars, baseIndex: 0 };
    }
    const t = trades[focusedTradeIndex];
    if (!t) return { visibleBars: bars, baseIndex: 0 };
    const entryIdx = dateIndex.get(t.entry_date);
    const exitIdx = dateIndex.get(t.exit_date);
    if (entryIdx === undefined || exitIdx === undefined) {
      return { visibleBars: bars, baseIndex: 0 };
    }
    const lo = Math.max(0, Math.min(entryIdx, exitIdx) - FOCUS_BARS_PAD);
    const hi = Math.min(bars.length, Math.max(entryIdx, exitIdx) + FOCUS_BARS_PAD + 1);
    return { visibleBars: bars.slice(lo, hi), baseIndex: lo };
  }, [bars, trades, focusedTradeIndex, dateIndex]);

  const innerW = Math.max(0, width - PAD_L - PAD_R);
  const innerH = height - PAD_T - PAD_B;

  // Price scale spans the visible window only — keeps candles legible when
  // the user zooms into a single trade.
  const { priceMin, priceMax } = useMemo(() => {
    if (visibleBars.length === 0) return { priceMin: 0, priceMax: 1 };
    let lo = visibleBars[0].l;
    let hi = visibleBars[0].h;
    for (const b of visibleBars) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    const pad = (hi - lo) * 0.05 || hi * 0.01 || 1;
    return { priceMin: lo - pad, priceMax: hi + pad };
  }, [visibleBars]);

  const priceRange = priceMax - priceMin || 1;
  const step = visibleBars.length > 0 ? innerW / visibleBars.length : 0;
  const candleW = Math.max(1, Math.min(12, step * 0.7));

  const xOf = (i: number) => PAD_L + i * step + step / 2;
  const yOf = (p: number) => PAD_T + innerH - ((p - priceMin) / priceRange) * innerH;

  // Trade markers and connectors are positioned against the visible window
  // (baseIndex offset). Trades whose dates fall outside the window are skipped.
  const tradeMarkers = useMemo(() => {
    const out: Array<{
      kind: "entry" | "exit";
      i: number;
      price: number;
      color: string;
      key: string;
    }> = [];
    trades.forEach((t, ti) => {
      const ei = dateIndex.get(t.entry_date);
      const xi = dateIndex.get(t.exit_date);
      const pnlColor = t.pnl >= 0 ? T.gain : T.loss;
      if (ei !== undefined && ei >= baseIndex && ei < baseIndex + visibleBars.length) {
        out.push({
          kind: "entry",
          i: ei - baseIndex,
          price: t.entry_price,
          color: T.gain,
          key: `e${ti}`,
        });
      }
      if (xi !== undefined && xi >= baseIndex && xi < baseIndex + visibleBars.length) {
        out.push({
          kind: "exit",
          i: xi - baseIndex,
          price: t.exit_price,
          color: pnlColor,
          key: `x${ti}`,
        });
      }
    });
    return out;
  }, [trades, dateIndex, baseIndex, visibleBars.length, T.gain, T.loss]);

  const connectors = useMemo(() => {
    const winLo = baseIndex;
    const winHi = baseIndex + visibleBars.length;
    return trades
      .map((t, ti) => {
        const ei = dateIndex.get(t.entry_date);
        const xi = dateIndex.get(t.exit_date);
        if (ei === undefined || xi === undefined) return null;
        if (xi < winLo || ei >= winHi) return null;
        return {
          key: `c${ti}`,
          x1: xOf(Math.max(0, ei - baseIndex)),
          y1: yOf(t.entry_price),
          x2: xOf(Math.min(visibleBars.length - 1, xi - baseIndex)),
          y2: yOf(t.exit_price),
          color: t.pnl >= 0 ? T.gain : T.loss,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [trades, dateIndex, baseIndex, visibleBars.length, priceMin, priceMax, step, innerW, T.gain, T.loss]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crosshair: convert mouse x to the nearest bar in the visible window.
  const handleMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (visibleBars.length === 0 || step === 0) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const localX = ((e.clientX - rect.left) / rect.width) * width;
      const localY = ((e.clientY - rect.top) / rect.height) * height;
      const idx = Math.max(
        0,
        Math.min(visibleBars.length - 1, Math.floor((localX - PAD_L) / step)),
      );
      setHover({ x: localX, y: localY, index: idx });
    },
    [visibleBars.length, step, width, height],
  );

  const handleLeave = useCallback(() => setHover(null), []);

  // Y-axis gridlines + labels at 4 evenly spaced ticks.
  const yTicks = useMemo(() => {
    const ticks: Array<{ y: number; label: string }> = [];
    for (let i = 0; i <= 4; i++) {
      const p = priceMin + (priceRange * i) / 4;
      ticks.push({ y: yOf(p), label: p.toFixed(2) });
    }
    return ticks;
  }, [priceMin, priceRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // X-axis labels at ~5 spaced positions through the visible window.
  const xTicks = useMemo(() => {
    if (visibleBars.length === 0) return [];
    const n = Math.min(5, visibleBars.length);
    const ticks: Array<{ x: number; label: string }> = [];
    for (let i = 0; i < n; i++) {
      const bi = Math.floor((i * (visibleBars.length - 1)) / Math.max(1, n - 1));
      ticks.push({ x: xOf(bi), label: shortDate(isoFromMs(visibleBars[bi].t)) });
    }
    return ticks;
  }, [visibleBars]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoveredBar = hover ? visibleBars[hover.index] : null;
  const hoveredTrade = useMemo(() => {
    if (!hoveredBar) return null;
    const iso = isoFromMs(hoveredBar.t);
    return trades.find((t) => t.entry_date === iso || t.exit_date === iso) ?? null;
  }, [hoveredBar, trades]);

  if (bars.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.fontMono,
          fontSize: 12,
          color: T.text3,
          border: `1px dashed ${T.outlineFaint}`,
          borderRadius: 4,
        }}
      >
        no price data for {symbol} in the backtest window
      </div>
    );
  }

  return (
    <div
      ref={setContainer}
      style={{ position: "relative", width: "100%", height, overflow: "hidden" }}
    >
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ display: "block", background: T.surface }}
      >
        {/* Y-axis grid + labels */}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={t.y}
              y2={t.y}
              stroke={T.outlineFaint}
              strokeDasharray="2 4"
            />
            <text
              x={PAD_L - 6}
              y={t.y + 3}
              textAnchor="end"
              style={{
                fontFamily: T.fontMono,
                fontSize: 10,
                fill: T.text3,
              }}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            x={t.x}
            y={height - 8}
            textAnchor="middle"
            style={{
              fontFamily: T.fontMono,
              fontSize: 10,
              fill: T.text3,
            }}
          >
            {t.label}
          </text>
        ))}

        {/* Candles */}
        {visibleBars.map((b, i) => {
          const x = xOf(i);
          const up = b.c >= b.o;
          const color = up ? T.gain : T.loss;
          const yHi = yOf(b.h);
          const yLo = yOf(b.l);
          const yOpen = yOf(b.o);
          const yClose = yOf(b.c);
          const bodyTop = Math.min(yOpen, yClose);
          const bodyH = Math.max(1, Math.abs(yClose - yOpen));
          return (
            <g key={`b${i}`}>
              <line x1={x} x2={x} y1={yHi} y2={yLo} stroke={color} strokeWidth={1} />
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={color}
                stroke={color}
              />
            </g>
          );
        })}

        {/* Trade connectors (entry → exit) */}
        {connectors.map((c) => (
          <line
            key={c.key}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
            stroke={c.color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
        ))}

        {/* Trade markers (▲ entry / ▼ exit) */}
        {tradeMarkers.map((m) => {
          const x = xOf(m.i);
          if (m.kind === "entry") {
            const y = yOf(m.price) + 14;
            return (
              <polygon
                key={m.key}
                points={`${x},${y - 6} ${x - 4},${y} ${x + 4},${y}`}
                fill={m.color}
              />
            );
          }
          const y = yOf(m.price) - 14;
          return (
            <polygon
              key={m.key}
              points={`${x},${y + 6} ${x - 4},${y} ${x + 4},${y}`}
              fill={m.color}
            />
          );
        })}

        {/* Crosshair */}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={xOf(hover.index)}
              x2={xOf(hover.index)}
              y1={PAD_T}
              y2={height - PAD_B}
              stroke={T.text3}
              strokeDasharray="2 3"
              opacity={0.5}
            />
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={hover.y}
              y2={hover.y}
              stroke={T.text3}
              strokeDasharray="2 3"
              opacity={0.5}
            />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hover && hoveredBar && (
        <div
          style={{
            position: "absolute",
            left: Math.min(hover.x + 12, width - 180),
            top: Math.max(hover.y - 8, 8),
            background: T.surface2,
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 4,
            padding: "6px 10px",
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text2,
            pointerEvents: "none",
            zIndex: 10,
            minWidth: 160,
          }}
        >
          <div style={{ color: T.text3, marginBottom: 4 }}>
            {isoFromMs(hoveredBar.t)}
          </div>
          <div>O {hoveredBar.o.toFixed(2)}</div>
          <div>H {hoveredBar.h.toFixed(2)}</div>
          <div>L {hoveredBar.l.toFixed(2)}</div>
          <div>C {hoveredBar.c.toFixed(2)}</div>
          {hoveredTrade && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: `1px solid ${T.outlineFaint}`,
                color: hoveredTrade.pnl >= 0 ? T.gain : T.loss,
              }}
            >
              <div>
                {isoFromMs(hoveredBar.t) === hoveredTrade.entry_date ? "Entry" : "Exit"} ·{" "}
                {hoveredTrade.symbol}
              </div>
              <div>
                PnL: {hoveredTrade.pnl >= 0 ? "+" : ""}
                {Math.round(hoveredTrade.pnl).toLocaleString()}
              </div>
              <div style={{ color: T.text3 }}>{hoveredTrade.exit_reason}</div>
            </div>
          )}
        </div>
      )}

      {focusedTradeIndex !== null && (
        <button
          type="button"
          onClick={onClearFocus}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: T.surface2,
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 4,
            padding: "3px 8px",
            fontFamily: T.fontMono,
            fontSize: 10.5,
            color: T.text3,
            cursor: "pointer",
          }}
        >
          clear focus
        </button>
      )}
    </div>
  );
}
