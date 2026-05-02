// Backend /strategy-signals wrappers + types. Types match Pydantic shapes
// in psxDataPortal/backend/app/schemas/signal.py. Decimals are serialized as
// strings by Pydantic v2 — wrappers cast them on the way out.

import { apiFetch } from "./client"
import type { StockFilters } from "./strategies"

// Pydantic Decimals come over the wire as strings (or numbers, depending on
// FastAPI config). Both narrow to `string | number` after JSON parsing.
type Decimal = string | number

export type SignalType = "BUY" | "SELL"
export type SignalStatus = "PENDING" | "ACTED" | "IGNORED" | "EXPIRED"

export interface StrategySignal {
  id: number
  strategy_id: number
  symbol: string
  signal_type: SignalType
  signal_date: string // ISO date "YYYY-MM-DD"
  trigger_price: Decimal
  stop_loss: Decimal | null
  take_profit: Decimal | null
  trigger_data: Record<string, number> | null
  status: SignalStatus
  acted_at: string | null
  created_at: string | null
}

export interface StrategySignalGroup {
  strategy_id: number
  strategy_name: string
  signals: StrategySignal[]
}

export interface TodaySignalsResponse {
  date: string
  groups: StrategySignalGroup[]
  total_signals: number
}

export async function getTodaySignals(jwt: string): Promise<TodaySignalsResponse> {
  return apiFetch<TodaySignalsResponse>(`/strategy-signals/today`, { jwt })
}

export async function updateSignalStatus(
  jwt: string,
  signalId: number,
  status: "ACTED" | "IGNORED",
): Promise<{ message: string; id: number }> {
  return apiFetch<{ message: string; id: number }>(
    `/strategy-signals/${signalId}/status`,
    {
      jwt,
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json" },
    },
  )
}

// ── B047 deploy + undeploy ──────────────────────────────────────────

// Mirrors backend DeployRequest (psxDataPortal/backend/app/schemas/signal.py).
// Both fields optional. NULL/NULL deploy → scanner produces zero signals.
export interface DeployRequest {
  stock_filters?: StockFilters | null
  stock_symbols?: string[] | null
}

// Mirrors backend DeployResponse — strategy fields after the deploy lands.
export interface DeployResponse {
  id: number
  is_deployed: boolean
  deployed_at: string | null
  scan_filters: StockFilters | null
  scan_symbols: string[] | null
}

export async function deployStrategy(
  jwt: string,
  strategyId: number,
  body?: DeployRequest,
): Promise<DeployResponse> {
  return apiFetch<DeployResponse>(
    `/strategy-signals/strategies/${strategyId}/deploy`,
    {
      jwt,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    },
  )
}

export async function undeployStrategy(
  jwt: string,
  strategyId: number,
): Promise<DeployResponse> {
  return apiFetch<DeployResponse>(
    `/strategy-signals/strategies/${strategyId}/undeploy`,
    { jwt, method: "POST" },
  )
}
