"use client";

import { useEffect, useState } from "react";

// Minimal sessionStorage hook. Mirrors the localStorage pattern in
// theme.tsx but scoped to a single tab/window — perfect for backtest form
// drafts, expanded-section state, and other UI scratch that should not
// pollute the URL or persist across sessions.
//
// SSR-safe: returns the initial value on the server; reads storage on
// mount. We never write the initial value back unless the user actually
// changes it, so a stale storage value can't be clobbered by an unmodified
// re-render.
export function useSessionStorage<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* corrupted entry — fall through to initial */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode — silently drop */
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}
