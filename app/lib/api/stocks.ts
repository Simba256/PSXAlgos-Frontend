// Backend /stocks wrappers + types. Mirrors Pydantic shapes in
// psxDataPortal/backend/app/schemas/stock.py.
//
// /stocks is a public endpoint (no auth). The list is small (~500 PSX
// tickers) and cached server-side with a 5-minute TTL — cheap to fetch
// in full once on page load and filter client-side.
//
// 2026-05-12 — Routes through the same-origin Next proxy at /api/stocks
// (app/api/stocks/route.ts) because callers like the deploy modal in
// editor-view.tsx are client components, and the browser cannot hit the
// Railway backend directly (CORS allowlist doesn't include the Vercel
// host). The proxy works from both server and client contexts; in the
// browser it's a same-origin fetch, on the server Next resolves the
// relative URL against the request's origin.

export interface StockResponse {
  id: number;
  symbol: string;
  name?: string | null;
  sector_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_close?: number | null;
  last_close_date?: string | null;
  last_change_pct?: number | null;
}

export interface StockListResponse {
  items: StockResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// In the browser, use the same-origin Next proxy (/api/stocks) so CORS
// doesn't block the request. On the server, skip the proxy entirely and
// call the backend directly — avoids a wasted Vercel→Vercel hop.
function stocksUrl(query: string): string {
  if (typeof window !== "undefined") return `/api/stocks${query}`;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set — cannot reach the backend",
    );
  }
  return `${base}/stocks${query}`;
}

export async function getStocksPage(
  page: number,
  pageSize: number,
): Promise<StockListResponse> {
  const url = stocksUrl(
    `?page=${page}&page_size=${pageSize}&active_only=true`,
  );
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Match the proxy's revalidate window so the page cache and Next's
    // fetch cache stay aligned.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Failed to load stocks (${res.status})`);
  }
  return (await res.json()) as StockListResponse;
}

// Browser-safe: always hits the same-origin /api/stocks proxy.
// Used by client components that need the full stock list + price snapshot.
async function getStocksPageClient(
  page: number,
  pageSize: number,
): Promise<StockListResponse> {
  const res = await fetch(
    `/api/stocks?page=${page}&page_size=${pageSize}&active_only=true`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Failed to load stocks (${res.status})`);
  return (await res.json()) as StockListResponse;
}

export async function getAllStocksClient(): Promise<StockResponse[]> {
  const PAGE_SIZE = 100;
  const first = await getStocksPageClient(1, PAGE_SIZE);
  if (first.total_pages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: first.total_pages - 1 }, (_, i) =>
      getStocksPageClient(i + 2, PAGE_SIZE),
    ),
  );
  return [...first.items, ...rest.flatMap((r) => r.items)];
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
