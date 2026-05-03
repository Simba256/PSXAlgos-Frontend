"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useT } from "@/components/theme";
import type { NotificationListResponse, NotificationOut } from "./notification-types";
import { NotificationItem } from "./notification-item";

const POLL_INTERVAL_MS = 60_000;
const DRAWER_LIMIT = 10;

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

export function NotificationBell({ size = 26 }: { size?: number }) {
  const T = useT();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count while signed in. Pauses while the tab is hidden so we
  // don't burn requests, then refreshes on visibility return.
  useEffect(() => {
    if (status !== "authenticated") {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { count: number };
        if (!cancelled) setUnread(body.count);
      } catch {
        // Network errors are non-fatal — keep the previous count.
      }
    };
    void fetchCount();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchCount();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  // Load drawer contents when opened (and refresh on each open — cheap, and
  // keeps the list current without cross-component coordination).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDrawerLoading(true);
    void fetch(`/api/notifications?limit=${DRAWER_LIMIT}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as NotificationListResponse;
        if (cancelled) return;
        setItems(body.items);
        setUnread(body.unread_count);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setDrawerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Click-outside + Escape to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "authenticated") return null;

  const handleItemRead = async (id: number) => {
    // Optimistic: zero out the row's read flag locally.
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // Best-effort; the next poll will reconcile.
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

  const badge = unread > 9 ? "9+" : unread > 0 ? String(unread) : null;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: T.surface3,
          color: T.text2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: open ? `1px solid ${T.primaryLight}` : `1px solid transparent`,
          cursor: "pointer",
          position: "relative",
        }}
      >
        <BellIcon size={Math.round(size * 0.55)} />
        {badge && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: T.loss,
              color: "#fff",
              fontFamily: T.fontMono,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: "16px",
              textAlign: "center",
              border: `1.5px solid ${T.surface}`,
              boxSizing: "border-box",
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxWidth: "calc(100vw - 24px)",
            background: T.surface,
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 10,
            boxShadow: `0 20px 50px -20px rgba(0,0,0,0.45)`,
            padding: 0,
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: `1px solid ${T.outlineFaint}`,
            }}
          >
            <span
              style={{
                fontFamily: T.fontHead,
                fontSize: 14,
                fontWeight: 600,
                color: T.text,
              }}
            >
              Notifications
            </span>
            <button
              type="button"
              onClick={handleReadAll}
              disabled={unread === 0}
              style={{
                fontFamily: T.fontMono,
                fontSize: 11,
                color: unread === 0 ? T.text3 : T.primaryLight,
                background: "transparent",
                border: "none",
                cursor: unread === 0 ? "default" : "pointer",
                padding: 0,
              }}
            >
              Mark all read
            </button>
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {drawerLoading && items.length === 0 && (
              <div
                style={{
                  padding: 20,
                  fontFamily: T.fontMono,
                  fontSize: 12,
                  color: T.text3,
                  textAlign: "center",
                }}
              >
                Loading…
              </div>
            )}
            {!drawerLoading && items.length === 0 && (
              <div
                style={{
                  padding: 28,
                  fontFamily: T.fontSans,
                  fontSize: 13,
                  color: T.text3,
                  textAlign: "center",
                }}
              >
                You&apos;re all caught up.
              </div>
            )}
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                timeLabel={timeSince(n.created_at)}
                onRead={() => handleItemRead(n.id)}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>

          <div
            style={{
              borderTop: `1px solid ${T.outlineFaint}`,
              padding: "10px 14px",
              textAlign: "center",
            }}
          >
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              style={{
                fontFamily: T.fontMono,
                fontSize: 12,
                color: T.primaryLight,
                textDecoration: "none",
              }}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <path d="M8 2c-2.5 0-4 1.8-4 4.5V8L3 10h10l-1-2V6.5C12 3.8 10.5 2 8 2z" />
      <path d="M6.5 12a1.6 1.6 0 003 0" />
    </svg>
  );
}
