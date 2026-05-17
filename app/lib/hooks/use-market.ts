"use client";

import useSWR from "swr";
import {
  fetchMarketOverview,
  fetchMarketIndices,
  fetchTopGainers,
  fetchTopLosers,
  fetchMostActive,
  fetchSectorPerformance,
  type MarketOverviewResponse,
  type IndexResponse,
  type StockMoverResponse,
  type MostActiveStockResponse,
  type SectorPerformanceResponse,
} from "@/lib/api/market";

const SWR_CONFIG = {
  errorRetryCount: 0,
  keepPreviousData: true,
  revalidateOnFocus: false,
} as const;

export interface UseMarketOverviewResult {
  data: MarketOverviewResponse | null;
  hasLoaded: boolean;
  isValidating: boolean;
  error: Error | undefined;
}

export function useMarketOverview(): UseMarketOverviewResult {
  const { data, error, isValidating } = useSWR(
    "/api/market/overview",
    () => fetchMarketOverview(),
    SWR_CONFIG,
  );
  return {
    data: data ?? null,
    hasLoaded: data !== undefined || error !== undefined,
    isValidating,
    error,
  };
}

export interface UseMarketIndicesResult {
  data: IndexResponse[] | null;
  hasLoaded: boolean;
  isValidating: boolean;
  error: Error | undefined;
}

export function useMarketIndices(period: string): UseMarketIndicesResult {
  const { data, error, isValidating } = useSWR(
    `/api/market/indices?period=${period}`,
    () => fetchMarketIndices(period),
    SWR_CONFIG,
  );
  return {
    data: data ?? null,
    hasLoaded: data !== undefined || error !== undefined,
    isValidating,
    error,
  };
}

export type MoverType = "gainers" | "losers" | "most-active";

export interface UseTopMoversResult {
  data: StockMoverResponse[] | MostActiveStockResponse[] | null;
  hasLoaded: boolean;
  isValidating: boolean;
  error: Error | undefined;
}

export function useTopMovers(type: MoverType, limit = 10): UseTopMoversResult {
  const fetcher = () => {
    if (type === "gainers") return fetchTopGainers(limit);
    if (type === "losers") return fetchTopLosers(limit);
    return fetchMostActive(limit);
  };

  const { data, error, isValidating } = useSWR(
    `/api/market/${type}?limit=${limit}`,
    fetcher,
    SWR_CONFIG,
  );
  return {
    data: data ?? null,
    hasLoaded: data !== undefined || error !== undefined,
    isValidating,
    error,
  };
}

export interface UseSectorPerformanceResult {
  data: SectorPerformanceResponse[] | null;
  hasLoaded: boolean;
  isValidating: boolean;
  error: Error | undefined;
}

export function useSectorPerformance(): UseSectorPerformanceResult {
  const { data, error, isValidating } = useSWR(
    "/api/market/sector-performance",
    () => fetchSectorPerformance(),
    SWR_CONFIG,
  );
  return {
    data: data ?? null,
    hasLoaded: data !== undefined || error !== undefined,
    isValidating,
    error,
  };
}
