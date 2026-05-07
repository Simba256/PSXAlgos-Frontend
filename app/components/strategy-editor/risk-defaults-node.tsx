"use client";

import { useT } from "@/components/theme";
import { Pin } from "@/components/atoms";
import type { DefaultRisk } from "@/lib/api/strategies";

// Hybrid exits (Option C, 2026-05-07) — strategy-level scalar guardrails the
// editor authors directly on the canvas. Pinned to the right side; not
// draggable. Bot rows and backtest requests inherit these defaults when their
// own field is left null. See `docs/EXITS_IMPLEMENTATION_PLAN.md` Phase 4.
//
// Empty input → null in state. The PUT body sends the whole `default_risk`
// object every save, so a value going from "5" to empty round-trips as
// `stop_loss_pct: null` and clears the strategy default. This is the same
// "absence means inherit-from-nothing" semantics the resolver service codifies
// (`backend/app/services/risk_inheritance.py`).

const NODE_W = 220;
const NODE_PIN_OFFSET_Y = 28;

type NumericField = keyof DefaultRisk;

interface FieldDef {
  key: NumericField;
  label: string;
  unit: string;
  step: string;
  // Per-field max. Backend validation: stop/take/trail are 0–100, max-hold is
  // ≥1 with no upper bound (kept as a soft client-side cap to avoid pathological
  // entries — bigger values still pass server validation).
  min: number;
  max?: number;
}

const FIELDS: FieldDef[] = [
  { key: "stop_loss_pct", label: "Stop loss", unit: "%", step: "0.1", min: 0, max: 100 },
  { key: "take_profit_pct", label: "Take profit", unit: "%", step: "0.1", min: 0, max: 100 },
  { key: "trailing_stop_pct", label: "Trailing", unit: "%", step: "0.1", min: 0, max: 100 },
  { key: "max_holding_days", label: "Max hold", unit: "d", step: "1", min: 1 },
];

export function RiskDefaultsNode({
  x,
  y,
  value,
  onChange,
}: {
  // Top-left corner in canvas world coords. The right-side anchor pin sits
  // along the left edge so wires from the entry root land on it.
  x: number;
  y: number;
  value: DefaultRisk;
  onChange: (next: DefaultRisk) => void;
}) {
  const T = useT();

  const setField = (key: NumericField, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // Blanking a field clears the default for that field — explicit user
      // intent, not a coercion artifact. Send null so the resolver knows
      // there's no default to fall back to.
      onChange({ ...value, [key]: null });
      return;
    }
    const parsed = key === "max_holding_days" ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (Number.isNaN(parsed)) return;
    onChange({ ...value, [key]: parsed });
  };

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: NODE_W,
        background: T.surfaceLow,
        borderRadius: 10,
        padding: "12px 14px 14px",
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 4px 14px -8px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Two pins so Risk Defaults reads as a junction, not a dead-end:
          left pin connects from the entry root gate, right pin connects to
          the mirrored exit root gate. Both share NODE_PIN_OFFSET_Y so the
          spine wire is a clean horizontal pass-through. */}
      <Pin x={-4} y={NODE_PIN_OFFSET_Y} color={T.primary} />
      <Pin x={NODE_W - 4} y={NODE_PIN_OFFSET_Y} color={T.primary} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: T.primary + "22",
            color: T.primary,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: T.fontHead,
            fontSize: 13,
          }}
        >
          ⚖
        </span>
        <span style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500, color: T.text }}>
          Risk defaults
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.text3,
          lineHeight: 1.35,
          letterSpacing: 0.2,
        }}
      >
        Bots and backtests inherit blanks here. Override per-instance on deploy.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 12,
        }}
      >
        {FIELDS.map((f) => (
          <FieldInput
            key={f.key}
            label={f.label}
            unit={f.unit}
            step={f.step}
            min={f.min}
            max={f.max}
            value={value[f.key]}
            onChange={(raw) => setField(f.key, raw)}
          />
        ))}
      </div>
    </div>
  );
}

// Pin offset is exposed so the canvas can wire a connector from the root to
// exactly the pin's centerline (top + NODE_PIN_OFFSET_Y).
RiskDefaultsNode.PIN_OFFSET_Y = NODE_PIN_OFFSET_Y;
RiskDefaultsNode.WIDTH = NODE_W;

function FieldInput({
  label,
  unit,
  step,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  step: string;
  min: number;
  max?: number;
  value: number | null | undefined;
  onChange: (raw: string) => void;
}) {
  const T = useT();
  // Empty when null/undefined so the input renders as "no default set" rather
  // than "0". Per the anchor-counter principle (NN/g) coming in Phase 5, the
  // forms below this default carry an "Inherit" badge — but on the strategy
  // editor itself, the absence of a default is just an empty input.
  const display = value == null ? "" : String(value);
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontFamily: T.fontMono,
          fontSize: 9,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: T.surface2,
          border: `1px solid ${T.outlineFaint}`,
          borderRadius: 6,
          padding: "4px 8px",
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: T.fontMono,
            fontSize: 12,
            color: T.text,
            padding: 0,
            margin: 0,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            // Trim native spinner overflow on Firefox.
            MozAppearance: "textfield" as React.CSSProperties["MozAppearance"],
          }}
        />
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
      </span>
    </label>
  );
}
