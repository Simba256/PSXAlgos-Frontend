"use client";

import { useT } from "./theme";

type VariantProps = { size?: number; radius?: number };

// All variants share: 28x28 viewBox, rounded-square badge in T.primary,
// inner marks in T.surface. Keeps them directly comparable.

function Badge({ size = 28, radius = 6, children }: VariantProps & { children: React.ReactNode }) {
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
      <g fill={T.surface} stroke={T.surface}>{children}</g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// NODE-GRAPH FAMILY
// ──────────────────────────────────────────────────────────────────────────

// V1: current — two outlined-style (filled) pills + curved arc between them
export function V1_CurrentArc(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <rect x="4.5" y="7" width="9" height="5.5" rx="1.75" fill={T.surface} />
      <rect x="14.5" y="15.5" width="9" height="5.5" rx="1.75" fill={T.surface} />
      <path d="M 13.5 9.75 Q 16 14 14.5 18.25" stroke={T.surface} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </Badge>
  );
}

// V2: bolder — two solid filled pills + straight diagonal line
export function V2_BoldDiag(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <rect x="4" y="5.5" width="10" height="6" rx="2" fill={T.surface} />
      <rect x="14" y="16.5" width="10" height="6" rx="2" fill={T.surface} />
      <line x1="14" y1="11.5" x2="14" y2="16.5" stroke={T.surface} strokeWidth="1.6" strokeLinecap="round" />
    </Badge>
  );
}

// V3: three-node fan — mirrors the hero diagram (COND + COND → AND → OUT)
export function V3_ThreeNodeFan(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <rect x="3.5" y="4.5" width="8" height="4.5" rx="1.5" fill={T.surface} />
      <rect x="3.5" y="19" width="8" height="4.5" rx="1.5" fill={T.surface} />
      <rect x="16.5" y="11.75" width="8" height="4.5" rx="1.5" fill={T.surface} />
      <path d="M 11.5 6.75 Q 15 10 16.5 14 M 11.5 21.25 Q 15 18 16.5 14" stroke={T.surface} strokeWidth="1" fill="none" strokeLinecap="round" />
    </Badge>
  );
}

// V4: L-connector / flowchart — right-angle elbow
export function V4_Flowchart(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <rect x="4" y="5.5" width="9" height="6" rx="1.5" fill="none" stroke={T.surface} strokeWidth="1.3" />
      <rect x="15" y="16.5" width="9" height="6" rx="1.5" fill="none" stroke={T.surface} strokeWidth="1.3" />
      <path d="M 8.5 11.5 L 8.5 19.5 L 15 19.5" stroke={T.surface} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TYPOGRAPHIC FAMILY
// ──────────────────────────────────────────────────────────────────────────

// V5: bold italic lowercase a — matches "Not code." hero treatment
export function V5_ItalicA(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      <text
        x="14"
        y="22"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="22"
        fontWeight="700"
        fontStyle="italic"
        fill={T.surface}
      >
        a
      </text>
    </svg>
  );
}

// V6: PA ligature monogram
export function V6_PAMono(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      <text
        x="14"
        y="20"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="14"
        fontWeight="700"
        letterSpacing="-1"
        fill={T.surface}
      >
        PA
      </text>
    </svg>
  );
}

// V7: wordmark-only — no badge, lowercase "psx"
export function V7_Wordmark(p: VariantProps) {
  const T = useT();
  const size = p.size ?? 28;
  return (
    <svg
      width={size * 1.8}
      height={size}
      viewBox="0 0 50 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <text
        x="0"
        y="21"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="20"
        fontWeight="700"
        letterSpacing="-1.5"
        fill={T.primary}
      >
        psx
      </text>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SIGNAL FAMILY
// ──────────────────────────────────────────────────────────────────────────

// V8: upward tick — single bold arrow
export function V8_UpTick(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <path
        d="M 6 19 L 13 10 L 17 14 L 22 7"
        stroke={T.surface}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M 22 7 L 22 12 M 22 7 L 17 7" stroke={T.surface} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </Badge>
  );
}

// V9: zigzag sparkline
export function V9_Zigzag(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <path
        d="M 5 18 L 9 14 L 12 16 L 16 10 L 19 12 L 23 6"
        stroke={T.surface}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="23" cy="6" r="1.8" fill={T.surface} />
    </Badge>
  );
}

// V10: pulse bars — 4 ascending vertical bars
export function V10_PulseBars(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <rect x="5.5" y="17" width="3" height="6" rx="0.5" fill={T.surface} />
      <rect x="10.5" y="13" width="3" height="10" rx="0.5" fill={T.surface} />
      <rect x="15.5" y="9" width="3" height="14" rx="0.5" fill={T.surface} />
      <rect x="20.5" y="5" width="3" height="18" rx="0.5" fill={T.surface} />
    </Badge>
  );
}

// V11: node + pulse hybrid — a small node emitting a signal line
export function V11_NodePulse(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <rect x="4" y="11" width="8.5" height="6" rx="1.5" fill={T.surface} />
      <path
        d="M 12.5 14 L 15 14 L 17 9.5 L 19 18 L 21 14 L 23.5 14"
        stroke={T.surface}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// REGIONAL / SYMBOLIC
// ──────────────────────────────────────────────────────────────────────────

// V12: stepped ascent — abstract staircase (reads as Minar-inspired silhouette or bull-market stairs)
export function V12_SteppedAscent(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <path
        d="M 5 22 L 5 18 L 10 18 L 10 14 L 15 14 L 15 10 L 20 10 L 20 6 L 23 6 L 23 22 Z"
        fill={T.surface}
      />
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SYMBOLIC — simple single-glyph marks, non-derivative
// ──────────────────────────────────────────────────────────────────────────

// V13: alpha (α) — Greek letter. In finance, "alpha" = edge over the benchmark.
// Loaded with meaning for traders, untouched by competitors.
export function V13_Alpha(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      <text
        x="14"
        y="21"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="20"
        fontWeight="600"
        fill={T.surface}
      >
        α
      </text>
    </svg>
  );
}

// V14: single-stroke arrow — one bold diagonal gesture, no chart line.
// Less Robinhood-derivative than V8; closer to a "direction/shift" symbol.
export function V14_SingleArrow(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <path
        d="M 7 19 L 20 7"
        stroke={T.surface}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 13 7 L 20 7 L 20 14"
        stroke={T.surface}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Badge>
  );
}

// V15: notched pill — a rounded rectangle with a triangular wedge cut out.
// Abstract, ownable, reads as "cut/decide" or a ticket/price-tag edge.
export function V15_NotchedPill(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <path
        d="M 5 8 L 23 8 L 23 20 L 5 20 Z M 17 14 L 11 10 L 11 18 Z"
        fill={T.surface}
        fillRule="evenodd"
      />
    </Badge>
  );
}

// V16: delta (Δ) — math symbol for change/difference. Pure geometry, finance-native.
export function V16_Delta(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <path d="M 14 6 L 23 22 L 5 22 Z" fill={T.surface} />
    </Badge>
  );
}

// V17: single candle — one OHLC candle with wick. Not a chart of candles;
// a single unit, centered. Bolder + cleaner than generic chart icons.
export function V17_SingleCandle(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      <line
        x1="14"
        y1="4.5"
        x2="14"
        y2="23.5"
        stroke={T.surface}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="9" y="9" width="10" height="10" rx="1.5" fill={T.surface} />
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// COMBINATIONS — α + node-graph DNA
// ──────────────────────────────────────────────────────────────────────────

// V18: α inside an outlined pill, diagonal connector to a smaller solid pill.
// Reads as "alpha strategy → output" — keeps α as the anchor, adds product specificity.
export function V18_AlphaNode(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      {/* α as the primary mark, slightly off-center left */}
      <text
        x="10"
        y="18"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="14"
        fontWeight="600"
        fill={T.surface}
      >
        α
      </text>
      {/* Connector line from α to the output node */}
      <path
        d="M 16 14 Q 19 14 21 17"
        stroke={T.surface}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Small output node */}
      <rect x="19" y="17" width="5" height="4" rx="1" fill={T.surface} />
    </svg>
  );
}

// V19: Three-node fan with α as the central decision point.
// Two condition pills on the left → α → outcome. Matches the hero diagram's story.
export function V19_AlphaFan(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      {/* Two condition nodes on the left */}
      <rect x="3" y="5" width="6" height="4" rx="1" fill={T.surface} />
      <rect x="3" y="19" width="6" height="4" rx="1" fill={T.surface} />
      {/* Converging lines into α */}
      <path
        d="M 9 7 Q 12 10 14 13 M 9 21 Q 12 18 14 15"
        stroke={T.surface}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {/* α center */}
      <text
        x="19"
        y="18"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="14"
        fontWeight="600"
        fill={T.surface}
      >
        α
      </text>
    </svg>
  );
}

// V20: α with a subtle node-graph signature in the lower-right corner.
// α dominates (95% of visual weight); tiny 2-node graph is a "tell" that rewards a close look.
export function V20_AlphaSigned(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
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
      {/* Subtle 2-node signature, lower-right */}
      <circle cx="21.5" cy="20" r="1.3" fill={T.surface} />
      <circle cx="24.5" cy="23" r="1.3" fill={T.surface} />
      <line x1="21.5" y1="20" x2="24.5" y2="23" stroke={T.surface} strokeWidth="0.7" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// NAME-CONNECTED — rooted in the letters of "PSX Algos"
// ──────────────────────────────────────────────────────────────────────────

// V21: Algos 'A' — a bold capital A where the crossbar is the node-graph
// connector. The A shape itself (two legs + joined apex) already reads as two
// nodes meeting at a point. Directly "the Algos A".
export function V21_AlgosA(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      {/* Two legs of the A — drawn as two nodes/pills converging at the apex */}
      <path
        d="M 14 5 L 6 23 M 14 5 L 22 23"
        stroke={T.surface}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Crossbar = the connector between the two legs; reads as the node-graph edge */}
      <line
        x1="9.5"
        y1="17"
        x2="18.5"
        y2="17"
        stroke={T.surface}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Two small dots at the feet — legible "nodes" */}
      <circle cx="6" cy="23" r="1.8" fill={T.surface} />
      <circle cx="22" cy="23" r="1.8" fill={T.surface} />
    </svg>
  );
}

// V22: PSX monogram — the three letters stacked/ligatured into a tight
// lettermark. The X dominates as the "exchange" symbol, P and S flank.
// Directly encodes Pakistan Stock eXchange.
export function V22_PSXMono(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      <text
        x="14"
        y="19"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="11"
        fontWeight="700"
        letterSpacing="-0.5"
        fill={T.surface}
      >
        PSX
      </text>
    </svg>
  );
}

// V23: The X — stylized exchange cross. The X in PSX literally means eXchange;
// visually a crossroads / intersection / multiplication of paths.
// One of the strokes extends into a subtle up-tick to signal growth/direction.
export function V23_ExchangeX(p: VariantProps) {
  const T = useT();
  return (
    <Badge {...p}>
      {/* Down-stroke of X */}
      <path
        d="M 7 7 L 21 21"
        stroke={T.surface}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Up-stroke of X — extends slightly above the top-right to hint at ascent */}
      <path
        d="M 21 7 L 7 21"
        stroke={T.surface}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Small directional indicator at the top-right corner */}
      <path
        d="M 19 7 L 22 7 L 22 10"
        stroke={T.surface}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Badge>
  );
}

// V24: Algos 'a' italic — the same Space Grotesk italic as the hero's
// "Not code." treatment, but with a tiny node-connector embedded in the
// counter or extending from the tail. Directly "the Algos a".
export function V24_AlgosItalicA(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      <text
        x="12"
        y="22"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="22"
        fontWeight="700"
        fontStyle="italic"
        fill={T.surface}
      >
        a
      </text>
      {/* Small node connector in the lower-right — "algos" signature */}
      <circle cx="22.5" cy="21.5" r="1.6" fill={T.surface} />
      <line
        x1="19"
        y1="19"
        x2="22.5"
        y2="21.5"
        stroke={T.surface}
        strokeWidth="0.9"
      />
    </svg>
  );
}

// V25: "Ax" ligature — the A of Algos + the X of PSX fused.
// Distinctive wordmark-like single glyph.
export function V25_AxLigature(p: VariantProps) {
  const T = useT();
  return (
    <svg
      width={p.size ?? 28}
      height={p.size ?? 28}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="28" height="28" rx={p.radius ?? 6} fill={T.primary} />
      <text
        x="14"
        y="20"
        textAnchor="middle"
        fontFamily='var(--font-space-grotesk), "Space Grotesk", sans-serif'
        fontSize="15"
        fontWeight="700"
        letterSpacing="-1.5"
        fill={T.surface}
      >
        Ax
      </text>
    </svg>
  );
}

export const ALL_VARIANTS: Array<{
  id: string;
  name: string;
  family: string;
  notes: string;
  component: React.ComponentType<VariantProps>;
}> = [
  { id: "v1", family: "Node-graph", name: "Arc (current)", notes: "Two filled pills + quadratic arc. Soft, editorial. The shipped version.", component: V1_CurrentArc },
  { id: "v2", family: "Node-graph", name: "Bold diagonal", notes: "Bigger pills, straight connector. More graphic, reads faster at 16px.", component: V2_BoldDiag },
  { id: "v3", family: "Node-graph", name: "Three-node fan", notes: "Mirrors the hero diagram (AND gate shape). Most descriptive; busiest at small sizes.", component: V3_ThreeNodeFan },
  { id: "v4", family: "Node-graph", name: "Flowchart L", notes: "Outline pills + right-angle elbow. Most literally 'flowchart'.", component: V4_Flowchart },
  { id: "v5", family: "Typographic", name: "Italic a", notes: "Echoes the hero's italic 'Not code.' — single character, strong personality.", component: V5_ItalicA },
  { id: "v6", family: "Typographic", name: "PA monogram", notes: "Classic monogram. Works anywhere; no product story.", component: V6_PAMono },
  { id: "v7", family: "Typographic", name: "Wordmark only", notes: "Stripe-style — no badge. Quiet, confident, but nothing to put on an app icon.", component: V7_Wordmark },
  { id: "v8", family: "Signal", name: "Up-tick arrow", notes: "Classic trading-app cue. Unambiguous but extremely conventional.", component: V8_UpTick },
  { id: "v9", family: "Signal", name: "Zigzag sparkline", notes: "A tiny chart line with an end dot. Reads as 'signal' / 'data'.", component: V9_Zigzag },
  { id: "v10", family: "Signal", name: "Pulse bars", notes: "Four ascending bars. Reads as 'growth' or 'audio pulse'.", component: V10_PulseBars },
  { id: "v11", family: "Hybrid", name: "Node + pulse", notes: "A node emitting a signal waveform. 'Strategy → signal' in one glyph.", component: V11_NodePulse },
  { id: "v12", family: "Regional", name: "Stepped ascent", notes: "Abstract staircase — bull market stairs or a minaret silhouette. Regional without being literal.", component: V12_SteppedAscent },
  { id: "v13", family: "Symbolic", name: "Alpha (α)", notes: "Greek letter. In finance, 'alpha' = excess return over the benchmark — loaded with meaning for the audience. No trading brand owns this.", component: V13_Alpha },
  { id: "v14", family: "Symbolic", name: "Single-stroke arrow", notes: "One bold diagonal gesture, no chart line behind it. Less Robinhood-derivative than V8.", component: V14_SingleArrow },
  { id: "v15", family: "Symbolic", name: "Notched pill", notes: "Rounded rectangle with a triangular wedge cut out — abstract, ownable. Reads as 'cut / decide' or a price-tag edge.", component: V15_NotchedPill },
  { id: "v16", family: "Symbolic", name: "Delta (Δ)", notes: "Math symbol for change. Pure geometry, native to finance language. Instantly legible at any size.", component: V16_Delta },
  { id: "v17", family: "Symbolic", name: "Single candle", notes: "One OHLC candle (body + wick), centered. Not a chart of candles — a single unit. Category-native but not derivative.", component: V17_SingleCandle },
  { id: "v18", family: "α + node", name: "α → node", notes: "α as the primary mark, connected diagonally to a small output pill. 'Alpha strategy → output' in one glyph.", component: V18_AlphaNode },
  { id: "v19", family: "α + node", name: "α fan (conditions → α)", notes: "Two condition nodes converge into α. Mirrors the hero diagram with α as the decision point.", component: V19_AlphaFan },
  { id: "v20", family: "α + node", name: "α signed", notes: "Big α anchors the mark; a tiny 2-node graph in the corner is the product signature. Rewards a closer look.", component: V20_AlphaSigned },
  { id: "v21", family: "Name-rooted", name: "Algos A (node legs)", notes: "Bold capital A where the two legs read as convergent nodes and the crossbar is the connector. The A *is* 'Algos'.", component: V21_AlgosA },
  { id: "v22", family: "Name-rooted", name: "PSX monogram", notes: "Tight three-letter lettermark. Directly encodes 'Pakistan Stock eXchange'.", component: V22_PSXMono },
  { id: "v23", family: "Name-rooted", name: "Exchange X", notes: "The X of PSX. Crossroads / intersection / exchange. One arm ticks upward to hint at direction.", component: V23_ExchangeX },
  { id: "v24", family: "Name-rooted", name: "Algos italic a (signed)", notes: "Italic 'a' (hero-voice) with a small node-connector signature. 'The Algos a' made specific.", component: V24_AlgosItalicA },
  { id: "v25", family: "Name-rooted", name: "Ax ligature", notes: "A (Algos) + X (PSX) fused into one compact glyph. Ligature reads as a single word-unit.", component: V25_AxLigature },
];
