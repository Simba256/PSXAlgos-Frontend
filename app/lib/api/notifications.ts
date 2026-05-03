// Backend /notifications wrappers + types. Mirrors backend/app/schemas/notification.py.
// Server-only — invoked from Next.js route handlers under app/api/notifications/.
// The browser hits those Next routes, not this module directly.

import { apiFetch } from "./client";

export interface NotificationOut {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  items: NotificationOut[];
  next_cursor: string | null;
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface ListParams {
  unread_only?: boolean;
  limit?: number;
  cursor?: string;
}

function buildQuery(params: object | undefined): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function listNotifications(
  jwt: string,
  params?: ListParams,
): Promise<NotificationListResponse> {
  return apiFetch<NotificationListResponse>(
    `/notifications${buildQuery(params)}`,
    { jwt },
  );
}

export async function getUnreadCount(
  jwt: string,
): Promise<UnreadCountResponse> {
  return apiFetch<UnreadCountResponse>(`/notifications/unread-count`, { jwt });
}

export async function markRead(jwt: string, id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/notifications/${id}/read`, {
    jwt,
    method: "POST",
  });
}

export async function markAllRead(
  jwt: string,
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(`/notifications/read-all`, {
    jwt,
    method: "POST",
  });
}
