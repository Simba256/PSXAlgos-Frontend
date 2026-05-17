"use client";

import useSWR from "swr";

export interface BacktestOHLCBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BacktestChartSeries {
  symbol: string;
  bars: BacktestOHLCBar[];
}

export interface BacktestChartSeriesResponse {
  series: BacktestChartSeries[];
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useBacktestChartSeries(
  strategyId: number | null,
  backtestId: number | null,
) {
  const key =
    strategyId && backtestId
      ? `/api/strategies/${strategyId}/backtests/${backtestId}/chart-series`
      : null;

  const { data, error, isLoading, isValidating } = useSWR(
    key,
    fetcher<BacktestChartSeriesResponse>,
    {
      errorRetryCount: 0,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  return {
    chartData: data ?? null,
    hasLoaded: !isLoading,
    isValidating,
    error: error as Error | null,
  };
}
