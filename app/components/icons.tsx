"use client";

import type { ReactElement } from "react";

// Every icon below is decorative — meaning coming through adjacent text or the
// enclosing button's aria-label. aria-hidden keeps SVG content out of the
// accessibility tree so screen readers don't announce raw path data.
const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round" } as const;
const ariaHide = { "aria-hidden": true, focusable: false } as const;

export const Icon: Record<string, ReactElement> = {
  plus: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.6">
      <path d="M6 2v8M2 6h8" />
    </svg>
  ),
  play: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" {...ariaHide}>
      <path d="M3 2l6 3.5L3 9V2z" />
    </svg>
  ),
  pause: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" {...ariaHide}>
      <rect x="3" y="2" width="2" height="7" rx="0.5" />
      <rect x="6" y="2" width="2" height="7" rx="0.5" />
    </svg>
  ),
  stop: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" {...ariaHide}>
      <rect x="2" y="2" width="6" height="6" rx="0.5" />
    </svg>
  ),
  chev: (
    <svg width="10" height="10" viewBox="0 0 10 10" {...stroke} {...ariaHide} strokeWidth="1.6">
      <path d="M3 2l4 3-4 3" />
    </svg>
  ),
  arrowR: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.4">
      <path d="M2 6h8m-3-3l3 3-3 3" />
    </svg>
  ),
  search: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.4">
      <circle cx="5" cy="5" r="3.2" />
      <path d="M7.5 7.5L10 10" />
    </svg>
  ),
  more: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" {...ariaHide}>
      <circle cx="3" cy="7" r="1" />
      <circle cx="7" cy="7" r="1" />
      <circle cx="11" cy="7" r="1" />
    </svg>
  ),
  close: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.5">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  ),
  check: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M2 6.5L5 9.5 10.5 3" />
    </svg>
  ),
  tree: (
    <svg width="13" height="13" viewBox="0 0 13 13" {...stroke} {...ariaHide} strokeWidth="1.4">
      <circle cx="3" cy="3" r="1.3" />
      <circle cx="3" cy="10" r="1.3" />
      <circle cx="10" cy="6.5" r="1.3" />
      <path d="M4.3 3h2.4c1 0 2 1 2 2v1M4.3 10h2.4c1 0 2-1 2-2V7" />
    </svg>
  ),
  bot: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...stroke} {...ariaHide} strokeWidth="1.3">
      <rect x="2" y="4.5" width="10" height="7" rx="1.5" />
      <circle cx="5" cy="8" r="0.9" />
      <circle cx="9" cy="8" r="0.9" />
      <path d="M7 2v2.5M5 11.5v1M9 11.5v1" />
    </svg>
  ),
  spark: (
    <svg width="13" height="13" viewBox="0 0 13 13" {...stroke} {...ariaHide} strokeWidth="1.3">
      <path d="M6.5 1.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3L2 6l3.3-1.2z" />
    </svg>
  ),
  warn: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.4">
      <path d="M6 1.5l5 9H1l5-9z M6 5v2.5 M6 9v.1" />
    </svg>
  ),
  zoom: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.4">
      <path d="M2 6h8 M6 2v8" />
    </svg>
  ),
  zoomOut: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.4">
      <path d="M2 6h8" />
    </svg>
  ),
  fit: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.4">
      <path d="M2 4V2h2M10 4V2H8M2 8v2h2M10 8v2H8" />
    </svg>
  ),
  target: (
    <svg width="13" height="13" viewBox="0 0 13 13" {...stroke} {...ariaHide} strokeWidth="1.3">
      <circle cx="6.5" cy="6.5" r="5" />
      <circle cx="6.5" cy="6.5" r="2.3" />
      <circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  shield: (
    <svg width="13" height="13" viewBox="0 0 13 13" {...stroke} {...ariaHide} strokeWidth="1.3" strokeLinejoin="round">
      <path d="M6.5 1l4.5 2v4c0 2.5-2 4.5-4.5 5.5C4 11.5 2 9.5 2 7V3l4.5-2z" />
    </svg>
  ),
  info: (
    <svg width="12" height="12" viewBox="0 0 12 12" {...stroke} {...ariaHide} strokeWidth="1.3">
      <circle cx="6" cy="6" r="4.7" />
      <path d="M6 5.3v2.9" strokeWidth="1.5" />
      <circle cx="6" cy="3.7" r="0.45" fill="currentColor" stroke="none" />
    </svg>
  ),
};
