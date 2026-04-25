// Backend /signals wrappers + types. Types match Pydantic shapes in
// psxDataPortal/backend/app/schemas/signal.py. Decimals are serialized as
// strings by Pydantic v2 — wrappers cast them on the way out.

import { apiFetch } from "./client"

// Pydantic Decimals come over the wire as strings (or numbers, depending on
// FastAPI config). Both narrow to `string | number` after JSON parsing.
type Decimal = string | number

export interface TradingSignalWithSymbol {
  symbol: string
  stock_name?: string | null
  signal_date: string // ISO date "YYYY-MM-DD"
  signal_type: string // BUY | SELL | HOLD
  strength_score: Decimal
  strength_label?: string | null
  confidence: Decimal
  time_horizon?: string | null
  horizon_days?: number | null
  entry_price?: Decimal | null
  stop_loss?: Decimal | null
  target_price?: Decimal | null
  risk_reward_ratio?: Decimal | null
  rsi_value?: Decimal | null
  macd_value?: Decimal | null
}

export interface SignalListResponse {
  items: TradingSignalWithSymbol[]
  total: number
  filters_applied?: Record<string, unknown> | null
}

export interface TopOpportunityResponse {
  symbol: string
  stock_name?: string | null
  sector?: string | null
  signal_type: string
  strength_score: Decimal
  strength_label: string
  confidence: Decimal
  time_horizon: string
  entry_price: Decimal
  stop_loss: Decimal
  target_price: Decimal
  risk_reward_ratio: Decimal
  potential_return: Decimal
  signal_date: string
}

export interface SignalSummary {
  total_signals: number
  buy_signals: number
  sell_signals: number
  hold_signals: number
  very_strong_count: number
  strong_count: number
  moderate_count: number
  weak_count: number
  avg_confidence: Decimal
  day_trade_count: number
  swing_trade_count: number
  position_trade_count: number
}

export interface SignalsListParams {
  signal_type?: "BUY" | "SELL"
  min_strength?: number
  min_confidence?: number
  time_horizon?: string
  active_only?: boolean
  limit?: number
}

function buildQuery(params: object | undefined): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ""
}

export async function getSignals(
  jwt: string,
  params?: SignalsListParams,
): Promise<SignalListResponse> {
  return apiFetch<SignalListResponse>(`/signals${buildQuery(params)}`, { jwt })
}

export async function getTopOpportunities(
  jwt: string,
  params?: { signal_type?: "BUY" | "SELL"; limit?: number },
): Promise<TopOpportunityResponse[]> {
  return apiFetch<TopOpportunityResponse[]>(
    `/signals/top-opportunities${buildQuery(params)}`,
    { jwt },
  )
}

export async function getSignalsSummary(jwt: string): Promise<SignalSummary> {
  return apiFetch<SignalSummary>(`/signals/summary`, { jwt })
}
