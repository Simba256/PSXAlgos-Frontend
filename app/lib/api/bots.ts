// Backend /bots wrappers + types. Mirrors backend/app/schemas/bot.py.
// Decimals come over the wire as strings/numbers; consumers cast to Number.

import { apiFetch } from "./client";

type Decimal = string | number;

export type BotStatus = "ACTIVE" | "PAUSED" | "STOPPED";
export type BotAction = "start" | "pause" | "stop";
export type PositionStatus = "OPEN" | "CLOSED";

export interface BotResponse {
  id: number;
  user_id: string;
  strategy_id: number;
  name: string;
  allocated_capital: Decimal;
  available_cash: Decimal;
  max_positions: number;
  status: BotStatus;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  last_run_at?: string | null;
  stopped_at?: string | null;

  strategy_name?: string | null;
  total_equity?: Decimal | null;
  total_return_pct?: Decimal | null;
  open_positions_count?: number | null;
  total_trades?: number | null;
}

export interface BotDetailResponse extends BotResponse {
  daily_pnl?: Decimal | null;
  daily_return_pct?: Decimal | null;
  drawdown_pct?: Decimal | null;
  winning_trades?: number | null;
  losing_trades?: number | null;
  win_rate?: Decimal | null;
}

export interface BotListResponse {
  items: BotResponse[];
  total: number;
}

export interface PositionResponse {
  id: number;
  bot_id: number;
  stock_id: number;
  symbol: string;
  quantity: number;
  entry_price: Decimal;
  entry_date: string;
  stop_loss_price?: Decimal | null;
  take_profit_price?: Decimal | null;
  trailing_stop_price?: Decimal | null;
  highest_price_since_entry?: Decimal | null;
  max_exit_date?: string | null;
  current_price?: Decimal | null;
  unrealized_pnl?: Decimal | null;
  unrealized_pnl_pct?: Decimal | null;
  status: PositionStatus;
  closed_at?: string | null;
  created_at?: string | null;
  market_value?: Decimal | null;
  days_held?: number | null;
}

export interface PositionListResponse {
  items: PositionResponse[];
  total: number;
}

export interface TradeResponse {
  id: number;
  bot_id: number;
  position_id?: number | null;
  stock_id: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: Decimal;
  total_value: Decimal;
  trade_date: string;
  exit_reason?: string | null;
  pnl?: Decimal | null;
  pnl_pct?: Decimal | null;
  holding_days?: number | null;
  executed_at?: string | null;
}

export interface TradeListResponse {
  items: TradeResponse[];
  total: number;
}

export interface PerformanceSnapshot {
  id: number;
  bot_id: number;
  snapshot_date: string;
  total_equity: Decimal;
  cash_balance: Decimal;
  positions_value: Decimal;
  daily_pnl?: Decimal | null;
  daily_return_pct?: Decimal | null;
  total_return_pct?: Decimal | null;
  drawdown_pct?: Decimal | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  created_at?: string | null;
}

export interface PerformanceResponse {
  bot_id: number;
  total_equity: Decimal;
  total_return_pct?: Decimal | null;
  max_drawdown?: Decimal | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate?: Decimal | null;
  equity_curve: PerformanceSnapshot[];
}

export interface BotCreateBody {
  strategy_id: number;
  name: string;
  allocated_capital: number;
  max_positions?: number;
}

export interface BotUpdateBody {
  name?: string;
  max_positions?: number;
}

export interface BotActionResponse {
  success: boolean;
  message: string;
  bot?: BotResponse | null;
}

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

export async function getBots(jwt: string): Promise<BotListResponse> {
  return apiFetch<BotListResponse>(`/bots`, { jwt });
}

export async function getBot(jwt: string, id: number): Promise<BotDetailResponse> {
  return apiFetch<BotDetailResponse>(`/bots/${id}`, { jwt });
}

export async function createBot(jwt: string, body: BotCreateBody): Promise<BotResponse> {
  return apiFetch<BotResponse>(`/bots`, {
    jwt,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateBot(jwt: string, id: number, body: BotUpdateBody): Promise<BotResponse> {
  return apiFetch<BotResponse>(`/bots/${id}`, {
    jwt,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteBot(jwt: string, id: number): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/bots/${id}`, { jwt, method: "DELETE" });
}

export async function botAction(
  jwt: string,
  id: number,
  action: BotAction,
): Promise<BotActionResponse> {
  return apiFetch<BotActionResponse>(`/bots/${id}/${action}`, {
    jwt,
    method: "POST",
  });
}

export async function getBotPositions(
  jwt: string,
  id: number,
  status?: PositionStatus,
): Promise<PositionListResponse> {
  return apiFetch<PositionListResponse>(`/bots/${id}/positions${buildQuery({ status })}`, { jwt });
}

export async function getBotTrades(
  jwt: string,
  id: number,
  params?: { limit?: number; offset?: number },
): Promise<TradeListResponse> {
  return apiFetch<TradeListResponse>(`/bots/${id}/trades${buildQuery(params)}`, { jwt });
}

export async function getBotPerformance(
  jwt: string,
  id: number,
  days = 30,
): Promise<PerformanceResponse> {
  return apiFetch<PerformanceResponse>(`/bots/${id}/performance?days=${days}`, { jwt });
}
