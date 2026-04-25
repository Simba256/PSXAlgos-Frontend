// Backend /portfolio (trade journal) wrappers + types. Mirrors Pydantic
// shapes in psxDataPortal/backend/app/schemas/portfolio.py.
//
// The journal model: users log real-broker trades. Open positions live as
// rows; closing one migrates it to a closed-trade row with server-computed
// pnl/return. Every scaled-in entry is its own position (multi-lot model).

import { apiFetch } from "./client";

// Pydantic serializes Decimal as a string in JSON; the frontend sometimes
// needs to do math on them, so accept either shape.
type Decimal = string | number;

// ============ Enums (mirror schemas/portfolio.py) ============

export type JournalSource = "SIGNAL" | "MANUAL";
export type JournalCloseReason = "STOP_LOSS" | "TARGET_HIT" | "MANUAL_CLOSE";

// ============ Response shapes ============

export interface OpenPositionResponse {
  id: number;
  symbol: string;
  stock_name?: string | null;
  quantity: number;
  entry_price: Decimal;
  // Latest close from eod_prices — null if no price data for this symbol yet.
  current_price?: Decimal | null;
  stop_price?: Decimal | null;
  target_price?: Decimal | null;
  source: JournalSource;
  strategy_name?: string | null;
  opened_at: string;
}

export interface OpenPositionListResponse {
  positions: OpenPositionResponse[];
  total: number;
}

export interface ClosedTradeResponse {
  id: number;
  symbol: string;
  stock_name?: string | null;
  quantity: number;
  entry_price: Decimal;
  exit_price: Decimal;
  pnl: Decimal;
  return_pct: Decimal;
  source: JournalSource;
  strategy_name?: string | null;
  close_reason: JournalCloseReason;
  opened_at: string;
  closed_at: string;
}

export interface ClosedTradeListResponse {
  trades: ClosedTradeResponse[];
  total: number;
}

export interface JournalSummaryResponse {
  open_count: number;
  closed_count: number;
  total_unrealized_pnl: Decimal;
  total_realized_pnl: Decimal;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

// ============ Request bodies ============

export interface OpenPositionCreateBody {
  symbol: string;
  quantity: number;
  entry_price: number;
  stop_price?: number | null;
  target_price?: number | null;
  source?: JournalSource;
  strategy_name?: string | null;
  // ISO 8601; server defaults to now if omitted.
  opened_at?: string | null;
}

// Only annotations are editable post-open. qty/entry/symbol are immutable.
export interface OpenPositionUpdateBody {
  stop_price?: number | null;
  target_price?: number | null;
  strategy_name?: string | null;
}

export interface ClosePositionBody {
  exit_price: number;
  close_reason?: JournalCloseReason;
  closed_at?: string | null;
}

// ============ Wrappers ============

export async function getJournalSummary(jwt: string): Promise<JournalSummaryResponse> {
  return apiFetch<JournalSummaryResponse>(`/portfolio/summary`, { jwt });
}

export async function getOpenPositions(jwt: string): Promise<OpenPositionListResponse> {
  return apiFetch<OpenPositionListResponse>(`/portfolio/positions`, { jwt });
}

export async function createOpenPosition(
  jwt: string,
  body: OpenPositionCreateBody,
): Promise<OpenPositionResponse> {
  return apiFetch<OpenPositionResponse>(`/portfolio/positions`, {
    jwt,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateOpenPosition(
  jwt: string,
  id: number,
  body: OpenPositionUpdateBody,
): Promise<OpenPositionResponse> {
  return apiFetch<OpenPositionResponse>(`/portfolio/positions/${id}`, {
    jwt,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteOpenPosition(
  jwt: string,
  id: number,
): Promise<DeleteResponse> {
  return apiFetch<DeleteResponse>(`/portfolio/positions/${id}`, {
    jwt,
    method: "DELETE",
  });
}

export async function closeOpenPosition(
  jwt: string,
  id: number,
  body: ClosePositionBody,
): Promise<ClosedTradeResponse> {
  return apiFetch<ClosedTradeResponse>(`/portfolio/positions/${id}/close`, {
    jwt,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getClosedTrades(
  jwt: string,
  params?: { limit?: number },
): Promise<ClosedTradeListResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  const q = search.toString();
  return apiFetch<ClosedTradeListResponse>(
    `/portfolio/trades${q ? `?${q}` : ""}`,
    { jwt },
  );
}

export async function deleteClosedTrade(
  jwt: string,
  id: number,
): Promise<DeleteResponse> {
  return apiFetch<DeleteResponse>(`/portfolio/trades/${id}`, {
    jwt,
    method: "DELETE",
  });
}
