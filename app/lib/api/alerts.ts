export type AlertCondition = "ABOVE" | "BELOW" | "CROSSES_ABOVE" | "CROSSES_BELOW";

export interface AlertResponse {
  alert_id: number;
  symbol: string;
  stock_name: string | null;
  condition: AlertCondition;
  target_price: number;
  current_price: number | null;
  is_enabled: boolean;
  is_triggered: boolean;
  trigger_count: number;
  note: string | null;
  created_at: string | null;
  triggered_at: string | null;
}

export interface AlertListResponse {
  alerts: AlertResponse[];
  total: number;
}

export interface CreateAlertRequest {
  symbol: string;
  condition: AlertCondition;
  target_price: number;
  note?: string;
}

export interface CreateAlertResponse {
  success: boolean;
  alert_id: number;
  symbol: string;
  condition: AlertCondition;
  target_price: number;
  current_price: number | null;
}

export interface DeleteAlertResponse {
  success: boolean;
  message: string;
}

export interface ToggleAlertResponse {
  success: boolean;
  alert_id: number;
  is_enabled: boolean;
}

export interface AlertHistoryItem {
  history_id: number;
  alert_id: number;
  symbol: string;
  stock_name: string | null;
  condition: AlertCondition;
  target_price: number;
  triggered_price: number;
  triggered_at: string | null;
}

export interface AlertHistoryResponse {
  history: AlertHistoryItem[];
  total: number;
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

export async function fetchAlerts(): Promise<AlertListResponse> {
  return apiFetch<AlertListResponse>("/api/alerts");
}

export async function createAlert(body: CreateAlertRequest): Promise<CreateAlertResponse> {
  return apiFetch<CreateAlertResponse>("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteAlert(alertId: number): Promise<DeleteAlertResponse> {
  return apiFetch<DeleteAlertResponse>(`/api/alerts/${alertId}`, { method: "DELETE" });
}

export async function toggleAlert(alertId: number): Promise<ToggleAlertResponse> {
  return apiFetch<ToggleAlertResponse>(`/api/alerts/${alertId}/toggle`, { method: "PATCH" });
}

export async function fetchAlertHistory(limit = 50): Promise<AlertHistoryResponse> {
  return apiFetch<AlertHistoryResponse>(`/api/alerts/history/triggered?limit=${limit}`);
}
