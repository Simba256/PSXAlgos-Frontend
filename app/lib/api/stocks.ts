// Backend /stocks wrappers + types. Mirrors Pydantic shapes in
// psxDataPortal/backend/app/schemas/stock.py.
//
// /stocks is a public endpoint (no auth). The list is small (~500 PSX
// tickers) and cached server-side with a 5-minute TTL — cheap to fetch
// in full once on page load and filter client-side.

import { apiFetch } from "./client";

export interface StockResponse {
  id: number;
  symbol: string;
  name?: string | null;
  sector_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StockListResponse {
  items: StockResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getStocksPage(
  page: number,
  pageSize: number,
): Promise<StockListResponse> {
  return apiFetch<StockListResponse>(
    `/stocks?page=${page}&page_size=${pageSize}&active_only=true`,
    { next: { revalidate: 300 } },
  );
}

// Fetch every active stock by walking pages in parallel after the first.
// Backend caps page_size at 100 (backend/app/routers/stocks.py:27), so the
// PSX universe takes ~5 pages. Total payload is small (~50KB).
export async function getAllStocks(): Promise<StockResponse[]> {
  const PAGE_SIZE = 100;
  const first = await getStocksPage(1, PAGE_SIZE);
  if (first.total_pages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: first.total_pages - 1 }, (_, i) =>
      getStocksPage(i + 2, PAGE_SIZE),
    ),
  );
  return [...first.items, ...rest.flatMap((r) => r.items)];
}
