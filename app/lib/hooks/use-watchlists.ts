"use client";

import useSWR from "swr";
import {
  fetchWatchlists,
  fetchWatchlist,
  type WatchlistListResponse,
  type WatchlistResponse,
} from "@/lib/api/watchlists";
import { getAllStocksClient, type StockResponse } from "@/lib/api/stocks";

const SWR_CONFIG = {
  errorRetryCount: 0,
  keepPreviousData: true,
  revalidateOnFocus: false,
} as const;

export interface UseWatchlistsResult {
  data: WatchlistListResponse | null;
  hasLoaded: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useWatchlists(): UseWatchlistsResult {
  const { data, error, isValidating, mutate } = useSWR(
    "/api/watchlist",
    () => fetchWatchlists(),
    SWR_CONFIG,
  );
  return {
    data: data ?? null,
    hasLoaded: data !== undefined || error !== undefined,
    isValidating,
    error,
    mutate,
  };
}

export interface UseWatchlistResult {
  data: WatchlistResponse | null;
  hasLoaded: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useWatchlist(id: number | null): UseWatchlistResult {
  const { data, error, isValidating, mutate } = useSWR(
    id !== null ? `/api/watchlist/${id}` : null,
    () => fetchWatchlist(id!),
    SWR_CONFIG,
  );
  return {
    data: data ?? null,
    hasLoaded: data !== undefined || error !== undefined,
    isValidating,
    error,
    mutate,
  };
}

// symbol → { last_close, last_change_pct } lookup built from the full stock list.
// Reuses the same /api/stocks proxy. Cached by SWR key for 5 min (matches proxy TTL).
export type StockPriceMap = Record<string, Pick<StockResponse, "last_close" | "last_change_pct">>;

export interface UseStockPriceMapResult {
  priceMap: StockPriceMap;
  hasLoaded: boolean;
}

export function useStockPriceMap(): UseStockPriceMapResult {
  const { data } = useSWR<StockResponse[]>(
    "/api/stocks?all=1",
    () => getAllStocksClient(),
    { ...SWR_CONFIG, dedupingInterval: 300_000 },
  );
  const priceMap: StockPriceMap = {};
  if (data) {
    for (const s of data) {
      priceMap[s.symbol] = {
        last_close: s.last_close ?? null,
        last_change_pct: s.last_change_pct ?? null,
      };
    }
  }
  return {
    priceMap,
    hasLoaded: data !== undefined,
  };
}
