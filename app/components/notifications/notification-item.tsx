"use client";

import Link from "next/link";
import { useT } from "@/components/theme";
import type { NotificationOut, StockDeactivatedPayload } from "./notification-types";

export interface NotificationView {
  title: string;
  body: string;
  href?: string;
}

// Per-type renderers. Adding a new notification type means: (a) extend the
// SUPPORTED_TYPES set on the backend, (b) extend StockDeactivatedPayload's
// sibling type in notification-types.ts, (c) add a case here.
function renderStockDeactivated(payload: StockDeactivatedPayload): NotificationView {
  const { symbol, reason, bots_affected, strategies_affected } = payload;
  const targets: string[] = [];
  if (bots_affected.length === 1) {
    targets.push(`bot "${bots_affected[0]!.name}"`);
  } else if (bots_affected.length > 1) {
    targets.push(`${bots_affected.length} bots`);
  }
  if (strategies_affected.length === 1) {
    targets.push(`strategy "${strategies_affected[0]!.name}"`);
  } else if (strategies_affected.length > 1) {
    targets.push(`${strategies_affected.length} strategies`);
  }
  const targetText = targets.length > 0 ? ` Removed from ${targets.join(" and ")}.` : "";
  // Deep-link priority: single bot → bot detail; single strategy → strategy
  // detail; otherwise no link (the body alone is informative enough).
  let href: string | undefined;
  if (bots_affected.length === 1) {
    href = `/bots/${bots_affected[0]!.id}`;
  } else if (strategies_affected.length === 1) {
    href = `/strategies/${strategies_affected[0]!.id}`;
  }

  return {
    title: `${symbol} no longer trades`,
    body: `${reason}.${targetText}`,
    href,
  };
}

function renderUnknown(n: NotificationOut): NotificationView {
  // Forward-compatible fallback: when the backend grows new notification
  // types ahead of the frontend, render something sensible instead of
  // crashing or rendering raw JSON.
  return {
    title: n.type.replace(/_/g, " "),
    body: "Open notifications to see details.",
  };
}

function renderNotification(n: NotificationOut): NotificationView {
  switch (n.type) {
    case "stock_deactivated":
      return renderStockDeactivated(n.payload as unknown as StockDeactivatedPayload);
    default:
      return renderUnknown(n);
  }
}

export function NotificationItem({
  notification,
  timeLabel,
  onRead,
  onNavigate,
}: {
  notification: NotificationOut;
  timeLabel: string;
  onRead: () => void;
  onNavigate?: () => void;
}) {
  const T = useT();
  const view = renderNotification(notification);
  const isUnread = notification.read_at === null;

  const inner = (
    <>
      <div
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: isUnread ? T.primaryLight : "transparent",
          marginTop: 7,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontFamily: T.fontHead,
              fontSize: 13,
              fontWeight: 600,
              color: T.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {view.title}
          </span>
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 10,
              color: T.text3,
              flexShrink: 0,
            }}
          >
            {timeLabel}
          </span>
        </div>
        <div
          style={{
            fontFamily: T.fontSans,
            fontSize: 12,
            color: T.text2,
            marginTop: 3,
            lineHeight: 1.4,
          }}
        >
          {view.body}
        </div>
      </div>
    </>
  );

  const baseStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderBottom: `1px solid ${T.outlineFaint}`,
    background: isUnread ? T.surfaceLow : "transparent",
    cursor: view.href ? "pointer" : "default",
    textDecoration: "none",
    color: "inherit",
  } as const;

  const handleClick = () => {
    if (isUnread) onRead();
    onNavigate?.();
  };

  if (view.href) {
    return (
      <Link href={view.href} onClick={handleClick} style={baseStyle}>
        {inner}
      </Link>
    );
  }
  // Without a deep link, clicking the row marks it read but doesn't navigate.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={baseStyle}
    >
      {inner}
    </div>
  );
}
