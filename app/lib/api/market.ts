// Typed client functions for market BFF routes.

export interface MarketBreadth {
  advancers: number;
  decliners: number;
  unchanged: number;
  advance_decline_ratio: number | null;
  total_volume: number;
  advancing_volume: number;
  declining_volume: number;
  new_highs: number;
  new_lows: number;
}

export interface MarketOverviewResponse {
  total_stocks: number | null;
  latest_date: string | null;
  market_breadth: MarketBreadth | null;
}

export interface StockMoverResponse {
  symbol: string;
  name: string | null;
  sector: string | null;
  current_price: number;
  previous_price: number;
  volume: number | null;
  change_percent: number;
}

export interface MostActiveStockResponse {
  symbol: string;
  name: string | null;
  sector: string | null;
  current_price: number;
  volume: number | null;
  change_percent: number;
}

export interface IndexResponse {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  sparkline: number[];
  period: string;
}

export interface SectorPerformanceResponse {
  sector: string;
  stock_count: number;
  avg_change_percent: number;
  total_volume: number | null;
  advancers: number;
  decliners: number;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchMarketOverview(): Promise<MarketOverviewResponse> {
  return apiFetch<MarketOverviewResponse>("/api/market/overview");
}

export function fetchMarketIndices(period: string): Promise<IndexResponse[]> {
  return apiFetch<IndexResponse[]>(`/api/market/indices?period=${encodeURIComponent(period)}`);
}

export function fetchTopGainers(limit = 10): Promise<StockMoverResponse[]> {
  return apiFetch<StockMoverResponse[]>(`/api/market/top-gainers?limit=${limit}`);
}

export function fetchTopLosers(limit = 10): Promise<StockMoverResponse[]> {
  return apiFetch<StockMoverResponse[]>(`/api/market/top-losers?limit=${limit}`);
}

export function fetchMostActive(limit = 10): Promise<MostActiveStockResponse[]> {
  return apiFetch<MostActiveStockResponse[]>(`/api/market/most-active?limit=${limit}`);
}

export function fetchSectorPerformance(): Promise<SectorPerformanceResponse[]> {
  return apiFetch<SectorPerformanceResponse[]>("/api/market/sector-performance");
}
