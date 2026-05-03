// Mirrors app/lib/api/notifications.ts but importable from client components.
// (lib/api/* is server-only; this duplicates just the type shapes.)

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

// Concrete payload shape for type='stock_deactivated', emitted by
// backend/app/services/stock_deactivation.py::deactivate_stock.
export interface StockDeactivatedPayload {
  symbol: string;
  reason: string;
  bots_affected: { id: number; name: string }[];
  strategies_affected: { id: number; name: string }[];
}
