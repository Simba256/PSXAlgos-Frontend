"use client";

// B2 bot-level risk controls. Five opt-in numeric inputs; blank = control off.
// Mirrors backend/app/schemas/bot.py BotCreate B2 fields. Each range matches
// the Pydantic Field constraints — invalid values are rejected at submission
// time with a 422 by the backend; local validation keeps the UX tight.
//
// Backend contract (docs/B2_RISK_CONTROLS_DESIGN.md):
//   daily_loss_limit_pct     0.5-50  halt new entries when today's P&L is
//                                    below -X% of start-of-day equity
//   max_drawdown_pause_pct   1-60    pause bot when equity falls > X% below
//                                    its all-time peak
//   stale_data_max_age_days  1-30    per-bot stale-data threshold override;
//                                    NULL = system default (5d)
//   stale_universe_halt_pct  10-100  pause bot when > X% of universe is stale
//   max_per_sector_pct       5-100   cap total equity per sector on new
//                                    entries (existing concentration not
//                                    force-closed)
//
// Defaults are deliberately blank — per the user-approved opt-in contract
// every control is enabled only when the user picks a value. No pre-fill
// pushing users into rubber-stamping (NN/g default research).

import { useT } from "./theme";
import { Kicker } from "./atoms";

export interface RiskControlsValue {
  daily_loss_limit_pct: number | null;
  max_drawdown_pause_pct: number | null;
  stale_data_max_age_days: number | null;
  stale_universe_halt_pct: number | null;
  max_per_sector_pct: number | null;
}

export const EMPTY_RISK_CONTROLS: RiskControlsValue = {
  daily_loss_limit_pct: null,
  max_drawdown_pause_pct: null,
  stale_data_max_age_days: null,
  stale_universe_halt_pct: null,
  max_per_sector_pct: null,
};

interface RiskControlsSectionProps {
  value: RiskControlsValue;
  onChange: (next: RiskControlsValue) => void;
}

interface FieldConfig {
  key: keyof RiskControlsValue;
  label: string;
  caption: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
}

const FIELDS: FieldConfig[] = [
  {
    key: "daily_loss_limit_pct",
    label: "Daily loss limit",
    caption:
      "Halt new entries for the rest of the day if today's P&L drops below this. Open positions keep being managed.",
    unit: "%",
    min: 0.5,
    max: 50,
    step: 0.5,
  },
  {
    key: "max_drawdown_pause_pct",
    label: "Max drawdown pause",
    caption:
      "Pause the bot if equity falls below its all-time peak by more than this. You'll need to manually resume.",
    unit: "%",
    min: 1,
    max: 60,
    step: 1,
  },
  {
    key: "stale_data_max_age_days",
    label: "Stale data max age",
    caption:
      "Skip a symbol when its latest data is older than this. Blank uses the system default (5 days).",
    unit: "days",
    min: 1,
    max: 30,
    step: 1,
    integer: true,
  },
  {
    key: "stale_universe_halt_pct",
    label: "Universe stale halt",
    caption:
      "Pause the bot if more than this fraction of the universe is stale per the threshold above.",
    unit: "%",
    min: 10,
    max: 100,
    step: 5,
  },
  {
    key: "max_per_sector_pct",
    label: "Max per sector",
    caption:
      "Cap total equity per sector. New entries downsize to fit; pre-existing positions stay open.",
    unit: "%",
    min: 5,
    max: 100,
    step: 5,
  },
];

export function RiskControlsSection({ value, onChange }: RiskControlsSectionProps) {
  const T = useT();

  function handleChange(key: keyof RiskControlsValue, raw: string) {
    if (raw.trim() === "") {
      onChange({ ...value, [key]: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return; // ignore non-numeric typing noise
    const field = FIELDS.find((f) => f.key === key);
    const next = field?.integer ? Math.round(n) : n;
    onChange({ ...value, [key]: next });
  }

  const activeCount = (Object.values(value) as Array<number | null>).filter(
    (v) => v !== null,
  ).length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <Kicker>Risk Controls</Kicker>
        <span style={{ color: T.text3, fontSize: 11.5 }}>optional · opt-in</span>
        {activeCount > 0 && (
          <span
            style={{
              color: T.primaryLight,
              fontSize: 11.5,
              letterSpacing: 0.3,
            }}
          >
            {activeCount} active
          </span>
        )}
      </div>
      <p style={{ color: T.text3, fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>
        Automatic safety nets. Each control is off by default — leave a field
        blank to keep it off, or pick a value to enable that control.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 16,
        }}
      >
        {FIELDS.map((f) => {
          const v = value[f.key];
          return (
            <div
              key={f.key}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label
                  htmlFor={`rc-${f.key}`}
                  style={{ color: T.text2, fontSize: 13, fontWeight: 500 }}
                >
                  {f.label}
                </label>
                <span style={{ color: T.text3, fontSize: 11 }}>
                  {f.integer ? `${f.min}–${f.max}` : `${f.min}–${f.max}`} {f.unit}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id={`rc-${f.key}`}
                  type="number"
                  inputMode={f.integer ? "numeric" : "decimal"}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  placeholder="off"
                  value={v === null ? "" : v}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    background: T.surface2,
                    border: `1px solid ${T.outlineFaint}`,
                    color: T.text,
                    fontSize: 13,
                    borderRadius: 4,
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    color: T.text3,
                    fontSize: 11.5,
                    minWidth: 28,
                  }}
                >
                  {f.unit}
                </span>
              </div>
              <p
                style={{
                  color: T.text3,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {f.caption}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
