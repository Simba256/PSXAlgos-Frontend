"use client";

import { useSyncExternalStore } from "react";

export const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
} as const;

export type Breakpoint = "mobile" | "tablet" | "desktop";

function resolve(width: number): Breakpoint {
  if (width < BREAKPOINTS.mobile) return "mobile";
  if (width < BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}

// Single module-level store replaces the prior per-consumer resize + orientation
// listeners (28 sites each mounting their own). One listener, N subscribers.
type Listener = () => void;
const listeners = new Set<Listener>();
let currentWidth = 0;

function emit() {
  for (const l of listeners) l();
}

function attach() {
  if (typeof window === "undefined") return;
  currentWidth = window.innerWidth;
  const onResize = () => {
    const next = window.innerWidth;
    if (next === currentWidth) return;
    currentWidth = next;
    emit();
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
}

function detach() {
  // Listeners are process-lifetime on the client; the store never tears down.
  // Kept as a no-op so the shape mirrors a typical external-store module.
}

let attached = false;
function subscribe(listener: Listener): Listener {
  if (!attached && typeof window !== "undefined") {
    attach();
    attached = true;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

function getSnapshot(): number {
  return currentWidth;
}

// Mobile-first SSR default. A width of 0 resolves to "mobile" via the same
// resolve() used on the client, so the first paint on mobile doesn't reflow
// from a desktop layout. Desktop first paints get one micro-correction when
// useSyncExternalStore reads the real width on hydration.
function getServerSnapshot(): number {
  return 0;
}

export function useBreakpoint(): {
  bp: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  hydrated: boolean;
} {
  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const bp = resolve(width);
  return {
    bp,
    isMobile: bp === "mobile",
    isTablet: bp === "tablet",
    isDesktop: bp === "desktop",
    width,
    hydrated: width > 0,
  };
}

type Value<T> = { mobile?: T; tablet?: T; desktop: T };

export function pick<T>(bp: Breakpoint, v: Value<T>): T {
  if (bp === "mobile") return v.mobile ?? v.tablet ?? v.desktop;
  if (bp === "tablet") return v.tablet ?? v.desktop;
  return v.desktop;
}

export const PAD = {
  page: { mobile: "16px", tablet: "28px", desktop: "40px" },
  pageMarketing: { mobile: "18px", tablet: "32px", desktop: "48px" },
} as const;

export function clampPx(min: number, preferredVw: number, max: number): string {
  return `clamp(${min}px, ${preferredVw}vw, ${max}px)`;
}
