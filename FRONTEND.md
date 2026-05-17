# PSX UI — Frontend

> FastAPI backend → Next.js 15 frontend. Active repo; `psx-trading-view/` is legacy.
> Last updated: 2026-05-16

---

## Directory Structure

```
app/
├── app/                   # Next.js App Router pages + API proxy routes
│   ├── api/               # Proxy routes (forward auth headers to Railway backend)
│   │   └── strategies/
│   │       ├── [id]/
│   │       │   └── backtests/
│   │       │       └── [backtestId]/
│   │       │           └── chart-series/route.ts   # BT5 proxy
│   │       └── route.ts
│   ├── backtest/          # /backtests/[id] — result page, chart, trade log
│   ├── bots/              # /bots — bot management
│   ├── leaderboard/
│   ├── portfolio/
│   ├── pricing/
│   ├── signals/
│   └── strategies/        # /strategies — list + editor
├── components/            # Shared UI primitives
│   ├── atoms.tsx          # TerminalTable, StatTile, Badge, ProgressBar, etc.
│   ├── charts.tsx         # Shared Recharts wrappers (not used for backtest price chart)
│   ├── strategy-editor/   # Strategy rule tree + expression editor
│   └── ...
└── lib/
    ├── api/               # Typed API client functions (strategies.ts, bots.ts, …)
    ├── hooks/             # SWR data hooks
    └── strategy/          # Expression parser + AST types (SB1/SB2)
```

---

## Conventions

- **SWR for all server state.** Every hook exposes `hasLoaded`, `isValidating`, `error`.
- `errorRetryCount: 0` on all SWR hooks — retries are handled by `client.ts` (3 attempts, exponential backoff).
- `keepPreviousData: true` to prevent layout shifts.
- `revalidateOnFocus: false` on data that doesn't change between user actions.
- No `any` types. Proper interfaces for all API responses, exported alongside hooks for BE↔FE schema parity verification.
- `showToast.error()` for user-facing failures. Never show raw error messages.

---

## Hooks Reference

### `useBacktestChartSeries(strategyId, backtestId)` — `app/lib/hooks/useBacktestChartSeries.ts`

Fetches per-symbol OHLC + trade overlay data for the backtest price chart.

```ts
interface BacktestOHLCBar { t: number; o: number; h: number; l: number; c: number; v: number; }
interface BacktestChartSeries { symbol: string; bars: BacktestOHLCBar[]; }
interface BacktestChartSeriesResponse { series: BacktestChartSeries[]; }

useBacktestChartSeries(strategyId: number | null, backtestId: number | null)
// Returns: { chartData, hasLoaded, isValidating, error }
```

- Key: `/api/strategies/${strategyId}/backtests/${backtestId}/chart-series` (null when either ID is null)
- `errorRetryCount: 0`, `keepPreviousData: true`, `revalidateOnFocus: false`
- `chartData` is `BacktestChartSeriesResponse | null`
- Exports the three interfaces for BE↔FE schema parity — import from this file, not redefined elsewhere

---

## Component Architecture

### `BacktestPriceChart` — `app/app/backtest/backtest-price-chart.tsx`

Candlestick price chart with trade entry/exit markers, connector lines, crosshair tooltip, and zoom-to-trade support.

**Props:**
```ts
interface BacktestPriceChartProps {
  symbol: string;
  bars: BacktestOHLCBar[];
  trades: BacktestTrade[];
  focusedTradeIndex: number | null;
  onClearFocus: () => void;
  chartRef?: RefObject<IChartApi | null>;
}
```

**Key behaviors:**
- Uses `lightweight-charts@5.2.0` via `lightweight-charts-react-wrapper@2.1.1` (TradingView OSS, MIT)
- Must be mounted via `dynamic(() => import('./backtest-price-chart'), { ssr: false })` — imports `lightweight-charts` which has no SSR support
- `CandlestickSeries` with `SeriesMarker` array: `▲ entry` (below bar, `T.gain`) + `▼ exit` (above bar, `T.gain`/`T.loss` by PnL)
- One `LineSeries` connector per trade, colored `T.gain` (PnL ≥ 0) or `T.loss`
- Crosshair tooltip: OHLC values + trade annotation (entry/exit label + PnL + exit reason) on entry/exit dates
- `focusedTradeIndex` effect: calls `chart.timeScale().setVisibleRange({ from: entry−5d, to: exit+5d })`
- "clear focus" button appears when `focusedTradeIndex !== null`
- Empty state: dashed border box when `bars.length === 0`
- Height: 240px mobile / 320px desktop (via `useBreakpoint`)

### `TerminalTable` — `app/components/atoms.tsx`

Generic table primitive used throughout the app.

**`getRowBackground` prop (added BT8, 2026-05-16):**
```ts
getRowBackground?: (rowIndex: number) => string | undefined
```
Allows callers to supply a per-row background color. Used by `backtest-view.tsx` to highlight the focused trade row.

---

## Pages Reference

### `/backtests/[id]` — `app/app/backtest/backtest-view.tsx`

Backtest result detail page. Shows metrics, trade log, and price chart.

**BT5/BT7/BT8 integration (2026-05-16):**
- `useBacktestChartSeries(strategyId, backtestId)` fetches chart data
- `focusedTradeIndex: number | null` state threads from the trade log click handler into `BacktestPriceChart`
- `BacktestPriceChart` is dynamically imported (`ssr: false`) and rendered below the trade log
- Pill-tab symbol selector: when `chartData.series.length > 1`, renders symbol tabs; selected symbol's `bars` + filtered `trades` are passed to `BacktestPriceChart`
- `getRowBackground` on `TerminalTable` highlights the focused trade row with a subtle tint

**Proxy route:** `app/app/api/strategies/[id]/backtests/[backtestId]/chart-series/route.ts` forwards the request to `GET /strategies/{id}/backtests/{backtestId}/chart-series` on the Railway backend with the user's auth token.

---

## API Proxy Pattern

All routes in `app/app/api/` forward to the Railway backend with the NextAuth session token attached as `Authorization: Bearer <token>`. The proxy layer exists so the backend URL and Railway credentials never reach the browser.
