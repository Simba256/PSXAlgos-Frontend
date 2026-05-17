"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { addDays, subDays, format } from "date-fns";
import {
  Chart,
  CandlestickSeries,
  LineSeries,
} from "lightweight-charts-react-wrapper";
import type { IChartApi, MouseEventParams, SeriesMarker, Time } from "lightweight-charts";
import { CrosshairMode } from "lightweight-charts";
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
  chartRef?: RefObject<IChartApi | null>;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade: BacktestTrade | null;
}

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isoFromMs2(ms: number): Time {
  return isoFromMs(ms) as Time;
}

function padDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const result = days >= 0 ? addDays(d, days) : subDays(d, -days);
  return format(result, "yyyy-MM-dd");
}

export default function BacktestPriceChart({
  symbol,
  bars,
  trades,
  focusedTradeIndex,
  onClearFocus,
  chartRef,
}: BacktestPriceChartProps) {
  const T = useT();
  const { isMobile } = useBreakpoint();
  const chartHeight = isMobile ? 240 : 320;
  const internalChartRef = useRef<IChartApi>(null);
  const resolvedRef = (chartRef as RefObject<IChartApi | null> | undefined) ?? internalChartRef;

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, time: "", open: 0, high: 0, low: 0, close: 0, volume: 0, trade: null,
  });

  const candleData = useMemo(
    () =>
      bars.map((b) => ({
        time: isoFromMs2(b.t),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      })),
    [bars],
  );

  const markers = useMemo<SeriesMarker<Time>[]>(() => {
    const out: SeriesMarker<Time>[] = [];
    for (const trade of trades) {
      out.push({
        time: trade.entry_date as Time,
        position: "belowBar",
        shape: "arrowUp",
        color: T.gain,
        text: "▲ entry",
      });
      out.push({
        time: trade.exit_date as Time,
        position: "aboveBar",
        shape: "arrowDown",
        color: trade.pnl >= 0 ? T.gain : T.loss,
        text: "▼ exit",
      });
    }
    out.sort((a, b) => {
      const ta = String(a.time);
      const tb = String(b.time);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    return out;
  }, [trades, T.gain, T.loss]);

  const connectorLines = useMemo(
    () =>
      trades.map((trade) => ({
        key: `${trade.entry_date}-${trade.exit_date}-${trade.entry_price}`,
        color: trade.pnl >= 0 ? T.gain : T.loss,
        data: [
          { time: trade.entry_date as Time, value: trade.entry_price },
          { time: trade.exit_date as Time, value: trade.exit_price },
        ],
      })),
    [trades, T.gain, T.loss],
  );

  const tradesByDate = useMemo(() => {
    const map = new Map<string, BacktestTrade>();
    for (const t of trades) {
      map.set(t.entry_date, t);
      map.set(t.exit_date, t);
    }
    return map;
  }, [trades]);

  const handleCrosshairMove = useCallback(
    (param: MouseEventParams<Time>) => {
      if (!param.point || !param.time) {
        setTooltip((prev) => ({ ...prev, visible: false }));
        return;
      }
      const timeStr = String(param.time);
      let barData = { open: 0, high: 0, low: 0, close: 0, volume: 0 };
      for (const [, value] of param.seriesData) {
        const v = value as { open?: number; high?: number; low?: number; close?: number };
        if (v.open !== undefined) {
          barData = {
            open: v.open ?? 0,
            high: (v as { high?: number }).high ?? 0,
            low: (v as { low?: number }).low ?? 0,
            close: (v as { close?: number }).close ?? 0,
            volume: 0,
          };
          break;
        }
      }
      const matchedTrade = tradesByDate.get(timeStr) ?? null;
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        time: timeStr,
        ...barData,
        trade: matchedTrade,
      });
    },
    [tradesByDate],
  );

  useEffect(() => {
    if (focusedTradeIndex === null) return;
    const trade = trades[focusedTradeIndex];
    if (!trade) return;
    const chart = resolvedRef.current;
    if (!chart) return;
    const from = padDate(trade.entry_date, -5) as Time;
    const to = padDate(trade.exit_date, 5) as Time;
    chart.timeScale().setVisibleRange({ from, to });
  }, [focusedTradeIndex, trades, resolvedRef]);

  if (bars.length === 0) {
    return (
      <div
        style={{
          height: chartHeight,
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
    <div style={{ position: "relative", height: chartHeight, overflow: "hidden" }}>
      <Chart
        ref={resolvedRef}
        height={chartHeight}
        layout={{
          background: { color: T.surface },
          textColor: T.text3,
        }}
        grid={{
          vertLines: { color: T.outlineFaint },
          horzLines: { color: T.outlineFaint },
        }}
        crosshair={{ mode: CrosshairMode.Normal }}
        rightPriceScale={{ visible: true, borderColor: T.outlineFaint }}
        timeScale={{ borderColor: T.outlineFaint, timeVisible: true }}
        onCrosshairMove={handleCrosshairMove}
        container={{ style: { width: "100%", height: chartHeight } }}
      >
        <CandlestickSeries
          data={candleData}
          markers={markers}
          upColor={T.gain}
          downColor={T.loss}
          borderUpColor={T.gain}
          borderDownColor={T.loss}
          wickUpColor={T.gain}
          wickDownColor={T.loss}
          reactive
        />
        {connectorLines.map((line) => (
          <LineSeries
            key={line.key}
            data={line.data}
            color={line.color}
            lineWidth={1}
            reactive
          />
        ))}
      </Chart>

      {tooltip.visible && tooltip.open !== 0 && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltip.x + 12, 280),
            top: Math.max(tooltip.y - 8, 8),
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
          <div style={{ color: T.text3, marginBottom: 4 }}>{tooltip.time}</div>
          <div>O {tooltip.open.toFixed(2)}</div>
          <div>H {tooltip.high.toFixed(2)}</div>
          <div>L {tooltip.low.toFixed(2)}</div>
          <div>C {tooltip.close.toFixed(2)}</div>
          {tooltip.trade && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: `1px solid ${T.outlineFaint}`,
                color: tooltip.trade.pnl >= 0 ? T.gain : T.loss,
              }}
            >
              <div>
                {tooltip.time === tooltip.trade.entry_date ? "Entry" : "Exit"} ·{" "}
                {tooltip.trade.symbol}
              </div>
              <div>
                PnL: {tooltip.trade.pnl >= 0 ? "+" : ""}
                {Math.round(tooltip.trade.pnl).toLocaleString()}
              </div>
              <div style={{ color: T.text3 }}>{tooltip.trade.exit_reason}</div>
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
