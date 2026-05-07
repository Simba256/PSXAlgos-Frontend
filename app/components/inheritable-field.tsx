"use client";

// Generic anchor-counter wrapper for fields that can inherit a strategy-level
// default. Used by the bot create wizard and the backtest run form to surface
// `strategy.exit_rules.default_risk` without pre-filling the field on the
// child instance — pre-filling pushes users into rubber-stamping (NN/g default
// research, ~70% acceptance rate). The default is rendered as ghost text +
// badge instead. Only an explicit "Override" click lets the user enter a
// value; clearing the field reverts back to inheriting.
//
// Three states the wrapper renders:
//   1. No default available  → plain editable number input (acts like a
//      regular numeric field). The strategy didn't author a default for this
//      slot, so there's nothing to inherit.
//   2. Inheriting (ghost)    → defaultFromStrategy is non-null AND value is
//      null. Input rendered read-only, default value shown as ghost
//      placeholder, "Inheriting · 5%" badge, "Override" link.
//   3. Overridden            → defaultFromStrategy is non-null AND value is
//      non-null. Input editable with the user's number, "Overridden" badge,
//      "Reset to default" link. Blanking the input reverts to inheriting.
//
// Submit shape is up to the parent — when value === null the parent should
// omit the override (or send null) so the backend resolver picks up the
// strategy default at run time.
//
// See `docs/EXITS_IMPLEMENTATION_PLAN.md` Phase 5.

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useT } from "./theme";

export interface InheritableFieldProps {
  label: string;
  caption?: string;
  /**
   * Strategy default for this field. `null` / `undefined` means the strategy
   * didn't author a default — the field renders as a plain editable input.
   */
  defaultFromStrategy: number | null | undefined;
  /** Current form value. `null` means inheriting (when default exists). */
  value: number | null;
  onChange: (next: number | null) => void;
  /** Suffix shown inside the input gutter ("%" or "d"). Default no unit. */
  unit?: string;
  step?: string | number;
  min?: number;
  max?: number;
  integer?: boolean;
  disabled?: boolean;
}

export function InheritableField({
  label,
  caption,
  defaultFromStrategy,
  value,
  onChange,
  unit,
  step,
  min,
  max,
  integer = false,
  disabled = false,
}: InheritableFieldProps) {
  const T = useT();
  const hasDefault = defaultFromStrategy != null;

  // The override toggle decouples "value is null" from "field is currently
  // editable". Without this, clicking Override would have to pre-fill the
  // input (defeating the anchor-counter principle) — instead we flip to an
  // empty editable input that the user types into.
  const [override, setOverride] = useState<boolean>(value != null);

  // Keep override in sync if the parent resets/replaces value externally
  // (e.g., the backtest form's preset chips set every risk field at once).
  useEffect(() => {
    if (value != null) setOverride(true);
    else if (hasDefault) setOverride(false);
  }, [value, hasDefault]);

  const ghost = hasDefault && !override && value == null;
  const overridden = hasDefault && override;
  const formatDefault = (n: number): string =>
    integer ? String(Math.round(n)) : String(n);

  function commitRaw(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // Blanking an overridden input reverts to inheriting. The parent's
      // submit shape will then carry null for this field, so the backend
      // resolver picks up the strategy default at run time.
      onChange(null);
      if (hasDefault) setOverride(false);
      return;
    }
    const n = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (!Number.isFinite(n)) return;
    onChange(n);
  }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      {hasDefault && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: -2,
          }}
        >
          {ghost ? (
            <Badge tone="inherit" T={T}>
              Inheriting · {formatDefault(defaultFromStrategy as number)}
              {unit ?? ""}
            </Badge>
          ) : (
            <Badge tone="override" T={T}>Overridden</Badge>
          )}
          {ghost ? (
            <LinkBtn
              onClick={() => {
                if (disabled) return;
                setOverride(true);
              }}
              disabled={disabled}
              T={T}
            >
              Override
            </LinkBtn>
          ) : (
            <LinkBtn
              onClick={() => {
                if (disabled) return;
                onChange(null);
                setOverride(false);
              }}
              disabled={disabled}
              T={T}
            >
              Reset to default
            </LinkBtn>
          )}
        </div>
      )}

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: T.surface,
          boxShadow: `0 0 0 1px ${ghost ? T.outlineFaint : T.outlineFaint}`,
          borderRadius: 6,
          padding: "8px 10px",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          value={ghost ? "" : value ?? ""}
          readOnly={ghost}
          disabled={disabled}
          step={step ?? (integer ? 1 : "any")}
          min={min}
          max={max}
          placeholder={
            ghost && hasDefault
              ? `${formatDefault(defaultFromStrategy as number)}${unit ?? ""}`
              : "—"
          }
          onChange={(e) => commitRaw(e.target.value)}
          onFocus={() => {
            // If the user tabs into the read-only ghost input, treat that as
            // an implicit override request — they're clearly intending to
            // type something. Saves a click on the Override link.
            if (ghost && !disabled) setOverride(true);
          }}
          aria-label={label}
          aria-describedby={caption ? `${label}-caption` : undefined}
          style={INPUT_STYLE(T, ghost) as CSSProperties}
        />
        {unit && (
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              userSelect: "none",
            }}
          >
            {unit}
          </span>
        )}
      </span>

      {caption && (
        <span
          id={`${label}-caption`}
          style={{
            fontFamily: T.fontSans,
            fontSize: 10.5,
            color: T.text3,
            lineHeight: 1.4,
          }}
        >
          {caption}
        </span>
      )}
    </label>
  );
}

function Badge({
  tone,
  children,
  T,
}: {
  tone: "inherit" | "override";
  children: React.ReactNode;
  T: ReturnType<typeof useT>;
}) {
  // "Inherit" is informational (primary tint), "Overridden" is the active /
  // user-edited state (accent). Both badges stay small enough that the field
  // doesn't read as a control — the input is still the focal point.
  const bg = tone === "inherit" ? T.primary + "1f" : T.accent + "22";
  const fg = tone === "inherit" ? T.primary : T.accent;
  return (
    <span
      style={{
        fontFamily: T.fontMono,
        fontSize: 9.5,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        background: bg,
        color: fg,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function LinkBtn({
  children,
  onClick,
  disabled,
  T,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  T: ReturnType<typeof useT>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        fontFamily: T.fontMono,
        fontSize: 10.5,
        color: T.primaryLight,
        cursor: disabled ? "not-allowed" : "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 2,
      }}
    >
      {children}
    </button>
  );
}

function INPUT_STYLE(
  T: ReturnType<typeof useT>,
  ghost: boolean,
): CSSProperties {
  return {
    width: "100%",
    background: "transparent",
    color: ghost ? T.text3 : T.text,
    border: "none",
    outline: "none",
    fontFamily: T.fontMono,
    fontSize: 12.5,
    padding: 0,
    margin: 0,
    fontVariantNumeric: "tabular-nums",
    cursor: ghost ? "text" : "auto",
    MozAppearance: "textfield" as CSSProperties["MozAppearance"],
  };
}
