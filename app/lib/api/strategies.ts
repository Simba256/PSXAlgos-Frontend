// Backend /strategies wrappers + types. Types match Pydantic shapes in
// psxDataPortal/backend/app/schemas/strategy.py.
//
// Phase 3.2 wires the *list* read path only; create/update/delete + the
// `/meta/*` endpoints are typed here (cheap to do once, expensive to do
// piecemeal later) but the wizard and editor wiring lands in a follow-up.

import { apiFetch } from "./client";

// ============ Enums (mirror schemas/strategy.py) ============

export type StrategyStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type TradingMode = "BACKTEST_ONLY" | "DEMO_TRADING";

export type Operator =
  | ">"
  | ">="
  | "<"
  | "<="
  | "=="
  | "crosses_above"
  | "crosses_below";

export type ConditionLogic = "AND" | "OR";

export type PositionSizingType =
  | "fixed_percent"
  | "fixed_amount"
  | "risk_based"
  | "equal_weight";

// Keep `Indicator` as a string. The backend's enum is large and the frontend
// renders whatever the rules contain — narrowing it here adds no safety and
// invites drift if the backend extends the list.
export type Indicator = string;

// Bar resolution a condition evaluates against. Mirrors backend's Timeframe
// enum (schemas/strategy.py). Daily, weekly and monthly are evaluated
// end-to-end. Intraday (5m–4h) are reserved on the wire — the editor
// renders them as locked chips ("coming soon") until PSX intraday history
// is deep enough to backtest against. The 1m bucket was dropped once the
// editor settled on 5m as the floor. Default on the wire is "1D".
export type Timeframe = "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1M";

// ============ Condition shapes ============

export interface ConstantValue {
  type: "constant";
  value: number;
}

export interface IndicatorValue {
  type: "indicator";
  indicator: Indicator;
}

export type ConditionValue = ConstantValue | IndicatorValue;

// Wire shape for the recursive condition tree (STRATEGY_TREE_PLAN.md). After
// Phase A the backend stores every node with its `kind` discriminator and
// `ConditionGroup.conditions` may itself contain groups — so the type is a
// recursive discriminated union. The editor's in-memory representation in
// `lib/strategy/tree.ts` wraps each node with a stable client-side ID for
// React keys / selection, but only the wire shape below is sent on the wire.
export interface SingleCondition {
  kind: "condition";
  indicator: Indicator;
  operator: Operator;
  value: ConditionValue;
  // Bar resolution this condition evaluates on. Optional on the wire —
  // backend defaults to "1D" when absent so existing strategies stay valid.
  // Only "1D" is accepted today; other values fail backend validation until
  // intraday evaluation lands.
  timeframe?: Timeframe;
  params?: Record<string, number> | null;
}

export interface ConditionGroup {
  kind: "group";
  logic: ConditionLogic;
  conditions: Array<SingleCondition | ConditionGroup>;
}

// ============ Rules / sizing / risk / filters ============

export interface EntryRules {
  conditions: ConditionGroup;
}

export interface ExitRules {
  conditions?: ConditionGroup | null;
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
  max_holding_days?: number | null;
}

export interface PositionSizing {
  type: PositionSizingType;
  value: number;
  max_position_size_pct: number;
}

export interface RiskManagement {
  max_daily_loss_pct?: number | null;
  max_portfolio_risk_pct?: number | null;
  stop_trading_drawdown_pct?: number | null;
}

export interface StockFilters {
  sectors?: string[] | null;
  min_price?: number | null;
  max_price?: number | null;
  min_volume?: number | null;
  min_market_cap?: number | null;
}

// ============ Response / request shapes ============

// Lightweight summary of a strategy's most recent backtest, embedded by
// the list endpoint (`GET /strategies`) via a single LEFT JOIN. Single-
// strategy GETs leave this null — fetch detail via `getBacktestResult`.
export interface LatestBacktestSummary {
  id: number;
  total_return_pct: Decimal;
  sharpe_ratio: Decimal | null;
  max_drawdown: Decimal | null;
  total_trades: number;
  win_rate: Decimal | null;
  completed_at: string;
}

export interface StrategyResponse {
  id: number;
  user_id: string;
  name: string;
  description?: string | null;
  entry_rules: EntryRules;
  exit_rules: ExitRules;
  position_sizing: PositionSizing;
  risk_management?: RiskManagement | null;
  stock_filters?: StockFilters | null;
  stock_symbols?: string[] | null;
  max_positions: number;
  status: StrategyStatus;
  trading_mode: TradingMode;
  created_at?: string | null;
  updated_at?: string | null;
  // Last time the signal scanner ran this strategy. Null until the strategy
  // has been deployed and scanned at least once. Powers the "last scan" chip.
  last_scan_at?: string | null;
  latest_backtest?: LatestBacktestSummary | null;
  // Number of strategy_signals rows whose signal_date is today (PKT).
  // Populated by the list endpoint via JOIN; defaults to 0 elsewhere.
  signals_today?: number;
  // Number of non-STOPPED bots that reference this strategy. Populated by
  // the list endpoint via JOIN; defaults to 0 elsewhere.
  bots_count?: number;
}

export interface StrategyListResponse {
  items: StrategyResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StrategyListParams {
  page?: number;
  page_size?: number;
  status_filter?: StrategyStatus;
}

export interface StrategyCreateBody {
  name: string;
  description?: string | null;
  entry_rules: EntryRules;
  exit_rules: ExitRules;
  position_sizing: PositionSizing;
  risk_management?: RiskManagement | null;
  stock_filters?: StockFilters | null;
  stock_symbols?: string[] | null;
  max_positions?: number;
}

export type StrategyUpdateBody = Partial<StrategyCreateBody> & {
  status?: StrategyStatus;
  trading_mode?: TradingMode;
};

export interface StrategyCreateResponse {
  success: boolean;
  strategy_id: number;
  strategy: StrategyResponse;
}

export interface StrategyUpdateResponse {
  success: boolean;
  strategy: StrategyResponse;
}

// ============ Meta endpoints ============

export interface IndicatorMeta {
  indicators: Record<string, string[]>;
  operators: { value: Operator; label: string }[];
  position_sizing_types: { value: PositionSizingType; label: string }[];
}

export interface DataRangeResponse {
  price_data: { min_date: string | null; max_date: string | null; trading_days: number };
  indicator_data: { min_date: string | null; max_date: string | null };
  usable_range: { min_date: string | null; max_date: string | null };
  stock_count: number | null;
  filtered: boolean;
}

// ============ Helpers ============

function buildQuery(params: object | undefined): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

// ============ Wrappers ============

export async function getStrategies(
  jwt: string,
  params?: StrategyListParams,
): Promise<StrategyListResponse> {
  return apiFetch<StrategyListResponse>(`/strategies${buildQuery(params)}`, { jwt });
}

export async function getStrategy(
  jwt: string,
  id: number,
): Promise<StrategyResponse> {
  return apiFetch<StrategyResponse>(`/strategies/${id}`, { jwt });
}

export async function createStrategy(
  jwt: string,
  body: StrategyCreateBody,
): Promise<StrategyCreateResponse> {
  return apiFetch<StrategyCreateResponse>(`/strategies`, {
    jwt,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateStrategy(
  jwt: string,
  id: number,
  body: StrategyUpdateBody,
): Promise<StrategyUpdateResponse> {
  return apiFetch<StrategyUpdateResponse>(`/strategies/${id}`, {
    jwt,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteStrategy(
  jwt: string,
  id: number,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/strategies/${id}`, {
    jwt,
    method: "DELETE",
  });
}

export interface StrategyDependentBot {
  id: number;
  name: string;
  status: "ACTIVE" | "PAUSED" | "STOPPED";
}

export interface StrategyDependentsResponse {
  items: StrategyDependentBot[];
  total: number;
  // Number of items whose status is not STOPPED — these are the bots that
  // would block a delete (B2) or be impacted by a strategy edit.
  blocking: number;
}

export async function getStrategyDependents(
  jwt: string,
  id: number,
): Promise<StrategyDependentsResponse> {
  return apiFetch<StrategyDependentsResponse>(`/strategies/${id}/bots`, { jwt });
}

export async function getIndicatorMeta(): Promise<IndicatorMeta> {
  // Public endpoint — cache for an hour, the indicator list rarely changes.
  return apiFetch<IndicatorMeta>(`/strategies/meta/indicators`, {
    next: { revalidate: 3600 },
  });
}

export async function getDataRange(
  params?: { symbols?: string; sectors?: string },
): Promise<DataRangeResponse> {
  return apiFetch<DataRangeResponse>(
    `/strategies/meta/data-range${buildQuery(params)}`,
    { next: { revalidate: 3600 } },
  );
}

// ============ Backtest types + wrappers ============

type Decimal = string | number;

export interface BacktestEquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  daily_return?: number | null;
}

export interface BacktestTrade {
  symbol: string;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  quantity: number;
  side: string;
  pnl: number;
  pnl_pct: number;
  exit_reason: string;
  holding_days: number;
}

export interface BacktestResultResponse {
  id: number;
  strategy_id: number;
  start_date: string;
  end_date: string;
  initial_capital: Decimal;
  final_equity: Decimal;
  total_return_pct: Decimal;
  cagr?: Decimal | null;
  sharpe_ratio?: Decimal | null;
  sortino_ratio?: Decimal | null;
  max_drawdown?: Decimal | null;
  max_drawdown_duration?: number | null;
  volatility?: Decimal | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate?: Decimal | null;
  profit_factor?: Decimal | null;
  avg_trade_return?: Decimal | null;
  avg_win?: Decimal | null;
  avg_loss?: Decimal | null;
  largest_win?: Decimal | null;
  largest_loss?: Decimal | null;
  avg_holding_days?: Decimal | null;
  equity_curve?: BacktestEquityPoint[] | null;
  trades?: BacktestTrade[] | null;
  created_at?: string | null;
}

export interface BacktestSummary {
  id: number;
  strategy_id: number;
  start_date: string;
  end_date: string;
  initial_capital: Decimal;
  final_equity: Decimal;
  total_return_pct: Decimal;
  sharpe_ratio?: Decimal | null;
  max_drawdown?: Decimal | null;
  total_trades: number;
  win_rate?: Decimal | null;
  created_at?: string | null;
}

export interface BacktestListResponse {
  items: BacktestSummary[];
  total: number;
}

// Same shape as BacktestSummary plus the parent strategy's name —
// returned by GET /strategies/runs (cross-strategy run history). The
// `strategy_name` JOIN saves an N+1 fetch on the /backtest index page.
export interface BacktestRunRow extends BacktestSummary {
  strategy_name: string;
}

export interface BacktestRunListResponse {
  items: BacktestRunRow[];
  total: number;
}

export interface BacktestRequestBody {
  start_date: string; // YYYY-MM-DD
  end_date: string;
  initial_capital?: number;

  // B045 — universe + risk overrides for this run. Each is optional; the
  // backend persists the resolved snapshot in BacktestResult.run_config.
  stock_filters?: StockFilters | null;
  stock_symbols?: string[] | null;
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
  max_holding_days?: number | null;
  max_positions?: number | null;
}

export interface BacktestJobPending {
  job_id: string;
  status: "pending";
  message: string;
}

export interface BacktestJobStatus {
  status: "pending" | "running" | "completed" | "failed";
  strategy_id: number;
  job_id?: string | null;
  backtest_id?: number | null;
  total_return_pct?: number | null;
  total_trades?: number | null;
  error?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
}

export async function startBacktest(
  jwt: string,
  strategyId: number,
  body: BacktestRequestBody,
): Promise<BacktestJobPending | BacktestResultResponse> {
  return apiFetch(`/strategies/${strategyId}/backtest?async_mode=true`, {
    jwt,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getBacktestJob(
  jwt: string,
  strategyId: number,
  jobId: string,
): Promise<BacktestJobStatus> {
  return apiFetch<BacktestJobStatus>(
    `/strategies/${strategyId}/backtest/job/${jobId}`,
    { jwt },
  );
}

export async function listBacktests(
  jwt: string,
  strategyId: number,
  limit = 20,
): Promise<BacktestListResponse> {
  return apiFetch<BacktestListResponse>(
    `/strategies/${strategyId}/backtests?limit=${limit}`,
    { jwt },
  );
}

// Cross-strategy run history. Powers the /backtest index page.
export async function listAllBacktestRuns(
  jwt: string,
  limit = 50,
): Promise<BacktestRunListResponse> {
  return apiFetch<BacktestRunListResponse>(
    `/strategies/runs?limit=${limit}`,
    { jwt },
  );
}

export async function getBacktestResult(
  jwt: string,
  strategyId: number,
  backtestId: number,
): Promise<BacktestResultResponse> {
  return apiFetch<BacktestResultResponse>(
    `/strategies/${strategyId}/backtests/${backtestId}`,
    { jwt },
  );
}
