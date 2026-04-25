// Backend /portfolio wrappers. Mirrors backend/app/schemas/portfolio.py +
// inline schemas in backend/app/routers/portfolio.py.
//
// NOTE on semantics: the backend's /portfolio is a paper-trading account
// (place market orders, executes against latest price, tracks PnL). The
// frontend's /portfolio page is currently a personal-trade *journal*
// (log trades you made elsewhere, kept in local CSV). Until the product
// resolves which model wins, this client only exposes the read surface and
// the safe write paths. The journal UI continues to operate on local state.

import { apiFetch } from "./client";

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type OrderStatus =
  | "PENDING"
  | "FILLED"
  | "PARTIALLY_FILLED"
  | "CANCELLED"
  | "REJECTED";

export interface PortfolioSummaryPosition {
  // Backend's PortfolioSummary.positions field is `list` (untyped) — shape is
  // determined by services/paper_trading.py at runtime. Treat as opaque
  // until the contract is locked.
  [key: string]: unknown;
}

export interface PortfolioSummary {
  portfolio_id: number;
  user_id: string;
  initial_balance: number;
  cash_balance: number;
  positions_value: number;
  total_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  positions: PortfolioSummaryPosition[];
  created_at?: string | null;
}

export interface OrderItem {
  order_id: number;
  symbol: string;
  stock_name: string;
  side: string;
  order_type: string;
  quantity: number;
  filled_quantity: number;
  limit_price?: number | null;
  status: string;
  rejection_reason?: string | null;
  created_at?: string | null;
}

export interface OrderListResponse {
  orders: OrderItem[];
  total: number;
}

export interface TradeItem {
  trade_id: number;
  order_id: number;
  symbol: string;
  stock_name: string;
  side: string;
  quantity: number;
  price: number;
  total_value: number;
  trade_date: string;
  executed_at?: string | null;
}

export interface TradeListResponse {
  trades: TradeItem[];
  total: number;
}

export interface PlaceOrderBody {
  symbol: string;
  side: OrderSide;
  quantity: number;
  order_type?: OrderType;
  limit_price?: number | null;
}

export interface PlaceOrderResponse {
  success: boolean;
  order_id?: number | null;
  trade_id?: number | null;
  symbol?: string | null;
  side?: string | null;
  quantity?: number | null;
  price?: number | null;
  total_value?: number | null;
  cash_balance?: number | null;
  error?: string | null;
}

export async function getPortfolioSummary(jwt: string): Promise<PortfolioSummary> {
  return apiFetch<PortfolioSummary>(`/portfolio/summary`, { jwt });
}

export async function getOrders(
  jwt: string,
  params?: { status?: OrderStatus; limit?: number },
): Promise<OrderListResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  const q = search.toString();
  return apiFetch<OrderListResponse>(`/portfolio/orders${q ? `?${q}` : ""}`, { jwt });
}

export async function getTrades(
  jwt: string,
  params?: { limit?: number },
): Promise<TradeListResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  const q = search.toString();
  return apiFetch<TradeListResponse>(`/portfolio/trades${q ? `?${q}` : ""}`, { jwt });
}

export async function placeOrder(
  jwt: string,
  body: PlaceOrderBody,
): Promise<PlaceOrderResponse> {
  return apiFetch<PlaceOrderResponse>(`/portfolio/orders`, {
    jwt,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resetPortfolio(jwt: string): Promise<{ success: boolean; message: string; cash_balance: number }> {
  return apiFetch(`/portfolio/reset`, { jwt, method: "POST" });
}

export async function addFunds(
  jwt: string,
  amount: number,
): Promise<{ success: boolean; message: string; cash_balance: number; initial_balance: number }> {
  return apiFetch(`/portfolio/add-funds`, {
    jwt,
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}
