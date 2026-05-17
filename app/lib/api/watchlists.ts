// Typed client for watchlist BFF routes.
// All routes are auth-gated — the BFF forwards a signed JWT to the backend.

export interface WatchlistItemResponse {
  item_type: "STOCK" | "INDEX" | "SECTOR";
  symbol: string | null;
  name: string;
  sector_id: number | null;
  position: number;
}

export interface WatchlistResponse {
  watchlist_id: number;
  name: string;
  position: number;
  items: WatchlistItemResponse[];
  symbols: string[];
  created_at: string;
}

export interface WatchlistListResponse {
  watchlists: WatchlistResponse[];
  total: number;
}

export interface CreateWatchlistBody {
  name: string;
  symbols?: string[];
}

export interface UpdateWatchlistBody {
  name?: string;
  symbols?: string[];
  position?: number;
}

export interface AddSymbolBody {
  symbol: string;
}

export interface ReorderBody {
  symbols: string[];
}

export interface WatchlistMutationResponse {
  success: boolean;
  watchlist_id?: number;
  watchlist?: WatchlistResponse;
  message?: string;
  symbol?: string;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function fetchWatchlists(): Promise<WatchlistListResponse> {
  return apiFetch<WatchlistListResponse>("/api/watchlist");
}

export function fetchWatchlist(id: number): Promise<WatchlistResponse> {
  return apiFetch<WatchlistResponse>(`/api/watchlist/${id}`);
}

export function createWatchlist(body: CreateWatchlistBody): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>("/api/watchlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateWatchlist(
  id: number,
  body: UpdateWatchlistBody,
): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>(`/api/watchlist/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteWatchlist(id: number): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>(`/api/watchlist/${id}`, {
    method: "DELETE",
  });
}

export function addSymbol(
  id: number,
  body: AddSymbolBody,
): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>(`/api/watchlist/${id}/symbols`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function removeSymbol(
  id: number,
  symbol: string,
): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>(
    `/api/watchlist/${id}/symbols/${encodeURIComponent(symbol)}`,
    { method: "DELETE" },
  );
}

export function removeSector(
  id: number,
  sectorId: number,
): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>(
    `/api/watchlist/${id}/sectors/${sectorId}`,
    { method: "DELETE" },
  );
}

export function reorderSymbols(
  id: number,
  body: ReorderBody,
): Promise<WatchlistMutationResponse> {
  return apiFetch<WatchlistMutationResponse>(`/api/watchlist/${id}/reorder`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
