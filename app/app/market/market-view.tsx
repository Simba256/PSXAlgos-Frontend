"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import { Kicker, Chip, StatusDot, KV, SoftPanel, Btn } from "@/components/atoms";
import {
  useMarketOverview,
  useMarketIndices,
  useTopMovers,
  useSectorPerformance,
  type MoverType,
} from "@/lib/hooks/use-market";
import type {
  IndexResponse,
  StockMoverResponse,
  MostActiveStockResponse,
  SectorPerformanceResponse,
} from "@/lib/api/market";

/* ─── Market status ─── */

type MarketStatus = "open" | "closed" | "pre-market" | "after-hours";

function getMarketStatus(): MarketStatus {
  const now = new Date();
  const pkTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  const day = pkTime.getDay();
  const time = pkTime.getHours() * 60 + pkTime.getMinutes();
  if (day === 0 || day === 6) return "closed";
  const open = 9 * 60 + 30;
  const close = day === 5 ? 16 * 60 : 15 * 60 + 30;
  if (time < open - 30) return "closed";
  if (time < open) return "pre-market";
  if (time <= close) return "open";
  if (time <= close + 30) return "after-hours";
  return "closed";
}

/* ─── Skeleton ─── */

function Skeleton({ width, height }: { width?: string | number; height?: number }) {
  const T = useT();
  return (
    <div
      style={{
        width: width ?? "100%",
        height: height ?? 16,
        borderRadius: 4,
        background: T.surface3,
        opacity: 0.7,
      }}
    />
  );
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

/* ─── MarketHero ─── */

function MarketHero() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const { data: overview } = useMarketOverview();
  const { data: indices } = useMarketIndices("1D");

  const status = getMarketStatus();
  const statusLabel: Record<MarketStatus, string> = {
    open: "Open",
    closed: "Closed",
    "pre-market": "Pre-Market",
    "after-hours": "After Hours",
  };
  const statusColor: Record<MarketStatus, string> = {
    open: T.gain,
    closed: T.loss,
    "pre-market": T.warning,
    "after-hours": T.accent,
  };

  const kse100 = indices?.find((i) => i.name === "KSE-100");
  const changeColor = kse100 && kse100.changePercent >= 0 ? T.gain : T.loss;

  return (
    <div
      style={{
        padding: pick(bp, {
          mobile: `20px ${padX} 16px`,
          tablet: `24px ${padX} 20px`,
          desktop: `28px ${padX} 22px`,
        }),
        borderBottom: `1px solid ${T.outlineFaint}`,
        display: "flex",
        alignItems: pick(bp, { mobile: "flex-start", desktop: "center" }),
        flexDirection: pick(bp, { mobile: "column", desktop: "row" }),
        gap: pick(bp, { mobile: 12, desktop: 24 }),
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Kicker>Market Overview</Kicker>
          <Chip
            bg={statusColor[status] + "22"}
            color={statusColor[status]}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <StatusDot color={statusColor[status]} pulse={status === "open"} />
            {statusLabel[status]}
          </Chip>
        </div>
        {kse100 ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: T.fontHead,
                fontSize: pick(bp, { mobile: 32, tablet: 40, desktop: 48 }),
                fontWeight: 500,
                color: T.text,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              {kse100.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 15,
                color: changeColor,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {kse100.change >= 0 ? "+" : ""}
              {kse100.change.toLocaleString("en-US", { maximumFractionDigits: 2 })} (
              {kse100.changePercent >= 0 ? "+" : ""}
              {kse100.changePercent.toFixed(2)}%)
            </span>
          </div>
        ) : (
          <Skeleton width={240} height={48} />
        )}
      </div>
      {overview?.latest_date && (
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
            whiteSpace: "nowrap",
          }}
        >
          Data as of: {overview.latest_date}
        </div>
      )}
    </div>
  );
}

/* ─── Sparkline SVG ─── */

function Sparkline({ points, color, width = 80, height = 28 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((v) => height - ((v - min) / range) * height);
  const polyPoints = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── IndexCard ─── */

function IndexCard({ index }: { index: IndexResponse }) {
  const T = useT();
  const isPositive = index.changePercent >= 0;
  const changeColor = isPositive ? T.gain : T.loss;
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 8,
        border: `1px solid ${T.outlineFaint}`,
        padding: "14px 16px",
        minWidth: 160,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {index.name}
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 22,
          fontWeight: 500,
          color: T.text,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.3,
          lineHeight: 1,
        }}
      >
        {index.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 12, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
          {index.change >= 0 ? "+" : ""}
          {index.change.toLocaleString("en-US", { maximumFractionDigits: 2 })} ({index.changePercent >= 0 ? "+" : ""}
          {index.changePercent.toFixed(2)}%)
        </span>
        {index.sparkline.length >= 2 && (
          <Sparkline points={index.sparkline} color={changeColor} />
        )}
      </div>
    </div>
  );
}

/* ─── SectionRibbon ─── */

function SectionRibbon({ label }: { label: string }) {
  const T = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: T.outlineVariant + "66" }} />
    </div>
  );
}

/* ─── IndicesStrip ─── */

const PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y"] as const;
type Period = (typeof PERIODS)[number];

function IndicesStrip() {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const [period, setPeriod] = useState<Period>("1D");
  const { data, hasLoaded, error } = useMarketIndices(period);

  return (
    <div style={{ padding: `20px ${padX}`, borderBottom: `1px solid ${T.outlineFaint}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <SectionRibbon label="Indices" />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                border: `1px solid ${period === p ? T.primaryLight : T.outlineFaint}`,
                background: period === p ? T.surface3 : "transparent",
                color: period === p ? T.primaryLight : T.text3,
                fontFamily: T.fontMono,
                fontSize: 11,
                cursor: "pointer",
                fontWeight: period === p ? 600 : 400,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.loss }}>Failed to load indices.</div>
      ) : !hasLoaded ? (
        <div style={{ display: "flex", gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width={180} height={90} />)}
        </div>
      ) : (
        <div
          style={
            isMobile
              ? { display: "flex", flexDirection: "row", gap: 12, overflowX: "auto", WebkitOverflowScrolling: "touch" as CSSProperties["WebkitOverflowScrolling"], paddingBottom: 4 }
              : { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }
          }
        >
          {(data ?? []).map((index) => (
            <IndexCard key={index.symbol} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── BreadthStat ─── */

function BreadthStat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return <KV label={label} value={value} color={color} />;
}

/* ─── BreadthRow ─── */

function BreadthRow() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const { data, hasLoaded, error } = useMarketOverview();

  const breadth = data?.market_breadth;

  function fmtVol(v: number): string {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + "M";
    return v.toLocaleString();
  }

  return (
    <div style={{ padding: `16px ${padX}`, borderBottom: `1px solid ${T.outlineFaint}` }}>
      <SectionRibbon label="Market Breadth" />
      {error ? (
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.loss }}>Failed to load breadth data.</div>
      ) : !hasLoaded ? (
        <SkeletonBlock lines={2} />
      ) : breadth ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: pick(bp, { mobile: 16, desktop: 28 }),
            alignItems: "flex-start",
          }}
        >
          <BreadthStat label="Advancers" value={breadth.advancers} color={T.gain} />
          <BreadthStat label="Decliners" value={breadth.decliners} color={T.loss} />
          <BreadthStat label="Unchanged" value={breadth.unchanged} color={T.text2} />
          <BreadthStat
            label="A/D Ratio"
            value={breadth.advance_decline_ratio !== null ? breadth.advance_decline_ratio.toFixed(2) : "—"}
          />
          <BreadthStat label="New Highs" value={breadth.new_highs} color={T.gain} />
          <BreadthStat label="New Lows" value={breadth.new_lows} color={T.loss} />
          <BreadthStat label="Total Volume" value={fmtVol(breadth.total_volume)} />
          <BreadthStat label="Adv. Volume" value={fmtVol(breadth.advancing_volume)} color={T.gain} />
          <BreadthStat label="Dec. Volume" value={fmtVol(breadth.declining_volume)} color={T.loss} />
        </div>
      ) : (
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.text3 }}>No breadth data available.</div>
      )}
    </div>
  );
}

/* ─── MoverRow ─── */

function MoverRow({ stock, showChange }: { stock: StockMoverResponse | MostActiveStockResponse; showChange: boolean }) {
  const T = useT();
  const isPositive = stock.change_percent >= 0;
  const changeColor = isPositive ? T.gain : T.loss;

  function fmtVol(v: number | null): string {
    if (!v) return "—";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
    return v.toLocaleString();
  }

  return (
    <a
      href={`/stock/${stock.symbol}`}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: `1px dotted ${T.outlineFaint}`,
        textDecoration: "none",
        gap: 12,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = T.surface3; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 12.5, color: T.text, fontWeight: 600 }}>{stock.symbol}</div>
        <div style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {stock.name ?? "—"}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.text, fontVariantNumeric: "tabular-nums" }}>
          {stock.current_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {showChange && (
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
            {stock.change_percent >= 0 ? "+" : ""}{stock.change_percent.toFixed(2)}%
          </div>
        )}
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.text3 }}>
          {fmtVol(stock.volume)}
        </div>
      </div>
    </a>
  );
}

/* ─── TopMoversTabs ─── */

const MOVER_TABS: { key: MoverType; label: string }[] = [
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "most-active", label: "Most Active" },
];

function TopMoversTabContent({ type }: { type: MoverType }) {
  const T = useT();
  const { data, hasLoaded, error } = useTopMovers(type, 10);
  if (error) return <div style={{ padding: 16, fontFamily: T.fontMono, fontSize: 12, color: T.loss }}>Failed to load {type}.</div>;
  if (!hasLoaded) return <div style={{ padding: 16 }}><SkeletonBlock lines={5} /></div>;
  if (!data || data.length === 0) return <div style={{ padding: 16, fontFamily: T.fontMono, fontSize: 12, color: T.text3 }}>No data.</div>;
  return (
    <div>
      {data.map((stock) => (
        <MoverRow key={stock.symbol} stock={stock} showChange={type !== "most-active"} />
      ))}
    </div>
  );
}

function TopMoversTabs() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const [activeTab, setActiveTab] = useState<MoverType>("gainers");

  return (
    <div style={{ padding: `20px ${padX}`, borderBottom: `1px solid ${T.outlineFaint}` }}>
      <SectionRibbon label="Top Movers" />
      <SoftPanel>
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${T.outlineFaint}`,
            overflowX: "auto",
          }}
        >
          {MOVER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                borderBottom: `2px solid ${activeTab === key ? T.primaryLight : "transparent"}`,
                background: activeTab === key ? T.surface3 : "transparent",
                color: activeTab === key ? T.primaryLight : T.text2,
                fontFamily: T.fontMono,
                fontSize: 12,
                fontWeight: activeTab === key ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.12s, border-color 0.12s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <TopMoversTabContent type={activeTab} />
      </SoftPanel>
    </div>
  );
}

/* ─── SectorRow ─── */

function SectorRow({ sector, maxAbs }: { sector: SectorPerformanceResponse; maxAbs: number }) {
  const T = useT();
  const isPositive = sector.avg_change_percent >= 0;
  const changeColor = isPositive ? T.gain : T.loss;
  const barWidth = maxAbs > 0 ? Math.abs(sector.avg_change_percent) / maxAbs : 0;
  const sectorEncoded = encodeURIComponent(sector.sector);

  return (
    <a
      href={`/screener?sector=${sectorEncoded}`}
      style={{
        display: "block",
        position: "relative",
        padding: "10px 12px",
        borderRadius: 6,
        textDecoration: "none",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = T.surface3; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isPositive ? T.gain + "18" : T.loss + "18",
          width: `${barWidth * 100}%`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: T.fontSans, fontSize: 12.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sector.sector}
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.text3 }}>
            {sector.advancers}↑ {sector.decliners}↓ · {sector.stock_count} stocks
          </div>
        </div>
        <span style={{ fontFamily: T.fontMono, fontSize: 13, color: changeColor, fontVariantNumeric: "tabular-nums", fontWeight: 600, flexShrink: 0 }}>
          {sector.avg_change_percent >= 0 ? "+" : ""}{sector.avg_change_percent.toFixed(2)}%
        </span>
      </div>
    </a>
  );
}

/* ─── SectorPerformanceList ─── */

function SectorPerformanceList() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const { data, hasLoaded, error } = useSectorPerformance();

  const maxAbs = data ? Math.max(...data.map((s) => Math.abs(s.avg_change_percent)), 0.01) : 0.01;

  const cols = pick(bp, { mobile: 1, tablet: 2, desktop: 3 });

  return (
    <div style={{ padding: `20px ${padX}`, borderBottom: `1px solid ${T.outlineFaint}` }}>
      <SectionRibbon label="Sector Performance" />
      {error ? (
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.loss }}>Failed to load sector data.</div>
      ) : !hasLoaded ? (
        <SkeletonBlock lines={6} />
      ) : (
        <SoftPanel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 2,
              padding: 8,
            }}
          >
            {(data ?? []).map((sector) => (
              <SectorRow key={sector.sector} sector={sector} maxAbs={maxAbs} />
            ))}
          </div>
        </SoftPanel>
      )}
    </div>
  );
}

/* ─── HeatmapCta ─── */

function HeatmapCta() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  return (
    <div style={{ padding: `20px ${padX} 32px` }}>
      <div
        style={{
          background: T.surface2,
          borderRadius: 8,
          border: `1px solid ${T.outlineFaint}`,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: T.fontHead, fontSize: 15, color: T.text, fontWeight: 500 }}>Market Heatmap</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, marginTop: 4 }}>
            Visualize all PSX stocks by sector, size, and performance.
          </div>
        </div>
        <Btn variant="outline" style={{ pointerEvents: "none", opacity: 0.5 }}>
          Coming Soon
        </Btn>
      </div>
    </div>
  );
}

/* ─── Root view ─── */

export function MarketView() {
  const T = useT();
  const { bp } = useBreakpoint();

  return (
    <AppFrame route="/market">
      <div style={{ flex: 1, background: T.surface, minHeight: "100vh" }}>
        <MarketHero />
        <IndicesStrip />
        <BreadthRow />
        <TopMoversTabs />
        <SectorPerformanceList />
        <HeatmapCta />
      </div>
    </AppFrame>
  );
}
