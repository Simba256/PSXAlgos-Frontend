"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "./theme";

// Segmented control with sliding active pill. Used for mode switches
// where 2-5 mutually-exclusive options swap downstream content (e.g.
// universe mode: All / Sectors / Tickers).
//
// The pill is absolutely positioned and animated via transform — adjacent
// segments don't move, so layout never shifts under the user's pointer.
// Body content cross-fade is the caller's responsibility (typically a
// `key={value}` swap with `psx-fade-in` keyframe).

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** Optional sub-text rendered as a small mono caption under the label. */
  hint?: string;
}

// useLayoutEffect is the right hook here because we measure DOM
// post-render to position the pill before the first paint. Falls back to
// useEffect on the server to silence SSR warnings.
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const T = useT();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Map<V, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useIso(() => {
    const btn = refs.current.get(value);
    const track = trackRef.current;
    if (!btn || !track) return;
    const trackBox = track.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    setPill({ x: btnBox.left - trackBox.left, w: btnBox.width });
  }, [value, options.length]);

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className="psx-segmented-track"
    >
      {pill && (
        <span
          className="psx-segmented-pill"
          style={{
            transform: `translateX(${pill.x - 3}px)`,
            width: pill.w,
          }}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) refs.current.set(opt.value, el);
              else refs.current.delete(opt.value);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(opt.value);
            }}
            className="psx-press"
            style={{
              position: "relative",
              zIndex: 1,
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: "5px 12px",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.55 : 1,
              color: active ? T.text : T.text2,
              fontFamily: T.fontSans,
              fontSize: 12.5,
              fontWeight: active ? 500 : 400,
              letterSpacing: 0.2,
              transition: "color 200ms cubic-bezier(0.23, 1, 0.32, 1)",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              minWidth: 0,
              whiteSpace: "nowrap",
            }}
          >
            <span>{opt.label}</span>
            {opt.hint && (
              <span
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 10,
                  color: T.text3,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                · {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
