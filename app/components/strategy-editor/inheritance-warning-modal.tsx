"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Modal } from "@/components/atoms";
import { useT } from "@/components/theme";
import type {
  InheritanceWarning,
  InheritanceWarningBot,
  RiskField,
} from "@/lib/api/strategies";

// Phase 6 — per-bot picker modal that opens when `PUT /strategies/{id}` returns
// an `inheritance_warnings` block. The PUT itself committed the new default;
// what's left is to decide, per affected bot, whether it should:
//
//   * Inherit the new default (its row stays NULL on the changed fields), OR
//   * Snapshot the old default into its row (severs future inheritance).
//
// The default for every bot is "Inherit new" — the strategy edit was the
// user's stated intent, so the safe default is to let it propagate. Snapshot
// is opt-in per bot. On confirm we POST `apply-default-risk` with two
// disjoint ID lists; the backend wraps everything in one transaction.

// Display labels for each risk field. Mirrors the labels used elsewhere in
// the UI (RiskDefaultsNode, RiskField in backtest-new-view) so users see the
// same names everywhere.
const FIELD_LABEL: Record<RiskField, string> = {
  stop_loss_pct: "Stop loss",
  take_profit_pct: "Take profit",
  trailing_stop_pct: "Trailing",
  max_holding_days: "Max hold",
};

const FIELD_UNIT: Record<RiskField, string> = {
  stop_loss_pct: "%",
  take_profit_pct: "%",
  trailing_stop_pct: "%",
  max_holding_days: "d",
};

function fmtValue(field: RiskField, raw: number | null | undefined): string {
  if (raw == null) return "—";
  if (field === "max_holding_days") return `${Math.round(raw)}${FIELD_UNIT[field]}`;
  // Trim trailing zeros but keep up to 2 decimals (matches what the form
  // shows back when the user types). e.g. 5 → "5%", 5.50 → "5.5%".
  return `${Number(raw.toFixed(2))}${FIELD_UNIT[field]}`;
}

type Decision = "inherit" | "snapshot";

export interface InheritanceWarningModalSubmit {
  propagate_to_bot_ids: number[];
  snapshot_bot_ids: number[];
}

export function InheritanceWarningModal({
  warning,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  warning: InheritanceWarning;
  busy?: boolean;
  // Surface a backend error string (e.g. 400 from apply-default-risk) so the
  // user can correct and retry without dismissing their per-bot picks.
  error?: string | null;
  onCancel: () => void;
  onConfirm: (decision: InheritanceWarningModalSubmit) => void | Promise<void>;
}) {
  const T = useT();

  // Per-bot decision map. Default: every affected bot inherits the new value.
  const [decisions, setDecisions] = useState<Record<number, Decision>>(() => {
    const map: Record<number, Decision> = {};
    for (const bot of warning.affected_bots) map[bot.id] = "inherit";
    return map;
  });

  // If the warning prop changes (re-save round-trip), reset decisions so the
  // user isn't carrying stale picks across two unrelated edits.
  useEffect(() => {
    const map: Record<number, Decision> = {};
    for (const bot of warning.affected_bots) map[bot.id] = "inherit";
    setDecisions(map);
  }, [warning]);

  const counts = useMemo(() => {
    let inherit = 0;
    let snapshot = 0;
    for (const bot of warning.affected_bots) {
      if (decisions[bot.id] === "snapshot") snapshot += 1;
      else inherit += 1;
    }
    return { inherit, snapshot };
  }, [decisions, warning.affected_bots]);

  const handleSubmit = () => {
    const propagate_to_bot_ids: number[] = [];
    const snapshot_bot_ids: number[] = [];
    for (const bot of warning.affected_bots) {
      if (decisions[bot.id] === "snapshot") snapshot_bot_ids.push(bot.id);
      else propagate_to_bot_ids.push(bot.id);
    }
    void onConfirm({ propagate_to_bot_ids, snapshot_bot_ids });
  };

  const setAll = (next: Decision) => {
    if (busy) return;
    const map: Record<number, Decision> = {};
    for (const bot of warning.affected_bots) map[bot.id] = next;
    setDecisions(map);
  };

  const totalBots = warning.affected_bots.length;

  return (
    <Modal onClose={onCancel} label="Apply risk defaults to bots" width={620}>
      <div style={{ padding: 24 }}>
        <div
          style={{
            fontFamily: T.fontHead,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          {totalBots} bot{totalBots === 1 ? "" : "s"} inherit the changed
          {" "}defaults
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 13,
            color: T.text2,
            lineHeight: 1.55,
          }}
        >
          Pick how each bot reacts to the new defaults. Inheriting bots pick up
          the new value on their next signal evaluation; snapshotted bots keep
          running under the old value, frozen on their row.
        </p>

        {/* Diff strip — old → new for each changed field. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 18,
          }}
        >
          {warning.changed_fields.map((field) => {
            const oldV = warning.old_values[field] ?? null;
            const newV = warning.new_values[field] ?? null;
            return (
              <div
                key={field}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: T.surface,
                  border: `1px solid ${T.outlineFaint}`,
                  fontFamily: T.fontMono,
                  fontSize: 11.5,
                }}
              >
                <span style={{ color: T.text3 }}>{FIELD_LABEL[field]}</span>
                <span style={{ color: T.text3 }}>{fmtValue(field, oldV)}</span>
                <span style={{ color: T.text3 }}>→</span>
                <span style={{ color: T.primaryLight }}>
                  {fmtValue(field, newV)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bulk select toolbar. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.text3,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {counts.inherit} inheriting · {counts.snapshot} snapshotting
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAll("inherit")}
              style={bulkBtnStyle(T)}
            >
              All inherit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAll("snapshot")}
              style={bulkBtnStyle(T)}
            >
              All snapshot
            </button>
          </div>
        </div>

        {/* Per-bot rows. */}
        <div
          style={{
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 8,
            maxHeight: 280,
            overflowY: "auto",
            marginBottom: error ? 12 : 18,
          }}
        >
          {warning.affected_bots.map((bot, idx) => (
            <BotRow
              key={bot.id}
              bot={bot}
              decision={decisions[bot.id] ?? "inherit"}
              onChange={(next) =>
                setDecisions((m) => ({ ...m, [bot.id]: next }))
              }
              isFirst={idx === 0}
              disabled={busy}
            />
          ))}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 18,
              padding: "10px 12px",
              borderRadius: 8,
              background: T.surface,
              border: `1px solid ${T.warning}`,
              color: T.text2,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={handleSubmit}
          >
            {busy ? "Applying…" : "Apply"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function bulkBtnStyle(
  T: ReturnType<typeof useT>,
): React.CSSProperties {
  return {
    appearance: "none",
    background: "transparent",
    border: `1px solid ${T.outlineFaint}`,
    borderRadius: 999,
    padding: "4px 10px",
    fontFamily: T.fontMono,
    fontSize: 11,
    color: T.text2,
    cursor: "pointer",
  };
}

function BotRow({
  bot,
  decision,
  onChange,
  isFirst,
  disabled,
}: {
  bot: InheritanceWarningBot;
  decision: Decision;
  onChange: (next: Decision) => void;
  isFirst: boolean;
  disabled: boolean;
}) {
  const T = useT();
  const inheritedLabel =
    bot.inherited_fields.length === 1
      ? FIELD_LABEL[bot.inherited_fields[0]]
      : `${bot.inherited_fields.length} fields`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderTop: isFirst ? "none" : `1px solid ${T.outlineFaint}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 12.5,
            color: T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {bot.name}
        </div>
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 10.5,
            color: T.text3,
            marginTop: 2,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span
            style={{
              letterSpacing: 0.6,
              color:
                bot.status === "ACTIVE"
                  ? T.gain
                  : bot.status === "PAUSED"
                  ? T.warning
                  : T.text3,
            }}
          >
            {bot.status}
          </span>
          <span>·</span>
          <span>inherits {inheritedLabel}</span>
        </div>
      </div>

      <div role="radiogroup" aria-label={`Decision for ${bot.name}`}
        style={{ display: "inline-flex", gap: 4 }}
      >
        <SegBtn
          T={T}
          selected={decision === "inherit"}
          disabled={disabled}
          onClick={() => onChange("inherit")}
          tone="primary"
          label="Inherit new"
        />
        <SegBtn
          T={T}
          selected={decision === "snapshot"}
          disabled={disabled}
          onClick={() => onChange("snapshot")}
          tone="warning"
          label="Snapshot old"
        />
      </div>
    </div>
  );
}

function SegBtn({
  T,
  selected,
  disabled,
  onClick,
  tone,
  label,
}: {
  T: ReturnType<typeof useT>;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: "primary" | "warning";
  label: string;
}) {
  const accent = tone === "primary" ? T.primaryLight : T.warning;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      style={{
        appearance: "none",
        background: selected ? `${accent}1a` : "transparent",
        border: `1px solid ${selected ? accent : T.outlineFaint}`,
        borderRadius: 999,
        padding: "5px 10px",
        fontFamily: T.fontMono,
        fontSize: 11,
        color: selected ? accent : T.text2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
