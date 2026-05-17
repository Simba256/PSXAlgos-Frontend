# PSX UI — Frontend

> FastAPI backend → Next.js 15 frontend. Active repo; `psx-trading-view/` is legacy.
> Last updated: 2026-05-17

---

## Directory Structure

```
app/
├── app/                   # Next.js App Router pages + API proxy routes
│   ├── api/               # Proxy routes (forward auth headers to Railway backend)
│   │   ├── market/        # Public BFF routes (no auth — market data is public)
│   │   │   ├── overview/route.ts
│   │   │   ├── indices/route.ts
│   │   │   ├── top-gainers/route.ts
│   │   │   ├── top-losers/route.ts
│   │   │   ├── most-active/route.ts
│   │   │   └── sector-performance/route.ts
│   │   └── strategies/
│   │       ├── [id]/
│   │       │   └── backtests/
│   │       │       └── [backtestId]/
│   │       │           └── chart-series/route.ts   # BT5 proxy
│   │       └── route.ts
│   ├── backtest/          # /backtests/[id] — result page, chart, trade log
│   ├── bots/              # /bots — bot management
│   ├── leaderboard/
│   ├── market/            # /market — market overview (indices, breadth, movers, sectors)
│   ├── portfolio/
│   ├── pricing/
│   ├── signals/
│   ├── strategies/        # /strategies — list + editor
│   └── watchlists/        # /watchlists — saved symbol lists (auth-gated)
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

### `useMarketOverview()` — `app/lib/hooks/use-market.ts`

Fetches market summary: total stocks, latest trading date, and breadth stats.

```ts
interface MarketBreadth {
  advancers: number; decliners: number; unchanged: number;
  advance_decline_ratio: number | null; total_volume: number;
  advancing_volume: number; declining_volume: number;
  new_highs: number; new_lows: number;
}
interface MarketOverviewResponse {
  total_stocks: number | null; latest_date: string | null;
  market_breadth: MarketBreadth | null;
}
useMarketOverview() // Returns: { data, hasLoaded, isValidating, error }
```

- SWR key: `/api/market/overview`
- `errorRetryCount: 0`, `keepPreviousData: true`, `revalidateOnFocus: false`

### `useMarketIndices(period)` — `app/lib/hooks/use-market.ts`

Fetches KSE-100, KSE-30, KMI-30 with value, change, changePercent, and sparkline points for a given period.

```ts
type Period = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y";
interface IndexResponse {
  name: string; symbol: string; value: number;
  change: number; changePercent: number; sparkline: number[]; period: string;
}
useMarketIndices(period: string) // Returns: { data: IndexResponse[] | null, hasLoaded, isValidating, error }
```

- SWR key: `/api/market/indices?period=${period}` (key changes on period switch)

### `useTopMovers(type, limit?)` — `app/lib/hooks/use-market.ts`

Fetches gainers, losers, or most-active stocks. `limit` defaults to 10.

```ts
type MoverType = "gainers" | "losers" | "most-active";
interface StockMoverResponse { symbol: string; name: string | null; sector: string | null; current_price: number; previous_price: number; volume: number | null; change_percent: number; }
interface MostActiveStockResponse { symbol: string; name: string | null; sector: string | null; current_price: number; volume: number | null; change_percent: number; }
useTopMovers(type: MoverType, limit?: number) // Returns: { data: StockMoverResponse[] | MostActiveStockResponse[] | null, hasLoaded, isValidating, error }
```

- SWR key: `/api/market/${type}?limit=${limit}`

### `useSectorPerformance()` — `app/lib/hooks/use-market.ts`

Fetches per-sector avg change, advancers/decliners counts, total volume, and stock count.

```ts
interface SectorPerformanceResponse {
  sector: string; stock_count: number; avg_change_percent: number;
  total_volume: number | null; advancers: number; decliners: number;
}
useSectorPerformance() // Returns: { data: SectorPerformanceResponse[] | null, hasLoaded, isValidating, error }
```

- SWR key: `/api/market/sector-performance`

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

### `/market` — `app/app/market/market-view.tsx`

Pakistan Stock Exchange market overview page. Statically generated (`○`) with six vertical sections:

| Section | Component | Data hook |
|---|---|---|
| Hero | `MarketHero` | `useMarketOverview`, `useMarketIndices("1D")` |
| Indices strip | `IndicesStrip` | `useMarketIndices(period)` — period toggle: 1D/1W/1M/3M/YTD/1Y |
| Market breadth | `BreadthRow` | `useMarketOverview` — advancers, decliners, A/D ratio, new highs/lows, volumes |
| Top movers | `TopMoversTabs` | `useTopMovers(type, 10)` — tabbed: Gainers / Losers / Most Active |
| Sector performance | `SectorPerformanceList` | `useSectorPerformance` — proportional bar + grid (1/2/3 cols by breakpoint) |
| Heatmap CTA | `HeatmapCta` | Static — "Coming Soon" placeholder |

**Key details:**
- Market status badge (Open/Closed/Pre-Market/After-Hours) computed client-side from PKT clock — no API call.
- KSE-100 headline value and change pulled from `useMarketIndices("1D")` in the hero.
- Each index card renders an inline SVG `Sparkline` (polyline, no chart library).
- Sector rows link to `/screener?sector=<encoded>`. Mover rows link to `/stock/<symbol>`.
- All sections use `hasLoaded`-gated skeletons and inline error states.
- Full dark-mode (Paper/Amber) and mobile-responsive via `useBreakpoint` + `PAD.page` spacing.

**Files:**
- `app/app/market/page.tsx` — RSC shell with metadata
- `app/app/market/market-view.tsx` — all UI components (client)
- `app/lib/hooks/use-market.ts` — four SWR hooks
- `app/lib/api/market.ts` — typed fetch functions + response interfaces

### `/watchlists` — `app/app/watchlists/watchlists-view.tsx`

Auth-gated page for managing saved symbol lists. Full details in the **Watchlists Page** section below.

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

## Theme System

### ThemeProvider — `app/components/theme.tsx`

Custom React context provider (no `next-themes` dependency). Wraps the entire app via `app/layout.tsx`.

- **Palettes**: `PAPER` (light, warm cream) and `AMBER` (dark, Bloomberg-style). Stored in `PALETTES: Record<Mode, Palette>`.
- **Tokens**: `useT()` returns `Tokens` — all palette values plus `fontSans`, `fontHead`, `fontMono` CSS variable references.
- **Default**: system preference via `window.matchMedia("(prefers-color-scheme: dark)")`. Falls back to `light` on SSR.
- **Persistence**: manual selection is written to `localStorage` at key `"psxalgos-theme"`. Live OS-preference updates only apply when no manual selection is stored.
- **SSR safety**: `layout.tsx` injects an inline blocking `<script>` (`themeInit`) that sets `data-theme` on `<html>` before React hydrates — eliminates the Paper→Amber flash on first paint. `ThemeProvider` reads the same key on mount.
- **CSS integration**: `globals.css` defines all design tokens as CSS custom properties under `:root` (Paper) and `[data-theme="dark"]` (Amber). Server components and plain CSS rules can consume `var(--surface)`, `var(--text)`, etc. without touching `useT()`.
- **Favicon sync**: `ThemeProvider` retargets `<link rel="icon">` to `/icon-paper.svg` or `/icon-amber.svg` on each mode change.

### ThemeToggle — `app/components/frame.tsx`

Inline pill toggle (`variant="inline"`) rendered in the desktop top nav and inside the mobile More drawer. Two buttons: "☀ Paper" / "◐ Amber". Active button has a subtle surface background; inactive is muted text.

---

## Mobile Navigation

### BottomTabBar + MoreDrawer — `app/components/frame.tsx`

On mobile viewports (`isMobile` from `useBreakpoint`), `AppFrame` renders a fixed bottom tab bar instead of a hamburger.

- **Primary tabs** (`BOTTOM_PRIMARY`): Strategies, Signals, Bots, Backtest — 4 tabs with SVG icons + labels.
- **More button**: 5th slot with a three-dot icon. Opens `MoreDrawer`.
- **MoreDrawer**: full-width bottom sheet with backdrop. Contains overflow items (`MORE_DRAWER_ITEMS`): Portfolio, Leaderboard, Notifications, Pricing. Also shows a KSE-100 ticker row and `ThemeToggle`.
- **Active state**: active tab/drawer item highlighted with `T.primaryLight` color + `fontWeight: 600`. Active pill background uses `T.primaryContainer + "22"` tint.
- **Dismiss**: tap backdrop, `Escape` key, or tapping a nav link (each `Link` calls `onClose`).
- **Safe area**: bar height is `calc(56px + env(safe-area-inset-bottom))`; `AppFrame` main content adds matching `paddingBottom` so content is never occluded.
- **Hamburger**: tablet-only (compact, non-mobile). Mobile suppresses the hamburger button entirely.

---

## Typography / Fonts

IBM Plex Sans (`--font-plex-sans`), IBM Plex Mono (`--font-plex-mono`), and Space Grotesk (`--font-space-grotesk`) are loaded via `next/font/google` in `layout.tsx` and applied as CSS variables on `<html>`. `useT()` exposes them as `fontSans`, `fontMono`, `fontHead` for inline styles.

---

## API Proxy Pattern

All routes in `app/app/api/` forward to the Railway backend with the NextAuth session token attached as `Authorization: Bearer <token>`. The proxy layer exists so the backend URL and Railway credentials never reach the browser.

---

## BFF Routes Reference

### Market BFF routes — `app/app/api/market/*/route.ts`

Public routes (no auth required — market data is not user-scoped). Each route sets `Cache-Control: public, max-age=60, stale-while-revalidate=300` and uses Next.js `next: { revalidate: 60 }` on the upstream fetch. Upstream timeout: 6 s.

| Route | Method | Upstream backend endpoint | Response type |
|---|---|---|---|
| `/api/market/overview` | GET | `GET /market/overview` | `MarketOverviewResponse` |
| `/api/market/indices` | GET | `GET /market/indices?period=` | `IndexResponse[]` |
| `/api/market/top-gainers` | GET | `GET /market/top-gainers?limit=` | `StockMoverResponse[]` |
| `/api/market/top-losers` | GET | `GET /market/top-losers?limit=` | `StockMoverResponse[]` |
| `/api/market/most-active` | GET | `GET /market/most-active?limit=` | `MostActiveStockResponse[]` |
| `/api/market/sector-performance` | GET | `GET /market/sector-performance` | `SectorPerformanceResponse[]` |

All interfaces are defined and exported from `app/lib/api/market.ts`.

### Watchlist BFF routes — `app/app/api/watchlist/*/route.ts`

Auth-required routes (NextAuth session → signed backend JWT). Upstream timeout: 8 s.

| Route | Method | Upstream backend endpoint | Notes |
|---|---|---|---|
| `/api/watchlist` | GET | `GET /watchlists` | Lists all user watchlists |
| `/api/watchlist` | POST | `POST /watchlists` | Create watchlist `{ name, symbols? }` |
| `/api/watchlist/[id]` | GET | `GET /watchlists/{id}` | Single watchlist with items |
| `/api/watchlist/[id]` | PATCH | `PATCH /watchlists/{id}` | Rename or update position |
| `/api/watchlist/[id]` | DELETE | `DELETE /watchlists/{id}` | Delete watchlist |
| `/api/watchlist/[id]/symbols` | POST | `POST /watchlists/{id}/symbols` | Add stock/index symbol |
| `/api/watchlist/[id]/symbols/[symbol]` | DELETE | `DELETE /watchlists/{id}/symbols/{symbol}` | Remove stock/index symbol |
| `/api/watchlist/[id]/sectors/[sectorId]` | DELETE | `DELETE /watchlists/{id}/sectors/{sectorId}` | Remove sector item |
| `/api/watchlist/[id]/reorder` | PUT | `PUT /watchlists/{id}/reorder` | Reorder symbols `{ symbols: string[] }` |
| `/api/watchlist/[id]/items` | POST | `POST /watchlists/{id}/items` | Add item by type (sector support) |

---

## Watchlists Page — `/watchlists`

**Files:**
- `app/app/watchlists/page.tsx` — RSC shell: auth-gates, redirects to `/?auth=required&from=/watchlists` if no session
- `app/app/watchlists/watchlists-view.tsx` — full client island
- `app/lib/hooks/use-watchlists.ts` — `useWatchlists()` + `useWatchlist(id)` SWR hooks
- `app/lib/api/watchlists.ts` — typed fetch functions + all response/body interfaces

**Layout:** sidebar (240px desktop) + main panel. Mobile: pill-chip row for list selection above the panel.

**Components in `watchlists-view.tsx`:**
- `WatchlistsView` — root client component; manages `activeId`, `toast`, all mutation handlers
- `Body` — responsive grid layout: picks sidebar vs. chip row by `isMobile`
- `WatchlistSidebar` — desktop: `WatchlistRow` list with hover-reveal up/down/rename/delete. Mobile: pill chips.
- `WatchlistRow` — single sidebar entry; inline rename input on edit; `IconBtn` controls for reorder/rename/delete
- `WatchlistTable` — `TerminalTable` with cols `["", symbol, name, type, ""]`; up/down arrows for STOCK/INDEX; remove button for all item types (calls `onRemoveSector` for SECTOR items)
- `AddSymbolInput` — plain text input (uppercase transform) + Add button; Enter to submit
- `EmptyState` — editorial layout with inline create form; shown when user has no watchlists
- `ToastBar` — 3-second flash message bar

**Hooks:**
- `useWatchlists()` — SWR on `/api/watchlist`; returns `{ data: WatchlistListResponse | undefined, hasLoaded, isValidating, error, mutate }`
- `useWatchlist(id: number | null)` — SWR on `/api/watchlist/${id}` when id non-null; same shape

**Interfaces (`app/lib/api/watchlists.ts`):**
```ts
WatchlistItemResponse  // item_type, symbol | null, name, sector_id | null, position
WatchlistResponse      // watchlist_id, name, position, items, symbols, created_at
WatchlistListResponse  // watchlists, total
WatchlistMutationResponse // success, watchlist_id?, watchlist?, message?, symbol?
```
