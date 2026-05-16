"use client";

// SB1 expression input — a single-line free-form editor that replaces the
// legacy "Constant vs Indicator" segmented control on the condition drawer
// RHS. Parses on every keystroke (debounced 150 ms) via the client-side
// Pratt port at `lib/strategy/expression.ts`; the backend re-validates on
// save. Mobile shows an arithmetic operator chip strip above the input so
// users can insert `+ − × ÷ ( )` without fighting the soft keyboard.
//
// See `docs/design_call_dossiers/SB1_frontend_expression_editor_2026-05-15.md`.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "@/components/theme";
import {
  expressionToSource,
  KNOWN_INDICATORS,
  MATH_FN_HINTS,
  MATH_FN_NAMES,
  PATTERN_INDICATORS,
  tryParseExpression,
  type TryParseResult,
} from "@/lib/strategy/expression";

export interface ExpressionInputProps {
  /** Controlled source-text value (user-authored). */
  value: string;
  onChange: (next: string) => void;
  /** Debounced parse result — fires on every keystroke after a 150ms idle. */
  onParse?: (result: TryParseResult) => void;
  /** Indicator wire names from /strategies/meta/indicators. */
  indicators: readonly string[];
  /** Map of wire name → human-readable label (e.g. "sma_50" → "SMA (50)"). */
  formatIndicatorLabel: (wire: string) => string;
  ariaLabel?: string;
  /** Show the mobile-only operator chip strip. Defaults to "auto" — detect via media query. */
  showOperatorChips?: "auto" | "always" | "never";
  /** Optional placeholder when the field is empty. */
  placeholder?: string;
  /** When true, the input renders with a subtle "invalid" outline regardless of
      the debounced parse result. Used by the drawer to flash a save-attempted
      error before the next keystroke clears it. */
  forceInvalid?: boolean;
}

interface Suggestion {
  /** Text inserted into the input when the user commits. */
  insertText: string;
  /** Label shown in the dropdown row. */
  label: string;
  /** Right-aligned dim text — kind ("operator" / "indicator") + wire name. */
  hint?: string;
}

// Operator chips that are always offered. Comparison operators are
// intentionally NOT here — SB1 ships arithmetic-only and the outer
// SingleCondition.operator owns the boolean comparison.
const OPERATOR_CHIPS: ReadonlyArray<{ display: string; insert: string; aria: string }> = [
  { display: "+", insert: " + ", aria: "Plus" },
  { display: "−", insert: " - ", aria: "Minus" },
  { display: "×", insert: " * ", aria: "Times" },
  { display: "÷", insert: " / ", aria: "Divide" },
  { display: "%", insert: " % ", aria: "Modulo" },
  { display: "(", insert: "(", aria: "Open parenthesis" },
  { display: ")", insert: ")", aria: "Close parenthesis" },
  { display: ".", insert: ".", aria: "Dot" },
];

// SB10 — volatility presets. Composes existing indicators (`atr_percent`,
// `bb_percent_b`, `atr`, `sma_50`, `bb_upper`, `bb_lower`, `bb_middle`,
// `close_price`) into ready-to-use expressions. Two are bare identifiers
// (the backend TA service already publishes them); two are genuine
// arithmetic compositions with no equivalent indicator.
export interface PresetChip {
  /** Stable id, used as React key and for analytics if added later. */
  id:
    | "atr-percent"
    | "distance-atr"
    | "bb-percent-b"
    | "bb-bandwidth"
    | "relative-volume"
    | "dollar-volume"
    | "donchian-breakout"
    | "donchian-breakdown"
    | "previous-close"
    | "monday-only"
    | "max-entries-per-day"
    | "cooldown-5-bars"
    | "rsi-top-decile"
    | "zscore-breakout"
    | "trend-strength-slope"
    | "high-volatility-regime"
    | "stat-correlation"
    | "bullish-reversal"
    | "bearish-reversal"
    | "inside-bar"
    | "gap-watch"
    | "indecision";
  /** Chip + autocomplete label. Keep short — fits a 44 px chip. */
  label: string;
  /** Single-line tooltip and autocomplete `hint` text. */
  description: string;
  /** Text inserted at the caret on commit (chip tap OR autocomplete pick).
   *  This is the persisted `valueSource` after the SB1 parser canonicalizes it. */
  expression: string;
  /** Used to rank autocomplete matches: typing any of these prefixes surfaces
   *  the preset. Lowercased. Must NOT collide with indicator wire names.
   *  Note: keys containing operator chars (e.g. `%`) cannot match mid-typing
   *  because `tokenAtCaret` only includes `[a-z0-9_]` — typing the alphanumeric
   *  prefix alone (e.g. `atr`) is enough to surface the preset. */
  matchKeys: readonly string[];
}

export const PRESET_CHIPS: readonly PresetChip[] = [
  {
    id: "atr-percent",
    label: "ATR %",
    description: "Volatility as a percent of price (ATR ÷ close × 100). Typical range 2–5.",
    expression: "atr_percent",
    matchKeys: ["atr%", "atr_percent", "atrp", "volatility"],
  },
  {
    id: "distance-atr",
    label: "Distance (ATR)",
    description: "Distance from SMA-50 in ATR units: (close − sma_50) ÷ atr. Negative = below MA, positive = above.",
    expression: "(close_price - sma_50) / atr",
    matchKeys: ["distance", "dist", "atr_dist", "vol_adj"],
  },
  {
    id: "bb-percent-b",
    label: "Bollinger %B",
    description: "Price position inside the 20-bar Bollinger band: 0 = lower band, 0.5 = middle, 1 = upper.",
    expression: "bb_percent_b",
    matchKeys: ["%b", "percent_b", "bbpb", "bb_position"],
  },
  {
    id: "bb-bandwidth",
    label: "BB Bandwidth",
    description: "Bollinger bandwidth as a fraction of the midline: (bb_upper − bb_lower) ÷ bb_middle. Volatility regime.",
    expression: "(bb_upper - bb_lower) / bb_middle",
    matchKeys: ["bandwidth", "bbw", "bb_width", "vol_regime"],
  },
  {
    id: "relative-volume",
    label: "Relative Volume",
    description:
      "Current bar volume vs 20-day average: volume ÷ volume_sma_20. > 1.5 = unusual interest; > 3 = stalking-horse.",
    expression: "volume / volume_sma_20",
    // `volume` is also the bare indicator's wire name — autocomplete intentionally
    // surfaces both when the user types `volume` so they can pick the ratio or the
    // raw series. Drop `"volume"` here in SB3.b if field-testing shows confusion.
    matchKeys: ["relvol", "relative_volume", "rvol", "unusual_volume", "volume"],
  },
  {
    id: "dollar-volume",
    label: "Dollar Volume",
    description:
      "Dollar turnover for the bar: close_price × volume. Large = liquid name; small = thin-liquidity warning.",
    expression: "close_price * volume",
    matchKeys: ["dollar_volume", "dvol", "turnover", "liquidity", "notional"],
  },
  // SB2 — historical-context presets. Each inserts the RHS of a Single-
  // Condition; the user wires the outer indicator + operator (e.g. set the
  // LHS to `close_price` and the operator to `>`). Matches TradingView's
  // Donchian Channels 20-bar default.
  {
    id: "donchian-breakout",
    label: "Donchian Breakout",
    description:
      "Highest high of the last 20 bars: highest(high_price, 20). Pair with LHS close_price and operator '>' for a 20-bar breakout.",
    expression: "highest(high_price, 20)",
    matchKeys: ["donchian", "breakout", "highest", "new_high", "channel"],
  },
  {
    id: "donchian-breakdown",
    label: "Donchian Breakdown",
    description:
      "Lowest low of the last 20 bars: lowest(low_price, 20). Pair with LHS close_price and operator '<' for a 20-bar breakdown.",
    expression: "lowest(low_price, 20)",
    matchKeys: ["donchian", "breakdown", "lowest", "new_low", "channel"],
  },
  {
    id: "previous-close",
    label: "Previous Close",
    description:
      "Yesterday's close: close_price[1]. Use [N] to reach any prior bar — close_price[5] is 5 bars ago.",
    expression: "close_price[1]",
    matchKeys: ["previous", "yesterday", "lag", "prior", "before"],
  },
  // SB7 — calendar & cooldown presets. Each inserts the RHS of a Single-
  // Condition; the user wires the outer indicator + operator. Composes
  // with the existing operator menu (`<`, `>`, `==`, etc.).
  {
    id: "monday-only",
    label: "Monday only",
    description:
      "Day-of-week filter: dayofweek == 1 (ISO Monday=1, Sunday=7). Pair with LHS dayofweek and operator '==' so the strategy only fires on Mondays. Other useful values: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri.",
    expression: "dayofweek",
    matchKeys: ["dayofweek", "monday", "weekday", "calendar", "day"],
  },
  {
    id: "max-entries-per-day",
    label: "Max 2 entries/day",
    description:
      "Daily entry cap: entries_today < 2. Pair with LHS entries_today and operator '<' so the strategy stops firing after 2 signals on the same symbol same day. Counts ENTRY signals (not fills); excludes the bar's own pending signal.",
    expression: "entries_today",
    matchKeys: ["entries_today", "max_entries", "cap", "daily", "throttle"],
  },
  {
    id: "cooldown-5-bars",
    label: "5-bar cooldown",
    description:
      "Per-symbol cooldown: bars_since_entry > 5. Pair with LHS bars_since_entry and operator '>'. The bar count walks back to the most recent entry on this symbol; the strategy waits at least 5 bars after a fill before firing again. None (≡ never fired) reads as 0 < 5 — first entry is unblocked.",
    expression: "bars_since_entry",
    matchKeys: ["cooldown", "bars_since_entry", "wait", "lockout", "between_entries"],
  },
  // SB11 — statistical-function presets. Pine-aligned; backed by the SB2
  // MarketDataWindow rolling walk. Each inserts a ready-to-use expression;
  // pair with the appropriate outer indicator + operator.
  {
    id: "rsi-top-decile",
    label: "RSI top decile",
    description:
      "Current RSI is in the top 10% of its 252-bar (≈1 year) history: percentrank(rsi, 252) > 90. Pair with LHS percentrank(rsi, 252) and operator '>'.",
    expression: "percentrank(rsi, 252)",
    matchKeys: ["percentrank", "rank", "decile", "percentile", "top"],
  },
  {
    id: "zscore-breakout",
    label: "Z-score breakout",
    description:
      "Close is more than 2 standard deviations above its 20-bar mean: zscore(close_price, 20) > 2. Mean-reversion signal flipped — fade overextensions. Pair with LHS zscore(close_price, 20) and operator '>'.",
    expression: "zscore(close_price, 20)",
    matchKeys: ["zscore", "z_score", "standardize", "breakout", "deviation"],
  },
  {
    id: "trend-strength-slope",
    label: "Trend strength",
    description:
      "OLS regression slope of close over the last 20 bars is positive (uptrend): linreg_slope(close_price, 20) > 0. Negative slope = downtrend. Pair with LHS linreg_slope(close_price, 20) and operator '>'.",
    expression: "linreg_slope(close_price, 20)",
    matchKeys: ["linreg", "slope", "trend", "regression", "linear"],
  },
  {
    id: "high-volatility-regime",
    label: "High volatility",
    description:
      "Short-term volatility exceeds long-term: stdev(close_price, 20) > stdev(close_price, 60). Regime detection — vol is expanding. Pair with LHS stdev(close_price, 20) and operator '>' (RHS: stdev(close_price, 60)).",
    expression: "stdev(close_price, 20)",
    matchKeys: ["stdev", "volatility", "std", "deviation", "regime"],
  },
  {
    id: "stat-correlation",
    label: "Correlation",
    description:
      "Pearson rolling correlation between two series over N bars: correlation(close_price, volume, 20). Range [-1, +1]. Pair with LHS correlation(...) and the appropriate operator. (Cross-asset correlation needs SB6 — for now both args must be same-symbol indicators.)",
    expression: "correlation(close_price, volume, 20)",
    matchKeys: ["correlation", "corr", "pearson", "cor", "relate"],
  },
  // SB9 — candlestick pattern presets.
  {
    id: "bullish-reversal",
    label: "Bullish reversal",
    description:
      "Hammer or bullish engulfing: is_hammer OR bullish_engulfing. Use as two separate conditions joined by OR logic in the condition group.",
    expression: "is_hammer",
    matchKeys: ["hammer", "bullish_reversal", "bullish", "reversal", "cdl_bull"],
  },
  {
    id: "bearish-reversal",
    label: "Bearish reversal",
    description:
      "Shooting star or bearish engulfing: is_shooting_star OR bearish_engulfing. Use as two separate conditions joined by OR logic in the condition group.",
    expression: "is_shooting_star",
    matchKeys: ["shooting_star", "bearish_reversal", "bearish", "reversal", "cdl_bear"],
  },
  {
    id: "inside-bar",
    label: "Inside Bar",
    description:
      "Current bar's high < prev high AND low > prev low (Western inside bar / wick containment). Pair with LHS is_inside_bar and operator '>' with value 0.",
    expression: "is_inside_bar",
    matchKeys: ["inside_bar", "inside", "harami", "containment", "compression"],
  },
  {
    id: "gap-watch",
    label: "Gap watch",
    description:
      "Gap up or gap down: gap_up OR gap_down. Current bar opens outside the prior bar's entire range. Use as two separate conditions in an OR group.",
    expression: "gap_up",
    matchKeys: ["gap", "gap_up", "gap_down", "gap_watch", "opening_gap"],
  },
  {
    id: "indecision",
    label: "Indecision",
    description:
      "Doji or spinning top-like uncertainty: is_doji. Body < 10% of range. Use as LHS is_doji with operator '>' and value 0.",
    expression: "is_doji",
    matchKeys: ["doji", "indecision", "spinning_top", "uncertainty", "neutral"],
  },
] as const;

function useTouchPointer(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return touch;
}

// Returns [start, end] byte offsets of the identifier (or numeric) token the
// caret sits inside. Empty token (whitespace / start of string / after an
// operator) returns [caret, caret] so the suggestion insert overwrites
// nothing. Operator chars belong to no token.
function tokenAtCaret(source: string, caret: number): { start: number; end: number; text: string } {
  const isIdent = (c: string) => /[a-z0-9_]/.test(c);
  let start = caret;
  while (start > 0 && isIdent(source[start - 1])) start -= 1;
  let end = caret;
  while (end < source.length && isIdent(source[end])) end += 1;
  return { start, end, text: source.slice(start, end) };
}

// Returns true when the position immediately to the left of `caret` is an
// operand boundary (digit, identifier char, or closing paren). The editor
// uses this to bias the autocomplete: after an operand we prefer operator
// suggestions; otherwise we prefer indicator/number suggestions. Heuristic
// — typing past a wrong bias always works.
function precededByOperand(source: string, caret: number): boolean {
  let i = caret - 1;
  while (i >= 0 && (source[i] === " " || source[i] === "\t")) i -= 1;
  if (i < 0) return false;
  const c = source[i];
  return /[a-z0-9_)]/.test(c);
}

export function ExpressionInput({
  value,
  onChange,
  onParse,
  indicators,
  formatIndicatorLabel,
  ariaLabel = "Expression",
  showOperatorChips = "auto",
  placeholder = "e.g. 50  •  sma_20  •  sma_20 + 5",
  forceInvalid = false,
}: ExpressionInputProps) {
  const T = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [caret, setCaret] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [parseResult, setParseResult] = useState<TryParseResult | null>(() =>
    value.trim() ? tryParseExpression(value) : null,
  );
  const inputId = useId();
  const errorId = useId();
  const listboxId = useId();
  const isTouch = useTouchPointer();
  const showChips =
    showOperatorChips === "always" || (showOperatorChips === "auto" && isTouch);

  // Debounced parse — 150ms idle window. Fires `onParse` with the same result
  // pushed into local state so the inline error renders.
  useEffect(() => {
    if (!value.trim()) {
      setParseResult(null);
      onParse?.({ ok: false, message: "expression is empty", column: 0, reason: "empty", path: "" });
      return;
    }
    const handle = setTimeout(() => {
      const result = tryParseExpression(value);
      setParseResult(result);
      onParse?.(result);
    }, 150);
    return () => clearTimeout(handle);
    // `onParse` is intentionally not in the deps — parents that re-create
    // the callback on each render would otherwise re-trigger the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Suggestions for the current caret position. Identifier suggestions come
  // from the indicator list; operator suggestions are the fixed arithmetic
  // set. Position-aware: after an operand we lead with operators.
  const suggestions: Suggestion[] = useMemo(() => {
    const tok = tokenAtCaret(value, caret);
    const q = tok.text.toLowerCase();
    const operandLeads = precededByOperand(value, tok.start);

    const indMatches: Suggestion[] = [];
    if (!q || /^[a-z]/.test(q)) {
      // SB8 — math helper snippets. Surface before indicators so the
      // function-call form is one keystroke away (`abs` → `abs(`). The
      // user still completes the args themselves; the snippet just lands
      // the open paren and a hint at the arity. SB2 — the four history
      // helpers (highest/lowest/barssince/valuewhen) read as "history"
      // via MATH_FN_HINTS so users can tell them apart from plain math.
      for (const fn of MATH_FN_NAMES) {
        if (!q || fn.startsWith(q)) {
          indMatches.push({
            insertText: `${fn}(`,
            label: `${fn}( … )`,
            hint: MATH_FN_HINTS[fn],
          });
        }
      }
      // SB10 — surface volatility presets as operand-like suggestions. Empty
      // token shows all four; otherwise prefix-match against `matchKeys`.
      for (const preset of PRESET_CHIPS) {
        if (!q || preset.matchKeys.some((k) => k.startsWith(q))) {
          indMatches.push({
            insertText: preset.expression,
            label: preset.label,
            hint: "preset",
          });
        }
      }
      // Filter the indicator list by prefix on the current token. Falls back
      // to contains-match if no prefix hits, so a user typing "20" inside an
      // empty token still gets sma_20 etc.
      const starts: Suggestion[] = [];
      const contains: Suggestion[] = [];
      for (const ind of indicators) {
        if (!KNOWN_INDICATORS.has(ind)) continue;
        const hint = PATTERN_INDICATORS.has(ind) ? "pattern" : ind;
        if (!q) {
          starts.push({
            insertText: ind,
            label: formatIndicatorLabel(ind),
            hint,
          });
          continue;
        }
        if (ind.startsWith(q)) {
          starts.push({ insertText: ind, label: formatIndicatorLabel(ind), hint });
        } else if (ind.includes(q)) {
          contains.push({ insertText: ind, label: formatIndicatorLabel(ind), hint });
        }
      }
      indMatches.push(...starts, ...contains);
    }

    const opMatches: Suggestion[] = [];
    if (operandLeads || !q) {
      for (const chip of OPERATOR_CHIPS) {
        // Skip "." for the suggestion menu — it's a numeric-literal helper,
        // only useful on mobile chip strip. Same for ").
        if (chip.display === "." || chip.display === ")") continue;
        opMatches.push({
          insertText: chip.insert,
          label: chip.display,
          hint: "operator",
        });
      }
    }

    const cap = 8;
    if (operandLeads) {
      return [...opMatches, ...indMatches].slice(0, cap);
    }
    return [...indMatches, ...opMatches].slice(0, cap);
  }, [value, caret, indicators, formatIndicatorLabel]);

  function commit(opt: Suggestion) {
    const tok = tokenAtCaret(value, caret);
    const before = value.slice(0, tok.start);
    const after = value.slice(tok.end);
    const next = before + opt.insertText + after;
    const nextCaret = (before + opt.insertText).length;
    onChange(next);
    setOpen(false);
    setHighlight(0);
    // Restore caret + focus on the next paint, after the controlled value lands.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // Some browsers throw on non-text inputs; we always render type=text.
      }
      setCaret(nextCaret);
    });
  }

  function insertAtCaret(text: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? caret;
    const end = el?.selectionEnd ?? caret;
    const next = value.slice(0, start) + text + value.slice(end);
    const nextCaret = start + text.length;
    onChange(next);
    requestAnimationFrame(() => {
      const n = inputRef.current;
      if (!n) return;
      n.focus();
      try {
        n.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
      setCaret(nextCaret);
    });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (suggestions.length === 0 ? 0 : (h + 1) % suggestions.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) =>
        suggestions.length === 0 ? 0 : (h - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }
    if ((e.key === "Enter" || e.key === "Tab") && open && suggestions[highlight]) {
      e.preventDefault();
      commit(suggestions[highlight]);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const isInvalid = forceInvalid || (parseResult !== null && parseResult.ok === false);
  const errorMsg =
    parseResult && parseResult.ok === false && value.trim()
      ? parseResult.message.split("\n")[0]
      : null;

  const canonical =
    parseResult && parseResult.ok ? parseResult.canonical : null;
  const showCanonical =
    canonical !== null && canonical !== value.trim() && canonical !== value;

  const activeOptionId = open && suggestions[highlight] ? `${listboxId}-opt-${highlight}` : undefined;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <PresetChipStrip onInsert={insertAtCaret} />
      {showChips && (
        <OperatorChipStrip onInsert={insertAtCaret} />
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKey}
        onKeyUp={(e) => {
          const t = e.currentTarget;
          setCaret(t.selectionStart ?? t.value.length);
        }}
        onClick={(e) => {
          const t = e.currentTarget;
          setCaret(t.selectionStart ?? t.value.length);
          setOpen(true);
        }}
        onFocus={(e) => {
          setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
          setOpen(true);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        aria-describedby={errorMsg ? errorId : undefined}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: T.fontMono,
          fontSize: 14,
          fontVariantNumeric: "tabular-nums",
          background: T.surface,
          color: T.text,
          border: "none",
          borderRadius: 8,
          outline: "none",
          boxShadow: `0 0 0 ${isInvalid ? 1.5 : 1}px ${
            isInvalid ? T.loss : T.outlineFaint
          }`,
          transition: "box-shadow 120ms",
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Expression suggestions"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: "none",
            maxHeight: 220,
            overflowY: "auto",
            background: T.surface2,
            borderRadius: 8,
            boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 12px 32px -16px rgba(0,0,0,0.55)`,
            zIndex: 50,
          }}
        >
          {suggestions.map((s, i) => {
            const active = i === highlight;
            return (
              <li
                key={`${s.insertText}-${i}`}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: T.fontMono,
                  fontSize: 13,
                  background: active ? T.surface3 : "transparent",
                  color: active ? T.text : T.text2,
                }}
              >
                <span>{s.label}</span>
                {s.hint && (
                  <span style={{ fontSize: 11, color: T.text3 }}>{s.hint}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {errorMsg ? (
        <div
          id={errorId}
          role="alert"
          style={{
            marginTop: 6,
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.loss,
          }}
        >
          {errorMsg}
        </div>
      ) : showCanonical ? (
        <div
          style={{
            marginTop: 6,
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
          }}
          aria-live="polite"
        >
          parses as <span style={{ color: T.text2 }}>{canonical}</span>
        </div>
      ) : null}
    </div>
  );
}

// Re-exported helper so callers can render the canonical form in summaries
// (canvas leaves, ungroup previews, …) without duplicating the import path.
export { expressionToSource };

// ── OperatorChipStrip ───────────────────────────────────────────────────

// Horizontal scrollable bar above the input on touch devices. Tapping a chip
// inserts its literal at the caret. WCAG 2.5.5 target size: 44×44 px chips.
function OperatorChipStrip({ onInsert }: { onInsert: (text: string) => void }) {
  const T = useT();
  return (
    <div
      role="toolbar"
      aria-label="Expression operators"
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 8,
        marginBottom: 6,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {OPERATOR_CHIPS.map((chip) => (
        <button
          key={chip.display}
          type="button"
          aria-label={chip.aria}
          onClick={() => onInsert(chip.insert)}
          style={{
            minWidth: 44,
            height: 44,
            flexShrink: 0,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: T.fontMono,
            fontSize: 16,
            fontVariantNumeric: "tabular-nums",
            background: T.surface,
            color: T.text2,
            boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          }}
        >
          {chip.display}
        </button>
      ))}
    </div>
  );
}

// ── PresetChipStrip ─────────────────────────────────────────────────────

// SB10 — volatility preset catalog. Renders above the input on all viewports
// (desktop + mobile) because these are the discovery vehicle for the whole
// arithmetic surface. Wider chips than OperatorChipStrip — auto-fit content
// — so the human-readable label ("ATR %", "BB Bandwidth") fits.
function PresetChipStrip({ onInsert }: { onInsert: (text: string) => void }) {
  const T = useT();
  return (
    <div
      role="toolbar"
      aria-label="Indicator presets"
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 8,
        marginBottom: 6,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {PRESET_CHIPS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          title={preset.description}
          aria-label={`Insert ${preset.label} preset: ${preset.description}`}
          onClick={() => onInsert(preset.expression)}
          style={{
            minHeight: 44,
            padding: "0 12px",
            flexShrink: 0,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: T.fontMono,
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            background: T.surface,
            color: T.text2,
            boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
