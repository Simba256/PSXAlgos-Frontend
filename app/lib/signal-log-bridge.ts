"use client";

// Cross-page bridge for trades logged from /signals that should
// appear in /portfolio. Backed by localStorage so navigation between
// pages (which unmounts React state) preserves the handoff.
//
// Portfolio drains the queue on mount and merges into its positions
// state. This is a one-shot queue: once drained, entries are cleared.

const KEY = "psx:portfolio:pending-signal-trades";

export type TradeSource = "signal" | "manual";

export interface PendingPosition {
  sym: string;
  qty: number;
  entry: number;
  now: number;
  source: TradeSource;
  strat: string | null;
  date: string;
  stop: number;
  target: number;
}

export function enqueueSignalTrade(p: PendingPosition): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: PendingPosition[] = raw ? JSON.parse(raw) : [];
    list.push(p);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — drop silently */
  }
}

export function drainSignalTrades(): PendingPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    window.localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingPosition[]) : [];
  } catch {
    return [];
  }
}
