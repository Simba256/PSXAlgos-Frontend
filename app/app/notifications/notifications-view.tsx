"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { EditorialHeader } from "@/components/atoms";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import { NotificationItem } from "@/components/notifications/notification-item";
import type {
  NotificationListResponse,
  NotificationOut,
} from "@/components/notifications/notification-types";

const PAGE_SIZE = 20;

function timeSince(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsView({ initial }: { initial: NotificationListResponse }) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  const [items, setItems] = useState<NotificationOut[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.next_cursor);
  const [unread, setUnread] = useState<number>(initial.unread_count);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refetch when the unread-only toggle changes (we discard the existing list).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (unreadOnly) params.set("unread_only", "true");
    void fetch(`/api/notifications?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as NotificationListResponse;
        if (cancelled) return;
        setItems(body.items);
        setCursor(body.next_cursor);
        setUnread(body.unread_count);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unreadOnly]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        cursor,
      });
      if (unreadOnly) params.set("unread_only", "true");
      const res = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as NotificationListResponse;
      setItems((prev) => [...prev, ...body.items]);
      setCursor(body.next_cursor);
      setUnread(body.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, unreadOnly]);

  const handleRead = async (id: number) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // tolerated; next refresh reconciles
    }
  };

  const handleReadAll = async () => {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // ignore
    }
  };

  return (
    <AppFrame route="/notifications">
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <EditorialHeader
          kicker="Activity · alerts and platform events"
          title="Notifications"
          meta={
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
              {unread} unread · {items.length} loaded
            </span>
          }
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setUnreadOnly((v) => !v)}
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: unreadOnly ? T.primaryLight : "transparent",
                  color: unreadOnly ? "#fff" : T.text2,
                  border: `1px solid ${unreadOnly ? T.primaryLight : T.outlineFaint}`,
                  cursor: "pointer",
                }}
              >
                Unread only
              </button>
              <button
                type="button"
                onClick={handleReadAll}
                disabled={unread === 0}
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "transparent",
                  color: unread === 0 ? T.text3 : T.primaryLight,
                  border: `1px solid ${T.outlineFaint}`,
                  cursor: unread === 0 ? "default" : "pointer",
                }}
              >
                Mark all read
              </button>
            </div>
          }
        />

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `12px ${padX} 28px`,
              desktop: `20px ${padX} 40px`,
            }),
          }}
        >
          {error && (
            <div
              style={{
                padding: 16,
                marginBottom: 16,
                background: T.surface2,
                border: `1px solid ${T.loss}`,
                borderRadius: 8,
                fontFamily: T.fontMono,
                fontSize: 12,
                color: T.loss,
              }}
            >
              Failed to load: {error}
            </div>
          )}

          {items.length === 0 && !loading && (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                fontFamily: T.fontSans,
                fontSize: 14,
                color: T.text3,
              }}
            >
              {unreadOnly ? "No unread notifications." : "You don't have any notifications yet."}
            </div>
          )}

          {items.length > 0 && (
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.outlineFaint}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  timeLabel={timeSince(n.created_at)}
                  onRead={() => handleRead(n.id)}
                />
              ))}
            </div>
          )}

          {cursor && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 12,
                  padding: "10px 24px",
                  borderRadius: 999,
                  background: "transparent",
                  color: T.primaryLight,
                  border: `1px solid ${T.outlineFaint}`,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
