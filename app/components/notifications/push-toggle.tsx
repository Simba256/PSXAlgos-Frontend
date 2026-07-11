"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/theme";
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "./push-client";

// Enable/disable browser push notifications. Renders nothing while state
// is unknown or when push is unsupported (old browser, no VAPID keys, or
// iOS Safari outside an installed PWA).
export function PushToggle() {
  const T = useT();
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPushState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading" || state === "unsupported") return null;

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next =
        state === "subscribed"
          ? await unsubscribeFromPush()
          : await subscribeToPush();
      setState(next);
    } catch (err) {
      console.warn("[push] toggle failed", err);
      // Re-derive from the browser so the label never lies.
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  if (state === "denied") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.text3,
        }}
      >
        <PushIcon size={13} color={T.text3} />
        Push blocked in browser settings
      </div>
    );
  }

  const on = state === "subscribed";
  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={busy}
      aria-pressed={on}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: T.fontMono,
        fontSize: 11,
        padding: "5px 10px",
        borderRadius: 999,
        background: on ? T.surface3 : "transparent",
        color: on ? T.text2 : T.primaryLight,
        border: `1px solid ${on ? T.outlineFaint : T.primaryLight}`,
        cursor: busy ? "wait" : "pointer",
      }}
    >
      <PushIcon size={13} color={on ? T.text2 : T.primaryLight} />
      {busy ? "Working…" : on ? "Push on — disable" : "Enable push"}
    </button>
  );
}

function PushIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <path d="M8 2c-2.5 0-4 1.8-4 4.5V8L3 10h10l-1-2V6.5C12 3.8 10.5 2 8 2z" />
      <path d="M6.5 12a1.6 1.6 0 003 0" />
      <path d="M12.5 2.5c1 .9 1.6 2 1.8 3.2M3.5 2.5c-1 .9-1.6 2-1.8 3.2" />
    </svg>
  );
}
