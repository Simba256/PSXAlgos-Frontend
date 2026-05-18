"use client";

import useSWR from "swr";
import {
  fetchAlerts,
  fetchAlertHistory,
  createAlert,
  deleteAlert,
  toggleAlert,
  type AlertResponse,
  type AlertHistoryItem,
  type CreateAlertRequest,
} from "@/lib/api/alerts";

const SWR_CONFIG = {
  errorRetryCount: 0,
  keepPreviousData: true,
  revalidateOnFocus: false,
} as const;

export interface UseAlertsResult {
  alerts: AlertResponse[];
  history: AlertHistoryItem[];
  error: Error | undefined;
  isLoading: boolean;
  hasLoaded: boolean;
  isValidating: boolean;
  create: (body: CreateAlertRequest) => Promise<void>;
  toggle: (alertId: number) => Promise<void>;
  remove: (alertId: number) => Promise<void>;
}

export function useAlerts(): UseAlertsResult {
  const {
    data: alertsData,
    error: alertsError,
    isValidating: alertsValidating,
    mutate: mutateAlerts,
  } = useSWR("/api/alerts", fetchAlerts, SWR_CONFIG);

  const {
    data: historyData,
    error: historyError,
    isValidating: historyValidating,
    mutate: mutateHistory,
  } = useSWR("/api/alerts/history/triggered", () => fetchAlertHistory(50), SWR_CONFIG);

  const error = alertsError ?? historyError;
  const isLoading = alertsData === undefined || historyData === undefined;
  const hasLoaded = alertsData !== undefined && historyData !== undefined;
  const isValidating = alertsValidating || historyValidating;

  async function create(body: CreateAlertRequest): Promise<void> {
    await createAlert(body);
    await mutateAlerts();
  }

  async function toggle(alertId: number): Promise<void> {
    await toggleAlert(alertId);
    await mutateAlerts();
  }

  async function remove(alertId: number): Promise<void> {
    await deleteAlert(alertId);
    await mutateAlerts();
  }

  return {
    alerts: alertsData?.alerts ?? [],
    history: historyData?.history ?? [],
    error,
    isLoading,
    hasLoaded,
    isValidating,
    create,
    toggle,
    remove,
  };
}
