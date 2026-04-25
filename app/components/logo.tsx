"use client";

import { useT } from "./theme";

// α signed: the Greek alpha (also the "a" of Algos, and finance's term for
// excess return) anchors the mark. A small 2-node graph signature in the
// lower-right encodes the product's node-based strategy editor. The α owns
// legibility at 16px; the signature rewards a closer look at 28px+.
//
// Theme-reactive via T.primary (badge) and T.surface (glyph). Flips
// automatically between Paper and Amber.
export function LogoMark({ size = 28, radius = 6 }: { size?: number; radius?: number }) {
  const T = useT();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={radius} fill={T.primary} />
      <text
        x="12"
        y="22"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="22"
        fontWeight="600"
        fill={T.surface}
      >
        α
      </text>
      {/* Node-graph signature — lower-right */}
      <circle cx="21.5" cy="20" r="1.3" fill={T.surface} />
      <circle cx="24.5" cy="23" r="1.3" fill={T.surface} />
      <line x1="21.5" y1="20" x2="24.5" y2="23" stroke={T.surface} strokeWidth="0.7" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  const T = useT();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: T.fontHead,
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: -0.3,
        }}
      >
        PSX Algos
      </span>
    </span>
  );
}
