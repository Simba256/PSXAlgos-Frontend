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

// SB1 — discriminated union mirroring `backend/app/schemas/strategy.py:343-399`.
// The leaf cases (`ConstantNode` / `IndicatorRefNode`) have the same wire
// shape as the pre-SB1 two-variant union, so older strategies still hydrate
// without a transitional read pass. Migration 058 backfilled `value_source`
// on existing leaves.
export type ArithOp = "+" | "-" | "*" | "/" | "%";
export type CmpOp = "<" | ">" | "<=" | ">=" | "==" | "!=";

export interface ConstantNode {
  type: "constant";
  value: number;
}

export interface IndicatorRefNode {
  type: "indicator";
  indicator: Indicator;
  params?: Record<string, number> | null;
}

export interface BinaryOpNode {
  type: "binary_op";
  op: ArithOp | CmpOp;
  left: ExprNode;
  right: ExprNode;
}

export interface UnaryOpNode {
  type: "unary_op";
  op: "-";
  operand: ExprNode;
}

export interface ParenNode {
  type: "paren";
  operand: ExprNode;
}

// SB8 — closed-set math helpers. Plain identifier (no `math.` namespace),
// strict NaN propagation matches Pine Script `math.*` semantics. Arity:
// `abs` exactly 1 ; `round` / `log` 1–2 ; `max` / `min` >= 2.
export type MathFnName = "abs" | "max" | "min" | "round" | "log";

export interface FunctionCallNode {
  type: "function_call";
  name: MathFnName;
  args: ExprNode[];
}

export type ExprNode =
  | ConstantNode
  | IndicatorRefNode
  | BinaryOpNode
  | UnaryOpNode
  | ParenNode
  | FunctionCallNode;

// Public alias — kept so existing callers can keep importing `ConditionValue`
// (the editor uses it widely). The backend exports the same alias for the
// same reason.
export type ConditionValue = ExprNode;

// Back-compat type aliases for any external importer that grabbed the old
// class names. Pure typing-level rename.
export type ConstantValue = ConstantNode;
export type IndicatorValue = IndicatorRefNode;

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
  // SB1 — user-authored source text for the RHS expression. Persisted so the
  // editor re-opens with exactly what the user typed (parens, whitespace).
  // Optional on the wire; backend backfills via `expression_to_source` when
  // absent. Migration 058 already populated this on existing rows.
  value_source?: string | null;
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

// ============ Rules / filters ============

export interface EntryRules {
  conditions: ConditionGroup;
}

// Post-B046 the strategy's exit rules carry only the indicator-based signal
// exit tree. Hybrid exits (Option C, 2026-05-07) reintroduce the four scalar
// guardrails as `default_risk` — strategy-level defaults that bot rows and
// backtest requests inherit when they leave their own field nullable. See
// `docs/research/EXITS_DECISION_SYNTHESIS.md` and
// `docs/EXITS_IMPLEMENTATION_PLAN.md`. Position sizing stays off-strategy.
export interface DefaultRisk {
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
  max_holding_days?: number | null;
}

export interface ExitRules {
  conditions?: ConditionGroup | null;
  default_risk?: DefaultRisk | null;
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

// Post-B046 the strategy response mirrors `StrategyBase` plus lifecycle
// metadata. Universe and risk fields no longer round-trip — the universe
// snapshot for a deployed strategy is exposed through the deploy-status
// endpoint (`scan_filters` / `scan_symbols`), not on this row.
export interface StrategyResponse {
  id: number;
  user_id: string;
  name: string;
  description?: string | null;
  entry_rules: EntryRules;
  exit_rules: ExitRules;
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

// Post-B046 the strategy carries only what defines *the rules*. Universe
// (stock_filters / stock_symbols) and risk (position_sizing / risk_management
// / max_positions) are no longer accepted on /strategies — they live on the
// bot row, the backtest request, or the deploy request.
export interface StrategyCreateBody {
  name: string;
  description?: string | null;
  entry_rules: EntryRules;
  exit_rules: ExitRules;
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

// ============ Inheritance / default-risk update flow (Phase 3+6) ============

// Names of the four scalar risk fields that participate in the inheritance
// flow. Mirrors `RISK_FIELDS` in backend `app.services.risk_inheritance`.
// Position sizing and `max_concurrent_positions` are deliberately excluded —
// they're not part of `default_risk` and never inherit.
export type RiskField =
  | "stop_loss_pct"
  | "take_profit_pct"
  | "trailing_stop_pct"
  | "max_holding_days";

export interface InheritanceWarningBot {
  id: number;
  name: string;
  // BotStatus value (`ACTIVE` / `PAUSED` / `STOPPED`). The backend filters
  // out STOPPED so this is always one of the first two in practice.
  status: string;
  // Subset of `changed_fields` that THIS bot is currently inheriting (its
  // row column is NULL on each named field). The picker only asks about
  // these — fields the bot has already overridden are silently skipped.
  inherited_fields: RiskField[];
}

export interface InheritanceWarning {
  changed_fields: RiskField[];
  // Pre-update default for the changed fields only. `null` means "no
  // default was set" — distinct from a numeric default of zero.
  old_values: Partial<Record<RiskField, number | null>>;
  new_values: Partial<Record<RiskField, number | null>>;
  affected_bots: InheritanceWarningBot[];
}

export interface ApplyDefaultRiskRequest {
  // Bots that should KEEP inheriting — their row stays NULL on the
  // changed fields, so the next signal evaluation picks up the new
  // strategy default.
  propagate_to_bot_ids: number[];
  // Bots that should be FROZEN at the OLD default — old_default_risk is
  // copied into their row for each changed field, severing future
  // inheritance.
  snapshot_bot_ids: number[];
  changed_fields: RiskField[];
  // The pre-PUT default values, captured by the editor before save and
  // forwarded so the snapshot writes the value the bot WAS running
  // under, not the value the strategy now carries.
  old_default_risk: DefaultRisk | null;
}

export interface ApplyDefaultRiskResponse {
  // == len(propagate_to_bot_ids); reported back so the UI can show
  // "N bots will pick up the new value" verbatim.
  propagated_count: number;
  // Number of bots that actually had at least one column written. May be
  // less than `len(snapshot_bot_ids)` when a bot already had an explicit
  // value on every changed field (no-op).
  snapshotted_count: number;
}

export interface StrategyUpdateResponse {
  success: boolean;
  strategy: StrategyResponse;
  // Present iff the PUT changed `default_risk` AND at least one
  // non-stopped bot was inheriting one of the changed fields. Drives
  // the per-bot inheritance picker modal — the PUT itself does NOT
  // propagate the change, the user resolves the warning by calling
  // `applyDefaultRisk` with two ID lists.
  inheritance_warnings?: InheritanceWarning;
}

// ============ Meta endpoints ============

export interface IndicatorMeta {
  indicators: Record<string, string[]>;
  operators: { value: Operator; label: string }[];
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

// Resolves the inheritance warning returned by `updateStrategy` — see
// `InheritanceWarning` and `ApplyDefaultRiskRequest`. Single round-trip,
// atomic on the backend (every snapshot lands or none do).
export async function applyDefaultRisk(
  jwt: string,
  id: number,
  body: ApplyDefaultRiskRequest,
): Promise<ApplyDefaultRiskResponse> {
  return apiFetch<ApplyDefaultRiskResponse>(
    `/strategies/${id}/apply-default-risk`,
    {
      jwt,
      method: "POST",
      body: JSON.stringify(body),
    },
  );
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

// Phase 7 — frozen snapshot of how each scalar risk field was resolved at
// run time. Persisted on `BacktestResult.run_config.effective_risk` by the
// backend's `_resolve_run_config` (backend/app/routers/strategies.py:62) via
// `risk_inheritance.EffectiveRisk.to_dict()`. The result page reads this
// instead of re-resolving against the strategy, which may have changed
// since the run.
export type EffectiveRiskSource = "explicit" | "default" | "none";

export interface EffectiveRiskResolution {
  // `null` iff source === "none" (no explicit override and no strategy
  // default — the guardrail was inactive for this run).
  value: number | null;
  source: EffectiveRiskSource;
}

export interface EffectiveRiskSnapshot {
  stop_loss_pct: EffectiveRiskResolution;
  take_profit_pct: EffectiveRiskResolution;
  trailing_stop_pct: EffectiveRiskResolution;
  max_holding_days: EffectiveRiskResolution;
}

// Subset of `BacktestResult.run_config` that the result page reads. Other
// keys (stock_filters, position_sizing, …) exist on the wire but aren't
// rendered yet — leave them untyped rather than encoding shapes the UI
// doesn't read, which would invite drift if the backend extends them.
export interface BacktestRunConfig {
  effective_risk?: EffectiveRiskSnapshot | null;
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
  // Phase 7 — frozen snapshot of the run's resolved risk guardrails plus
  // their source. Older results predating the snapshot may carry no
  // `effective_risk` block (or no `run_config` at all); the panel falls
  // back to a neutral "not recorded" state in that case.
  run_config?: BacktestRunConfig | null;
  warnings?: Array<{
    code: string;
    severity: "info" | "warning";
    message: string;
    details?: Record<string, unknown> | null;
  }> | null;
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
