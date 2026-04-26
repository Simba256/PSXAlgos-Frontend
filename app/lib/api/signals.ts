// Backend /strategy-signals wrappers + types. Types match Pydantic shapes
// in psxDataPortal/backend/app/schemas/signal.py. Decimals are serialized as
// strings by Pydantic v2 — wrappers cast them on the way out.

import { apiFetch } from "./client"

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
