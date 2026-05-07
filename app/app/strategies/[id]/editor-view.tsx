"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  Combobox,
  Connector,
  GateGlyph,
  Kicker,
  Modal,
  Pin,
  Ribbon,
  StatusDot,
  type ComboOption,
} from "@/components/atoms";
import {
  EMPTY_UNIVERSE_AND_RISK,
  UniverseAndRiskFields,
  type UniverseAndRiskValue,
} from "@/components/universe-and-risk-fields";
import { RiskDefaultsNode } from "@/components/strategy-editor/risk-defaults-node";
import { StatusStrip } from "@/components/strategy-editor/status-strip";
import { getAllStocks, type StockResponse } from "@/lib/api/stocks";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";
import type {
  ConditionLogic,
  ConditionValue,
  DefaultRisk,
  ExitRules,
  IndicatorMeta,
  Operator,
  SingleCondition,
  StrategyResponse,
  StrategyUpdateBody,
  StrategyDependentBot,
  StrategyDependentsResponse,
  Timeframe,
} from "@/lib/api/strategies";
import {
  type CondId,
  type ConditionGroup,
  type ConditionLeaf,
  type ConditionNode,
  countEmptyGroups,
  emptyGroup,
  fromBackend,
  hasAnyLeaf,
  insertChild,
  leafFromCond,
  findNode,
  findParent,
  normalizeWireGroup,
  removeNode,
  replaceNode,
  setGroupLogic,
  toBackend,
  ungroupAt,
} from "@/lib/strategy/tree";
import {
  ADD_SLOT_H,
  GATE_H,
  GATE_W,
  GROUP_LABEL_H,
  GROUP_PAD,
  type GroupLayout,
  type InsertionSlot,
  type LeafLayout,
  type NodeLayout,
  collectSlots,
  layoutBounds,
  layoutTree,
  walkGroups,
  walkLeaves,
} from "@/lib/strategy/layout";

type SelKind = "condition" | "group";
type Selection = { kind: SelKind; id: CondId } | null;

type NodeKind = "momentum" | "trend" | "volume";

type CondMeta = {
  indicator: string;
  op: string;
  val: string;
  valIsRef?: boolean;
  meta: string;
  kind: NodeKind;
  compact?: boolean;
};

// SingleCondition → display tuple. The canvas/drawer originally consumed a
// hand-written CondMeta; this adapter keeps the visual layer untouched
// while the editor switches to the live SingleCondition shape returned by
// the backend. Phase 2 will let the drawer mutate the SingleCondition
// directly — for Phase 1 it's read-only.
function condToMeta(cond: SingleCondition): CondMeta {
  return {
    indicator: formatIndicator(cond.indicator, cond.params ?? null),
    op: formatOp(cond.operator),
    val: formatValue(cond.value),
    valIsRef: cond.value.type === "indicator",
    meta: "condition",
    kind: classifyIndicator(cond.indicator),
  };
}

function formatIndicator(ind: string, params: Record<string, number> | null): string {
  const lower = ind.toLowerCase();
  if (lower === "close_price" || lower === "close") return "Close";
  if (lower === "open_price" || lower === "open") return "Open";
  if (lower === "high_price" || lower === "high") return "High";
  if (lower === "low_price" || lower === "low") return "Low";
  if (lower === "volume") return "Volume";
  const periodMatch = lower.match(/^(sma|ema)_(\d+)$/);
  if (periodMatch) return `${periodMatch[1].toUpperCase()} (${periodMatch[2]})`;
  if (lower === "rsi") return `RSI (${params?.period ?? 14})`;
  if (lower === "macd") return "MACD";
  if (lower === "macd_signal") return "MACD Signal";
  if (lower === "macd_histogram") return "MACD Histogram";
  if (lower.startsWith("bb_")) {
    return `BB ${lower.slice(3).replace(/_/g, " ").toUpperCase()}`;
  }
  if (lower === "vwap") return "VWAP";
  if (lower === "obv") return "OBV";
  if (lower === "cmf") return "CMF";
  if (lower === "atr") return "ATR";
  if (lower === "atr_percent") return "ATR %";
  if (lower === "adx") return "ADX";
  if (lower === "roc") return "ROC";
  if (lower === "williams_r") return "Williams %R";
  if (lower === "stochastic_k") return "Stoch %K";
  if (lower === "stochastic_d") return "Stoch %D";
  if (lower === "parabolic_sar") return "Parabolic SAR";
  return ind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOp(op: Operator): string {
  if (op === "crosses_above") return "×↑";
  if (op === "crosses_below") return "×↓";
  return op;
}

function formatValue(value: ConditionValue): string {
  if (value.type === "constant") return String(value.value);
  return formatIndicator(value.indicator, null);
}

// Phase E: build a plain-English expression from a tree node, used by the
// UngroupConfirmModal to show BEFORE / AFTER previews. Parens are emitted
// only when a sub-group's logic differs from its parent's — that's exactly
// the semantic-shift case the modal warns about, and matches how a reader
// would naturally write the expression.
function describeCondition(c: SingleCondition): string {
  return `${formatIndicator(c.indicator, c.params ?? null)} ${formatOp(c.operator)} ${formatValue(c.value)}`;
}

function describeNode(node: ConditionNode, parentLogic: ConditionLogic): string {
  if (node.kind === "condition") return describeCondition(node.cond);
  if (node.children.length === 0) return "(empty group)";
  if (node.children.length === 1) return describeNode(node.children[0], parentLogic);
  const sep = node.logic === "AND" ? " AND " : " OR ";
  const inner = node.children.map((c) => describeNode(c, node.logic)).join(sep);
  return parentLogic === node.logic ? inner : `(${inner})`;
}

function describeRoot(root: ConditionGroup): string {
  if (root.children.length === 0) return "(empty)";
  if (root.children.length === 1) return describeNode(root.children[0], root.logic);
  const sep = root.logic === "AND" ? " AND " : " OR ";
  return root.children.map((c) => describeNode(c, root.logic)).join(sep);
}

function classifyIndicator(ind: string): NodeKind {
  const lower = ind.toLowerCase();
  if (lower === "volume" || lower === "obv" || lower === "cmf") return "volume";
  if (
    lower.startsWith("sma_") ||
    lower.startsWith("ema_") ||
    lower.startsWith("bb_") ||
    lower === "vwap" ||
    lower === "parabolic_sar" ||
    lower === "adx" ||
    lower.endsWith("_price") ||
    lower === "close" ||
    lower === "open" ||
    lower === "high" ||
    lower === "low"
  ) {
    return "trend";
  }
  return "momentum";
}

type SaveStatus = "idle" | "saving" | "error";

// Pure serializer — kept module-level so it's straightforward to unit test
// in isolation. Everything that can be edited in the canvas/drawers travels
// through here on its way to the backend.
//
// Post-Phase B: the entry tree is the canonical state. `toBackend` strips
// client-side IDs and emits the recursive wire shape required by the
// post-Phase-A backend (see STRATEGY_TREE_PLAN.md). Exit conditions aren't
// edited as a tree in the editor — `normalizeWireGroup` re-emits them with
// `kind` discriminators in case the strategy was authored before Phase A.
//
// B046: position_sizing / risk / universe no longer round-trip through this
// shape. They live on the bot row, the backtest request, or the deploy
// request. Anything the editor used to send for those concerns has been
// dropped.
//
// Hybrid exits (Option C, 2026-05-07): `default_risk` is back on the strategy
// — strategy-level scalar guardrail defaults that bots/backtests inherit when
// their own field is null. Authored on the canvas via RiskDefaultsNode (Phase
// 4). Sent on every save; an empty `riskDefaults` object clears all four
// defaults. See `docs/EXITS_IMPLEMENTATION_PLAN.md`.
export function buildUpdateBody(
  name: string,
  tree: ConditionGroup,
  exit: ExitRules,
  riskDefaults: DefaultRisk,
): StrategyUpdateBody {
  return {
    name,
    entry_rules: { conditions: toBackend(tree) },
    exit_rules: {
      ...exit,
      conditions: exit.conditions ? normalizeWireGroup(exit.conditions) : exit.conditions,
      default_risk: riskDefaults,
    },
  };
}

// Phase D: detects "no hover, coarse pointer" environments (mobile / tablet
// touch) so inline `+` slots can render at full opacity instead of hiding
// behind a hover-reveal that touch users can't trigger. Falls back to
// pointer/hover-aware behavior on desktop.
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

export function EditorView({
  initialStrategy,
  indicatorMeta,
}: {
  initialStrategy: StrategyResponse;
  indicatorMeta: IndicatorMeta;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const [deployed, setDeployed] = useState(initialStrategy.status === "ACTIVE");
  const [savedAt, setSavedAt] = useState<number>(() => {
    if (initialStrategy.updated_at) {
      const t = new Date(initialStrategy.updated_at).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return Date.now();
  });
  const [flash, setFlash] = useState<string | null>(null);

  // Lifted graph state. Post-Phase B the canvas reads off a single recursive
  // `tree`, hydrated once from `initialStrategy` with stable client-side IDs
  // attached. The Phase B canvas still flattens leaves left-to-right; Phase C
  // is the boxed-group visual rewrite. IDs never round-trip — `toBackend`
  // strips them on the way out.
  const [tree, setTree] = useState<ConditionGroup>(() =>
    fromBackend(initialStrategy.entry_rules.conditions),
  );
  // Post-B046 the editor stopped mutating exit guardrails / sizing. Hybrid
  // exits (Option C, 2026-05-07) reintroduce the four scalar guardrails as
  // strategy-level defaults under `exit_rules.default_risk`, authored on the
  // canvas via the `RiskDefaultsNode` pin. The signal-based exit-tree branch
  // (`exit_rules.conditions`) round-trips through `exit` so older strategies
  // carrying one don't lose it on save. Phase 4 ships `default_risk` editing
  // through `riskDefaults`; the parallel right-side authoring tree is a
  // follow-up — for now the conditions blob is read-only.
  const [exit, setExit] = useState<ExitRules>(initialStrategy.exit_rules ?? {});
  const [riskDefaults, setRiskDefaults] = useState<DefaultRisk>(
    initialStrategy.exit_rules?.default_risk ?? {},
  );
  // `setExit` is wired so a future Phase 4b/5 mutation surface (right-side
  // exit-tree editor) can land without a second state refactor. Until then
  // the only mutation comes from `riskDefaults`, which `buildUpdateBody`
  // merges back into `exit_rules.default_risk` on save.
  void setExit;
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [name, setName] = useState<string>(initialStrategy.name);
  // Cached dependent-bot count, refreshed on demand. Used by both the save
  // impact warning (F8) and the delete-confirmation modal (F7).
  const [dependentsCache, setDependentsCache] =
    useState<StrategyDependentsResponse | null>(null);
  // null  = no dialog open
  // "save"   = pre-save impact warning (F8)
  // "delete" = delete-confirmation modal (F7)
  const [confirmModal, setConfirmModal] = useState<null | "save" | "delete">(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Phase E: confirmation state for group-level ops. `kind: "ungroup"` fires
  // the BEFORE/AFTER modal when the inner group's logic differs from the
  // parent's; `kind: "delete-group"` fires for groups with 2+ children. Both
  // fall through to a direct mutation when no confirmation is needed.
  const [groupModal, setGroupModal] = useState<
    | { kind: "ungroup"; groupId: CondId }
    | { kind: "delete-group"; groupId: CondId }
    | null
  >(null);
  // B047 deploy modal — universe picker + Confirm. `null` = closed.
  const [deployModal, setDeployModal] = useState<{
    value: UniverseAndRiskValue;
    busy: boolean;
  } | null>(null);
  // PSX universe loaded once on demand (first deploy modal open) so the
  // typical editing session doesn't pay for the /stocks fetch.
  const [stocks, setStocks] = useState<StockResponse[]>([]);
  const router = useRouter();

  async function fetchDependents(): Promise<StrategyDependentsResponse | null> {
    try {
      const res = await fetch(`/api/strategies/${initialStrategy.id}/bots`);
      if (!res.ok) return null;
      const data = (await res.json()) as StrategyDependentsResponse;
      setDependentsCache(data);
      return data;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const onSelect = (kind: SelKind, id: string) =>
    setSelection((prev) =>
      prev?.kind === kind && prev.id === id ? null : { kind, id }
    );
  const close = () => setSelection(null);

  // Risk-defaults change handler. Wraps setRiskDefaults + setDirty so the
  // save toolbar lights up the moment the user types, and Phase 5 forms see
  // the updated default the next time they fetch the strategy. The PUT body
  // built by `buildUpdateBody` always sends the full `default_risk` object
  // (nulls included), so blanking a field reaches the backend cleanly.
  const handleRiskDefaultsChange = (next: DefaultRisk) => {
    setRiskDefaults(next);
    setDirty(true);
  };

  // Performs the actual PUT. Split out so the impact-warning modal can call
  // it directly after confirmation, bypassing the pre-flight check.
  // `silent: true` is used by autosave to skip the success flash (otherwise
  // the toast fires on every keystroke burst); error flashes still surface.
  const performSave = async (opts?: { silent?: boolean }) => {
    if (!dirty || saveStatus === "saving") return;
    // Phase D / Gap 20: tree-aware leaf check. The corner pill is gone, so
    // a strategy can be authored entirely through inline `+` and end up
    // structurally valid (groups present) but semantically empty (no leaf
    // anywhere). Block the save before it reaches the backend, which
    // rejects it independently with a 422.
    if (!hasAnyLeaf(tree)) {
      if (!opts?.silent) setFlash("A strategy needs at least one condition");
      return;
    }
    const body = buildUpdateBody(name, tree, exit, riskDefaults);
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/strategies/${initialStrategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // Proxy returns `{error: "<message>"}` on non-2xx (see
        // app/api/strategies/[id]/route.ts). Parse the JSON envelope so the
        // toast shows the human message (e.g. the 409 on duplicate names)
        // instead of dumping the raw `{"error":"..."}` text at the user.
        const text = await res.text().catch(() => "");
        let message = `Save failed (${res.status})`;
        if (text) {
          try {
            const data = JSON.parse(text);
            if (data && typeof data.error === "string") message = data.error;
            else message = text;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }
      setSavedAt(Date.now());
      setDirty(false);
      setSaveStatus("idle");
      if (!opts?.silent) {
        // Phase E / E3: empty groups are allowed but surface a soft warning so
        // the author knows they evaluate to True (matches backend semantics).
        const empties = countEmptyGroups(tree);
        if (empties > 0) {
          setFlash(
            `Draft saved · ${empties} empty group${empties === 1 ? "" : "s"} will always evaluate to true`,
          );
        } else {
          setFlash("Draft saved");
        }
      }
    } catch (err) {
      setSaveStatus("error");
      setFlash(err instanceof Error ? err.message : "Save failed");
    }
  };

  // F8: Pre-flight check before saving — if any bots depend on this
  // strategy, surface a confirm modal so the user knows the change will
  // affect their next trades. Click-to-Save Anyway then calls performSave().
  const handleSaveDraft = async () => {
    if (!dirty || saveStatus === "saving") return;
    const deps = await fetchDependents();
    if (deps && deps.blocking > 0) {
      setConfirmModal("save");
      return;
    }
    await performSave();
  };

  // F7: Delete a strategy. Always loads the dependent-bot list first so the
  // modal can either (a) tell the user which bots to stop, or (b) confirm
  // the destructive action when none are in the way. The actual DELETE is
  // wired in the modal's confirm handler.
  const handleDelete = async () => {
    await fetchDependents();
    setConfirmModal("delete");
  };

  const performDelete = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/strategies/${initialStrategy.id}`, {
        method: "DELETE",
      });
      if (res.status === 409) {
        // Race: a new bot was bound after we loaded the dependents. Refresh
        // the list and keep the modal open so the user sees the new state.
        await fetchDependents();
        setFlash("Cannot delete — a bot was just bound to this strategy");
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      setConfirmModal(null);
      router.push("/strategies");
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  // B047: deploy now collects a universe (sectors / explicit symbols) which
  // the signal scanner uses to decide which stocks to scan. Without a
  // universe the scanner produces zero signals — so we open a modal first
  // to make the choice explicit. Undeploy is a one-click flip.
  const handleDeploy = async () => {
    if (deployed) {
      setDeployed(false);
      try {
        const res = await fetch(
          `/api/strategies/${initialStrategy.id}/undeploy`,
          { method: "POST" },
        );
        if (!res.ok) throw new Error(`Undeploy failed (${res.status})`);
        setSavedAt(Date.now());
        setFlash("Strategy paused · signals halted");
      } catch (err) {
        setDeployed(true);
        setFlash(err instanceof Error ? err.message : "Undeploy failed");
      }
      return;
    }
    // Opening for first time — load /stocks lazily so the picker has data.
    if (stocks.length === 0) {
      void getAllStocks()
        .then((all) => setStocks(all))
        .catch(() => {
          /* picker will degrade to free-typed symbol entry */
        });
    }
    setDeployModal({ value: EMPTY_UNIVERSE_AND_RISK, busy: false });
  };

  const performDeploy = async (value: UniverseAndRiskValue) => {
    setDeployModal((m) => (m ? { ...m, busy: true } : m));
    try {
      const body: Record<string, unknown> = {};
      if (value.stock_filters) body.stock_filters = value.stock_filters;
      if (value.stock_symbols) body.stock_symbols = value.stock_symbols;
      const res = await fetch(
        `/api/strategies/${initialStrategy.id}/deploy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = `Deploy failed (${res.status})`;
        if (text) {
          try {
            const data = JSON.parse(text);
            if (data && typeof data.error === "string") message = data.error;
            else message = text;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }
      setDeployed(true);
      setSavedAt(Date.now());
      setDeployModal(null);
      const summary = (() => {
        const sectors = value.stock_filters?.sectors ?? [];
        const symbols = value.stock_symbols ?? [];
        const parts: string[] = [];
        if (sectors.length > 0) {
          parts.push(sectors.length === 1 ? sectors[0] : `${sectors.length} sectors`);
        }
        if (symbols.length > 0) {
          parts.push(`${symbols.length} ticker${symbols.length === 1 ? "" : "s"}`);
        }
        if (parts.length === 0) return "no universe — scanner will stay quiet until re-deploy";
        // Sectors and tickers are merged via UNION on the backend (B048).
        return parts.join(" + ");
      })();
      setFlash(`Strategy deployed · ${summary}`);
    } catch (err) {
      setDeployModal((m) => (m ? { ...m, busy: false } : m));
      setFlash(err instanceof Error ? err.message : "Deploy failed");
    }
  };

  const handleRestoreVersion = (label: string) => {
    setSavedAt(Date.now());
    setFlash(`Restored ${label}`);
  };

  // Create-mode wiring — clicking an inline `+` stages a draft cond and
  // remembers (parentId, index) so the new leaf lands exactly where the
  // user pointed. `index === undefined` falls back to "append to end",
  // which is what every legacy code path already expected.
  const [creating, setCreating] = useState<{
    parentId: CondId;
    index?: number;
    cond: SingleCondition;
  } | null>(null);
  const handleAddCondition = (parentId: CondId = tree.id, index?: number) => {
    setSelection(null);
    setCreating({
      parentId,
      index,
      cond: {
        kind: "condition",
        indicator: "rsi",
        operator: "<",
        value: { type: "constant", value: 50 },
        params: null,
      },
    });
  };

  // Phase D: inserting an empty group from the inline picker. Arms
  // `pendingPicker` so the newly-rendered empty-group slot opens its own
  // picker on first paint — the user immediately sees the
  // condition/sub-group choice for the new group, instead of being shoved
  // into the GroupDrawer (which is for editing logic/ungroup, not for
  // first-population). Selection is left untouched so the drawer stays
  // closed; the user can click the gate or group box to open it later.
  const [pendingPicker, setPendingPicker] = useState<{
    parentId: CondId;
    index: number;
  } | null>(null);
  const handleAddGroup = (
    parentId: CondId,
    index: number,
    logic: ConditionLogic,
  ) => {
    const fresh = emptyGroup(logic);
    setTree((t) => insertChild(t, parentId, fresh, index));
    setPendingPicker({ parentId: fresh.id, index: 0 });
    setDirty(true);
  };
  // Auto-clear pendingPicker once consumed so re-renders don't reopen it.
  const consumePendingPicker = (parentId: CondId, index: number) => {
    if (
      pendingPicker &&
      pendingPicker.parentId === parentId &&
      pendingPicker.index === index
    ) {
      setPendingPicker(null);
    }
  };

  const handleDeleteNode = (id: CondId) => {
    const next = removeNode(tree, id);
    if (!hasAnyLeaf(next)) {
      setFlash("A strategy needs at least one condition");
      return;
    }
    setTree(next);
    setDirty(true);
    close();
    setFlash("Condition deleted");
  };

  const handleDuplicateNode = (id: CondId) => {
    const node = findNode(tree, id);
    if (!node || node.kind !== "condition") return;
    const parent = findParent(tree, id) ?? tree;
    const idx = parent.children.findIndex((c) => c.id === id);
    const copy: ConditionLeaf = leafFromCond({
      ...node.cond,
      value: { ...node.cond.value },
      params: node.cond.params ? { ...node.cond.params } : null,
    });
    setTree(insertChild(tree, parent.id, copy, idx + 1));
    setDirty(true);
    close();
    setFlash("Condition duplicated");
  };

  // Toggling group logic is shared between the root (clicked via gate glyph
  // when only the root has a gate) and the GroupDrawer. Both collapse to
  // `setGroupLogic` against the in-memory tree.
  const handleSetGroupLogic = (id: CondId, logic: ConditionLogic) => {
    setTree((t) => setGroupLogic(t, id, logic));
    setDirty(true);
  };

  // Phase E: ungroup a sub-group, splicing its children up into the parent.
  // Skipped on root (no-op). When the group's logic differs from its parent's
  // we open `<UngroupConfirmModal>` first — the BEFORE/AFTER expressions
  // change semantically, so it's worth the friction. Matching logics ungroup
  // immediately (no semantic shift).
  const performUngroup = (id: CondId) => {
    const parent = findParent(tree, id);
    if (!parent) return;
    setTree((t) => ungroupAt(t, id));
    if (selection?.kind === "group" && selection.id === id) {
      setSelection(null);
    }
    setGroupModal(null);
    setDirty(true);
    setFlash("Group ungrouped");
  };
  const handleUngroupGroup = (id: CondId) => {
    if (id === tree.id) return; // root can't be ungrouped
    const target = findNode(tree, id);
    const parent = findParent(tree, id);
    if (!target || target.kind !== "group" || !parent) return;
    if (target.logic === parent.logic) {
      performUngroup(id);
      return;
    }
    setGroupModal({ kind: "ungroup", groupId: id });
  };

  // Phase E: cascade-delete a group + all descendants. Confirmation modal
  // fires when the group has 2+ children (one-child / empty groups are
  // low-stakes). Save validation also runs — if the deletion would leave
  // the strategy with zero leaves, we block and flash the standard message.
  const performDeleteGroup = (id: CondId) => {
    if (id === tree.id) return; // root can't be deleted
    const next = removeNode(tree, id);
    if (!hasAnyLeaf(next)) {
      setFlash("A strategy needs at least one condition");
      setGroupModal(null);
      return;
    }
    setTree(next);
    if (selection?.kind === "group" && selection.id === id) {
      setSelection(null);
    }
    setGroupModal(null);
    setDirty(true);
    setFlash("Group deleted");
  };
  const handleDeleteGroup = (id: CondId) => {
    if (id === tree.id) return;
    const target = findNode(tree, id);
    if (!target || target.kind !== "group") return;
    if (target.children.length >= 2) {
      setGroupModal({ kind: "delete-group", groupId: id });
      return;
    }
    performDeleteGroup(id);
  };

  // Phase E / E2: pressing Delete or Backspace with a group selected opens
  // the same delete flow the drawer's button uses. Skipped while any modal
  // is open (focus is captured) and while the user is typing in an input.
  useEffect(() => {
    if (selection?.kind !== "group") return;
    if (groupModal !== null) return;
    if (confirmModal !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleDeleteGroup(selection.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // handleDeleteGroup closes over `tree` / `selection` — recreated each
    // render, but the listener attaches/detaches in the same effect cycle so
    // it always reads the current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, groupModal, confirmModal, tree]);

  // Autosave: debounce-persist edits 800ms after the last change. Bypasses
  // the dependent-bots impact modal (`handleSaveDraft`) — that modal is for
  // explicit "I'm about to commit" gestures; for routine drafting the user
  // expects changes to stick on refresh, the same way Notion/Figma behave.
  // Skipped while another save is in flight or any blocking modal is open
  // (the modals capture intent, so we shouldn't undermine them by writing
  // around them).
  useEffect(() => {
    if (!dirty) return;
    if (saveStatus === "saving") return;
    if (confirmModal !== null || groupModal !== null) return;
    const t = setTimeout(() => {
      void performSave({ silent: true });
    }, 800);
    return () => clearTimeout(t);
    // performSave reads tree/name/exit through the render closure; listing
    // them as deps reschedules the autosave on every keystroke, which is
    // exactly the debounce we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saveStatus, confirmModal, groupModal, tree, name, exit]);

  // beforeunload guard: belt-and-suspenders for the autosave window. If the
  // user refreshes or closes the tab inside the 800ms debounce (or during
  // the in-flight PUT), the browser prompts before discarding.
  useEffect(() => {
    if (!dirty && saveStatus !== "saving") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required by the legacy Chrome/Firefox API even though modern browsers
      // ignore the string and show a generic prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saveStatus]);

  const selectedLeaf: ConditionLeaf | null = (() => {
    if (selection?.kind !== "condition") return null;
    const node = findNode(tree, selection.id);
    if (!node || node.kind !== "condition") return null;
    return node;
  })();

  const selectedGroup: ConditionGroup | null = (() => {
    if (selection?.kind !== "group") return null;
    const node = findNode(tree, selection.id);
    if (!node || node.kind !== "group") return null;
    return node;
  })();

  return (
    <AppFrame route="/strategies">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          name={name}
          slug={String(initialStrategy.id)}
          deployed={deployed}
          savedAt={savedAt}
          dirty={dirty}
          saveStatus={saveStatus}
          onNameChange={(next) => {
            if (next === name) return;
            setName(next);
            setDirty(true);
          }}
          onSaveDraft={handleSaveDraft}
          onRestoreVersion={handleRestoreVersion}
          onDelete={handleDelete}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
          }}
        >
          <Canvas
            tree={tree}
            selection={selection}
            onSelect={onSelect}
            drawerOpen={selection !== null || creating !== null}
            deployed={deployed}
            onDeploy={handleDeploy}
            onAddCondition={handleAddCondition}
            onAddGroup={handleAddGroup}
            pendingPicker={pendingPicker}
            consumePendingPicker={consumePendingPicker}
            strategyId={initialStrategy.id}
            riskDefaults={riskDefaults}
            onRiskDefaultsChange={handleRiskDefaultsChange}
            latestBacktest={initialStrategy.latest_backtest ?? null}
          />
          {creating && (
            <ConditionDrawer
              key="create"
              cond={creating.cond}
              displayName="New condition"
              indicatorMeta={indicatorMeta}
              onApply={(nextCond) => {
                const leaf = leafFromCond(nextCond);
                const parentId = creating.parentId;
                const index = creating.index;
                setTree((t) => insertChild(t, parentId, leaf, index));
                setDirty(true);
                setCreating(null);
                setFlash(
                  `Added · ${formatIndicator(nextCond.indicator, nextCond.params ?? null)}`
                );
              }}
              onClose={() => setCreating(null)}
            />
          )}
          {!creating && selection?.kind === "condition" && selectedLeaf && (
            <ConditionDrawer
              key={selection.id}
              cond={selectedLeaf.cond}
              displayName={formatIndicator(
                selectedLeaf.cond.indicator,
                selectedLeaf.cond.params ?? null
              )}
              indicatorMeta={indicatorMeta}
              onApply={(nextCond) => {
                const next: ConditionLeaf = {
                  kind: "condition",
                  id: selectedLeaf.id,
                  cond: { ...nextCond, kind: "condition", params: nextCond.params ?? null },
                };
                setTree((t) => replaceNode(t, selectedLeaf.id, next));
                setDirty(true);
                close();
                setFlash(
                  `Saved · ${formatIndicator(nextCond.indicator, nextCond.params ?? null)}`
                );
              }}
              onDelete={() => handleDeleteNode(selectedLeaf.id)}
              onDuplicate={() => handleDuplicateNode(selectedLeaf.id)}
              onClose={close}
            />
          )}
          {selection?.kind === "group" && selectedGroup && (
            <GroupDrawer
              key={selection.id}
              group={selectedGroup}
              isRoot={selectedGroup.id === tree.id}
              onSetLogic={(logic) => handleSetGroupLogic(selectedGroup.id, logic)}
              onUngroup={() => handleUngroupGroup(selectedGroup.id)}
              onDelete={() => handleDeleteGroup(selectedGroup.id)}
              onClose={close}
            />
          )}
        </div>
      </div>
      {flash && <FlashToast message={flash} />}
      {confirmModal === "save" && dependentsCache && (
        <ImpactModal
          kind="save"
          dependents={dependentsCache}
          onCancel={() => setConfirmModal(null)}
          onConfirm={async () => {
            setConfirmModal(null);
            await performSave();
          }}
        />
      )}
      {confirmModal === "delete" && (
        <ImpactModal
          kind="delete"
          dependents={dependentsCache}
          busy={deleteBusy}
          onCancel={() => setConfirmModal(null)}
          onConfirm={performDelete}
        />
      )}
      {groupModal?.kind === "ungroup" && (() => {
        const target = findNode(tree, groupModal.groupId);
        if (!target || target.kind !== "group") return null;
        const before = describeRoot(tree);
        const after = describeRoot(ungroupAt(tree, groupModal.groupId));
        return (
          <UngroupConfirmModal
            before={before}
            after={after}
            onCancel={() => setGroupModal(null)}
            onConfirm={() => performUngroup(groupModal.groupId)}
          />
        );
      })()}
      {groupModal?.kind === "delete-group" && (() => {
        const target = findNode(tree, groupModal.groupId);
        if (!target || target.kind !== "group") return null;
        const childCount = target.children.length;
        return (
          <DeleteGroupConfirmModal
            childCount={childCount}
            onCancel={() => setGroupModal(null)}
            onConfirm={() => performDeleteGroup(groupModal.groupId)}
          />
        );
      })()}
      {deployModal && (
        <DeployUniverseModal
          value={deployModal.value}
          onChange={(next) =>
            setDeployModal((m) => (m ? { ...m, value: next } : m))
          }
          stocks={stocks}
          busy={deployModal.busy}
          onCancel={() => setDeployModal(null)}
          onConfirm={() => performDeploy(deployModal.value)}
        />
      )}
    </AppFrame>
  );
}

function ImpactModal({
  kind,
  dependents,
  busy = false,
  onCancel,
  onConfirm,
}: {
  kind: "save" | "delete";
  dependents: StrategyDependentsResponse | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const T = useT();
  const blocking = dependents?.blocking ?? 0;
  const isDelete = kind === "delete";
  // Delete is hard-blocked when bots still depend (matches backend B2 409).
  const blocked = isDelete && blocking > 0;
  const title = isDelete
    ? blocked
      ? "Stop these bots first"
      : "Delete this strategy?"
    : `${blocking} bot${blocking === 1 ? "" : "s"} use this strategy`;
  const blurb = isDelete
    ? blocked
      ? "Strategies can only be deleted once no live bots reference them. Stop or delete the bots below, then try again."
      : "This soft-deletes the strategy. Backtests are preserved but it'll disappear from your dashboard."
    : "Saving will change the rules these live bots run on their next trade. Make sure you're ready.";
  const confirmLabel = isDelete
    ? blocked
      ? null
      : busy
      ? "Deleting…"
      : "Delete"
    : "Save anyway";
  const confirmVariant = isDelete ? "danger" : "primary";

  return (
    <Modal onClose={onCancel} label={title}>
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
          {title}
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 13,
            color: T.text2,
            lineHeight: 1.55,
          }}
        >
          {blurb}
        </p>
        {dependents && dependents.items.length > 0 && (
          <div
            style={{
              border: `1px solid ${T.outlineFaint}`,
              borderRadius: 8,
              maxHeight: 220,
              overflowY: "auto",
              marginBottom: 18,
            }}
          >
            {dependents.items.map((b: StrategyDependentBot, i) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderTop: i === 0 ? "none" : `1px solid ${T.outlineFaint}`,
                  fontFamily: T.fontMono,
                  fontSize: 12,
                }}
              >
                <Link
                  href={`/bots/${b.id}`}
                  style={{ color: T.primaryLight, textDecoration: "none", flex: 1 }}
                >
                  {b.name}
                </Link>
                <span
                  style={{
                    fontSize: 10.5,
                    letterSpacing: 0.6,
                    color:
                      b.status === "ACTIVE"
                        ? T.gain
                        : b.status === "PAUSED"
                        ? T.warning
                        : T.text3,
                  }}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" onClick={onCancel}>
            {blocked ? "Close" : "Cancel"}
          </Btn>
          {confirmLabel && (
            <Btn
              variant={confirmVariant}
              size="sm"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FlashToast({ message }: { message: string }) {
  const T = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: T.surface2,
        color: T.text,
        padding: "10px 18px",
        borderRadius: 999,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 12px 40px -12px rgba(0,0,0,0.5)`,
        fontFamily: T.fontMono,
        fontSize: 12,
        zIndex: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ color: T.gain }}>✓</span>
      {message}
    </div>
  );
}

function formatSavedLabel(savedAt: number): string {
  const ms = Date.now() - savedAt;
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "saved just now";
  if (mins === 1) return "saved 1m ago";
  if (mins < 60) return `saved ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "saved 1h ago" : `saved ${hrs}h ago`;
}

interface VersionEntry {
  id: string;
  label: string;
  when: string;
  note: string;
  current?: boolean;
}

const MOCK_VERSIONS: VersionEntry[] = [
  { id: "v4", label: "v4", when: "just now", note: "current draft", current: true },
  { id: "v3", label: "v3", when: "2d ago", note: "tightened RSI to < 30" },
  { id: "v2", label: "v2", when: "5d ago", note: "added volume confirmation" },
  { id: "v1", label: "v1", when: "12d ago", note: "initial preset from RSI Bounce" },
];

function Header({
  name,
  slug,
  deployed,
  savedAt,
  dirty,
  saveStatus,
  onNameChange,
  onSaveDraft,
  onRestoreVersion,
  onDelete,
}: {
  name: string;
  slug: string;
  deployed: boolean;
  savedAt: number;
  dirty: boolean;
  saveStatus: SaveStatus;
  onNameChange: (next: string) => void;
  onSaveDraft: () => void;
  onRestoreVersion: (label: string) => void;
  onDelete: () => void;
}) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyAnchorRef = useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      // Empty name is invalid (backend min_length=1) — revert.
      setDraftName(name);
      setEditingName(false);
      return;
    }
    onNameChange(trimmed);
    setEditingName(false);
  };

  const cancelName = () => {
    setDraftName(name);
    setEditingName(false);
  };

  useEffect(() => {
    if (!historyOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHistoryOpen(false);
    }
    function onDoc(e: MouseEvent) {
      if (!historyAnchorRef.current) return;
      if (!historyAnchorRef.current.contains(e.target as Node)) setHistoryOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [historyOpen]);

  const savedLabel =
    saveStatus === "saving"
      ? "saving…"
      : saveStatus === "error"
      ? "save failed — retry"
      : dirty
      ? "unsaved changes"
      : formatSavedLabel(savedAt);
  const savedColor =
    saveStatus === "error"
      ? T.loss
      : saveStatus === "saving"
      ? T.warning
      : dirty
      ? T.warning
      : T.text3;
  const statusColor = deployed ? T.deploy : T.warning;
  const statusLabel = deployed ? "deployed" : "draft";
  const saveDisabled = !dirty || saveStatus === "saving";

  return (
    <div
      style={{
        padding: pick(bp, {
          mobile: `14px ${padX} 12px`,
          desktop: `20px ${padX} 16px`,
        }),
        borderBottom: `1px solid ${T.outlineFaint}`,
        display: "flex",
        alignItems: isMobile ? "stretch" : "flex-end",
        gap: isMobile ? 12 : 24,
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
            letterSpacing: 0.5,
            flexWrap: "wrap",
          }}
        >
          <Link href="/strategies" style={{ color: T.primaryLight }}>
            Strategies
          </Link>
          <span style={{ color: T.text3 }}>/</span>
          <span style={{ color: T.text2 }}>{slug}</span>
          <StatusDot color={statusColor} pulse={deployed} />
          <span style={{ color: statusColor, textTransform: "uppercase", letterSpacing: 0.6 }}>
            {statusLabel}
          </span>
          <span style={{ color: savedColor }}>· {savedLabel}</span>
        </div>
        <h1
          style={{
            fontFamily: T.fontHead,
            fontSize: clampPx(22, 5, 34),
            fontWeight: 500,
            margin: "10px 0 0",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelName();
                }
              }}
              maxLength={120}
              aria-label="Strategy name"
              style={{
                fontFamily: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                letterSpacing: "inherit",
                lineHeight: "inherit",
                color: T.text,
                background: T.surfaceLow,
                border: "none",
                outline: `2px solid ${T.primary}`,
                borderRadius: 4,
                padding: "0 6px",
                margin: "0 -6px",
                minWidth: 240,
                maxWidth: "100%",
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              aria-label={`Edit name (currently ${name})`}
              title="Click to rename"
              style={{
                fontFamily: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                letterSpacing: "inherit",
                lineHeight: "inherit",
                color: "inherit",
                background: "transparent",
                border: "none",
                padding: "0 6px",
                margin: "0 -6px",
                cursor: "text",
                textAlign: "left",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = T.surfaceLow;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {name}
            </button>
          )}
        </h1>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, marginRight: 4 }}>
          last backtest <span style={{ color: T.text3 }}>—</span>
        </span>
        <div ref={historyAnchorRef} style={{ position: "relative" }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            History
          </Btn>
          {historyOpen && (
            <HistoryPopover
              onRestore={(label) => {
                setHistoryOpen(false);
                onRestoreVersion(label);
              }}
            />
          )}
        </div>
        <Btn
          variant={saveStatus === "error" ? "primary" : "outline"}
          size="sm"
          disabled={saveDisabled}
          onClick={onSaveDraft}
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Retry save" : "Save draft"}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Btn>
      </div>
    </div>
  );
}

function HistoryPopover({ onRestore }: { onRestore: (label: string) => void }) {
  const T = useT();
  return (
    <div
      aria-label="Version history"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: 260,
        background: T.surface2,
        borderRadius: 10,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 20px 60px -12px rgba(0,0,0,0.5)`,
        zIndex: 50,
        padding: 6,
      }}
    >
      <div
        style={{
          padding: "8px 10px 6px",
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        Version history
      </div>
      {MOCK_VERSIONS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => !v.current && onRestore(`${v.label} · ${v.when}`)}
          disabled={v.current}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "baseline",
            gap: 10,
            padding: "8px 10px",
            border: "none",
            borderRadius: 6,
            background: "transparent",
            textAlign: "left",
            cursor: v.current ? "default" : "pointer",
            color: T.text,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            if (!v.current) (e.currentTarget as HTMLButtonElement).style.background = T.surfaceLow;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 12,
              color: v.current ? T.primaryLight : T.text,
              minWidth: 28,
            }}
          >
            {v.label}
          </span>
          <span style={{ flex: 1, fontSize: 12, color: T.text2 }}>{v.note}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
            {v.current ? "current" : v.when}
          </span>
        </button>
      ))}
    </div>
  );
}

function Canvas({
  tree,
  selection,
  onSelect,
  drawerOpen,
  deployed,
  onDeploy,
  onAddCondition,
  onAddGroup,
  pendingPicker,
  consumePendingPicker,
  strategyId,
  riskDefaults,
  onRiskDefaultsChange,
  latestBacktest,
}: {
  tree: ConditionGroup;
  selection: Selection;
  onSelect: (kind: SelKind, id: CondId) => void;
  drawerOpen: boolean;
  deployed: boolean;
  onDeploy: () => void;
  onAddCondition: (parentId: CondId, index?: number) => void;
  onAddGroup: (parentId: CondId, index: number, logic: ConditionLogic) => void;
  pendingPicker: { parentId: CondId; index: number } | null;
  consumePendingPicker: (parentId: CondId, index: number) => void;
  strategyId: number;
  // Hybrid exits (Option C, Phase 4): the four scalar guardrails the
  // RiskDefaultsNode authors. Sent on every save via `buildUpdateBody`.
  riskDefaults: DefaultRisk;
  onRiskDefaultsChange: (next: DefaultRisk) => void;
  // Most-recent backtest summary (joined into the strategy response).
  // Drives the StatusStrip's backtest segment; null when no backtest has
  // been run yet.
  latestBacktest: {
    id: number;
    total_return_pct: number | string;
    completed_at: string;
  } | null;
}) {
  const isSelected = (kind: SelKind, id: CondId) =>
    selection?.kind === kind && selection.id === id;
  const T = useT();
  const isTouch = useTouchPointer();
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  // Phase D: pointer position in world coords, used by inline `+` slots
  // for the proximity-reveal effect (Gap 19). Null means pointer is off
  // the canvas. Touch viewports skip this entirely (slots are always-on).
  const [pointerWorld, setPointerWorld] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    midScreen: { x: number; y: number };
    midWorld: { x: number; y: number };
  } | null>(null);
  const viewRef = useRef({ pan, zoom });

  useEffect(() => {
    viewRef.current = { pan, zoom };
  }, [pan, zoom]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { pan: cp, zoom: cz } = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nz = Math.max(0.3, Math.min(2.5, cz * factor));
      const wx = (cx - cp.x) / cz;
      const wy = (cy - cp.y) / cz;
      setPan({ x: cx - wx * nz, y: cy - wy * nz });
      setZoom(nz);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const tgt = e.target as HTMLElement;
    const isBg =
      tgt === canvasRef.current ||
      tgt === worldRef.current ||
      tgt.dataset?.bg === "true";
    if (!isBg) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { pan: cp, zoom: cz } = viewRef.current;
    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: cp.x, panY: cp.y };
      pinchStartRef.current = null;
      setIsDragging(true);
    } else if (pointersRef.current.size === 2) {
      const el = canvasRef.current;
      if (!el) return;
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const rect = el.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      pinchStartRef.current = {
        dist,
        zoom: cz,
        midScreen: { x: mx, y: my },
        midWorld: { x: (mx - cp.x) / cz, y: (my - cp.y) / cz },
      };
      panStartRef.current = null;
    }
    e.preventDefault();
  };

  // Track pointer in world coords for the inline `+` proximity reveal.
  // Runs unconditionally (not gated on pointer-capture) so hover-only
  // movement updates slot opacities even when the user isn't dragging.
  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isTouch) return;
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { pan: cp, zoom: cz } = viewRef.current;
    setPointerWorld({
      x: (e.clientX - rect.left - cp.x) / cz,
      y: (e.clientY - rect.top - cp.y) / cz,
    });
  };
  const onCanvasPointerLeave = () => {
    setPointerWorld(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && pinchStartRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const start = pinchStartRef.current;
      if (start.dist <= 0) return;
      const scale = dist / start.dist;
      const nz = Math.max(0.3, Math.min(2.5, start.zoom * scale));
      setPan({
        x: start.midScreen.x - start.midWorld.x * nz,
        y: start.midScreen.y - start.midWorld.y * nz,
      });
      setZoom(nz);
    } else if (panStartRef.current && pointersRef.current.size === 1) {
      const start = panStartRef.current;
      setPan({
        x: start.panX + (e.clientX - start.x),
        y: start.panY + (e.clientY - start.y),
      });
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    if (pointersRef.current.size === 1) {
      const [remaining] = Array.from(pointersRef.current.values());
      const { pan: cp } = viewRef.current;
      panStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        panX: cp.x,
        panY: cp.y,
      };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      pinchStartRef.current = null;
      setIsDragging(false);
    }
  };

  const bumpZoom = (factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const nz = Math.max(0.3, Math.min(2.5, zoom * factor));
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    setPan({ x: cx - wx * nz, y: cy - wy * nz });
    setZoom(nz);
  };

  // Auto-fit on mount: run resetView once after the canvas ref is wired
  // up, so users opening an existing complex strategy don't land on a
  // mostly-empty viewport. Subsequent re-renders preserve user pan.
  const didInitialFit = useRef(false);

  // Fit the entire tree + output column into the visible canvas. Layered
  // layout means deep trees extend leftward into negative X, so the
  // pre-layered "pan = (40, 20)" default would leave deep trees mostly
  // off-screen. resetView now actually fits to content.
  const resetView = () => {
    const el = canvasRef.current;
    if (!el) {
      setPan({ x: 40, y: 20 });
      setZoom(1);
      return;
    }
    const root = layoutTree(tree);
    const bounds = layoutBounds(root);
    // Right side: include OutputPin column. Mirrors the outputX derivation
    // in the canvas render block (root.gateX + GATE_W + ROOT_TO_OUTPUT_GAP).
    const fitMaxX = root.gateX + GATE_W + 402 + 240;
    const fitMinX = bounds.minX - 24;
    const fitMinY = bounds.minY - 24;
    const fitMaxY = Math.max(bounds.maxY, root.addSlotCy + ADD_SLOT_H / 2) + 24;
    const contentW = fitMaxX - fitMinX;
    const contentH = fitMaxY - fitMinY;
    const rect = el.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / contentW, rect.height / contentH, 1);
    const z = Math.max(0.3, Math.min(2.5, fitZoom));
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wx = (fitMinX + fitMaxX) / 2;
    const wy = (fitMinY + fitMaxY) / 2;
    setPan({ x: cx - wx * z, y: cy - wy * z });
    setZoom(z);
  };

  useEffect(() => {
    if (didInitialFit.current) return;
    if (!canvasRef.current) return;
    didInitialFit.current = true;
    resetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        onCanvasPointerMove(e);
        onPointerMove(e);
      }}
      onPointerLeave={onCanvasPointerLeave}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        backgroundColor: T.surfaceLowest,
        backgroundImage: `radial-gradient(circle, ${T.surface3}80 0.8px, transparent 0.8px)`,
        backgroundSize: `${36 * zoom}px ${36 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      <div
        ref={worldRef}
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {(() => {
          // Phase C: tree-aware auto-layout. The flat-list math from B is
          // replaced by `layoutTree` (recursive size + place) which returns
          // (x, y) for every node and per-group gate coordinates. For a
          // depth-1 tree the layout produces near-identical pixel positions
          // to the pre-Phase-C canvas; nested groups get boxed containers
          // with their own gate glyph.
          const root = layoutTree(tree);
          const allLeaves = walkLeaves(root);
          const nestedGroups = walkGroups(root); // excludes root
          // Phase D: every group exposes between/end/empty slots that
          // serve as click targets for the inline `+` picker.
          const slots = collectSlots(root);
          const isTreeEmpty = tree.children.length === 0;

          // Pre-built id → group lookup so the wire pass can resolve each
          // node's `parentGateId` to a target gate position in O(1).
          const groupMap = new Map<string, GroupLayout>();
          groupMap.set(root.id, root);
          for (const g of nestedGroups) groupMap.set(g.id, g);

          // Right-side anchor. The layered layout pins the root gate at
          // FIXED X (`ROOT_GATE_X` in layout.ts), so deeper trees grow
          // leftward into negative X while the right anchor stays put.
          // `rootOriginX/Y` tracks the actual outgoing pin so single-child
          // trees still wire from the leaf without going through a hidden
          // gate.
          //
          // Phase 4 (Option C hybrid exits, 2026-05-07): the right side used
          // to host three OutputPins (Backtest / Live signals / Automate)
          // stacked vertically. They've been replaced by the pinned
          // `RiskDefaultsNode` — strategy-level scalar guardrail defaults
          // that bots/backtests inherit. The OutputPins' navigation role
          // moved into the bottom-right `StatusStrip` pill so the canvas
          // right edge isn't double-occupied. The full parallel exit-tree
          // authoring (mirror of the entry tree) is a follow-up; today only
          // the scalar defaults pin lives on the right.
          const ROOT_TO_OUTPUT_GAP = 402;
          const rootOriginX = root.showGate ? root.gateX + GATE_W : root.pinX;
          const rootOriginY = root.showGate ? root.gateY : root.pinY;
          const outputX = root.gateX + GATE_W + ROOT_TO_OUTPUT_GAP;
          const outputCurveCtrlX = (rootOriginX + outputX) / 2;
          // RiskDefaultsNode coordinates. The node's top sits at
          // `riskNodeY`; its pin (left edge, vertically offset by
          // PIN_OFFSET_Y) lands at `riskPinY`. We solve for `riskNodeY` so
          // the pin lines up with the root's outgoing pin Y, giving the
          // single connector a clean horizontal flow.
          const riskPinY = root.pinY;
          const riskNodeY = riskPinY - RiskDefaultsNode.PIN_OFFSET_Y;
          const riskPinX = outputX;

          // Each non-root group with a visible gate, plus each leaf,
          // contributes one wire to its parent gate. Groups whose own gate
          // is hidden (n=1) are intentionally skipped — the single child
          // wires straight through to the grandparent's gate.
          const wires: Array<{
            id: string;
            d: string;
            dashed: boolean;
            color?: string;
            width?: number;
          }> = [];
          const pushWire = (
            from: { x: number; y: number },
            to: { x: number; y: number },
            opts: { id: string; dashed: boolean; color?: string; width?: number },
          ) => {
            const midX = from.x + 80;
            wires.push({
              id: opts.id,
              d: `M ${from.x} ${from.y} C ${midX} ${from.y} ${midX} ${to.y} ${to.x} ${to.y}`,
              dashed: opts.dashed,
              color: opts.color,
              width: opts.width,
            });
          };
          const visit = (n: NodeLayout) => {
            if (n.kind === "condition") {
              const parent = groupMap.get(n.parentGateId);
              if (parent && parent.showGate) {
                pushWire(
                  { x: n.pinX, y: n.pinY },
                  { x: parent.gateX, y: parent.gateY },
                  { id: `wire-${n.id}`, dashed: true },
                );
              }
              return;
            }
            if (n.showGate && n.parentGateId) {
              const parent = groupMap.get(n.parentGateId);
              if (parent && parent.showGate) {
                pushWire(
                  { x: n.gateX + GATE_W, y: n.gateY },
                  { x: parent.gateX, y: parent.gateY },
                  { id: `wire-${n.id}`, dashed: false, color: T.primaryLight, width: 2 },
                );
              }
            }
            for (const c of n.children) visit(c);
          };
          for (const c of root.children) visit(c);

          // Root → output-pin fan-out. Each pin gets its own curve from the
          // root's outgoing pin (rootOriginX/Y) so the entry tree feeds the
          // backtest / live signals / bot outputs directly.

          return (
            <>
              <svg
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  overflow: "visible",
                }}
              >
                {wires.map((w) => (
                  <Connector
                    key={w.id}
                    d={w.d}
                    dashed={w.dashed}
                    color={w.color}
                    width={w.width}
                    T={T}
                  />
                ))}
                {/* Single root → RiskDefaultsNode connector. Replaces the
                    three OutputPin curves the canvas used to fan out. */}
                <Connector
                  d={`M ${rootOriginX} ${rootOriginY} C ${outputCurveCtrlX} ${rootOriginY} ${outputCurveCtrlX} ${riskPinY} ${riskPinX} ${riskPinY}`}
                  color={T.primary}
                  width={1.4}
                  T={T}
                />
              </svg>

              {nestedGroups.map((g) => (
                <GroupBox
                  key={`box-${g.id}`}
                  group={g}
                  selected={isSelected("group", g.id)}
                  onSelect={() => onSelect("group", g.id)}
                />
              ))}

              {allLeaves.map((leaf) => {
                const meta = condToMeta(leaf.node.cond);
                return (
                  <CondNode
                    key={leaf.id}
                    x={leaf.x}
                    y={leaf.y}
                    {...meta}
                    selected={isSelected("condition", leaf.id)}
                    onClick={() => onSelect("condition", leaf.id)}
                  />
                );
              })}

              {/* Gate glyph buttons. Render after boxes/leaves so they sit
                  on top. Root gate visible only when ≥2 children; nested
                  group gates follow the same rule. Clicking selects the
                  group (Gap 13: gate and box border share one target). */}
              {root.showGate && (
                <GateButton
                  x={root.gateX}
                  y={root.gateY}
                  logic={root.node.logic}
                  selected={isSelected("group", root.id)}
                  onClick={() => onSelect("group", root.id)}
                />
              )}
              {nestedGroups.map((g) =>
                g.showGate ? (
                  <GateButton
                    key={`gate-${g.id}`}
                    x={g.gateX}
                    y={g.gateY}
                    logic={g.node.logic}
                    selected={isSelected("group", g.id)}
                    onClick={() => onSelect("group", g.id)}
                  />
                ) : null,
              )}

              {/* Phase D inline-add slots. Rendered last in the world layer
                  so they sit above wires/boxes (slots are interactive; wires
                  aren't). The picker pops out from the slot itself. */}
              {slots.map((slot) => (
                <InsertSlot
                  key={`slot-${slot.parentId}-${slot.index}`}
                  slot={slot}
                  isTreeEmpty={isTreeEmpty && slot.parentId === root.id}
                  autoOpen={
                    pendingPicker !== null &&
                    pendingPicker.parentId === slot.parentId &&
                    pendingPicker.index === slot.index
                  }
                  onAutoOpenConsumed={() =>
                    consumePendingPicker(slot.parentId, slot.index)
                  }
                  onAddCondition={() => onAddCondition(slot.parentId, slot.index)}
                  onAddGroup={(logic) =>
                    onAddGroup(slot.parentId, slot.index, logic)
                  }
                />
              ))}

              <RiskDefaultsNode
                x={outputX}
                y={riskNodeY}
                value={riskDefaults}
                onChange={onRiskDefaultsChange}
              />
            </>
          );
        })()}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: drawerOpen ? 412 : 24,
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "4px 6px",
          borderRadius: 999,
          background: T.surface2 + "e6",
          backdropFilter: "blur(10px)",
          border: `1px solid ${T.outlineFaint}`,
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.text3,
          zIndex: 5,
          userSelect: "none",
          transition: "right 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <ZoomBtn onClick={() => bumpZoom(1 / 1.2)} label="−" />
        <span
          style={{
            color: T.text2,
            padding: "0 8px",
            minWidth: 40,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <ZoomBtn onClick={() => bumpZoom(1.2)} label="+" />
        <span style={{ width: 1, height: 14, background: T.outlineFaint, margin: "0 4px" }} />
        <ZoomBtn onClick={resetView} label="fit" />
      </div>

      {/* Phase 4: StatusStrip carries the navigation role the three OutputPins
          used to (Backtest / Live signals / Automate). Sits just above the
          zoom-controls pill on the right; slides with the drawer same way. */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: drawerOpen ? 412 : 24,
          zIndex: 5,
          transition: "right 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <StatusStrip
          strategyId={strategyId}
          deployed={deployed}
          backtest={
            latestBacktest
              ? {
                  totalReturnPct: Number(latestBacktest.total_return_pct),
                  completedAt: latestBacktest.completed_at,
                }
              : null
          }
          // Bot binding lights up in Phase 6 once the picker modal is wired;
          // until then we don't surface a ghost "No bot" segment that pads
          // the strip without doing anything useful.
          botBinding={null}
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          padding: "6px 16px",
          background: T.surface2 + "e6",
          backdropFilter: "blur(10px)",
          borderRadius: 999,
          boxShadow: `0 10px 40px -10px rgba(0,0,0,0.6), 0 0 0 1px ${T.outlineFaint}`,
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <Link href={`/backtest/new?strategy_id=${strategyId}`} style={{ textDecoration: "none" }}>
          <Btn variant="outline" size="sm">
            Run backtest
          </Btn>
        </Link>
        <Btn variant="deploy" size="sm" icon={Icon.spark} onClick={onDeploy}>
          {deployed ? "Pause" : "Deploy"}
        </Btn>
        <Link href={`/bots/new?strategy_id=${strategyId}`} style={{ textDecoration: "none" }}>
          <Btn variant="primary" size="sm" icon={Icon.bot}>
            + Bot
          </Btn>
        </Link>
      </div>
    </div>
  );
}

function ZoomBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: T.text2,
        cursor: "pointer",
        minWidth: 28,
        minHeight: 28,
        padding: "6px 10px",
        borderRadius: 999,
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

function CondNode({
  x,
  y,
  indicator,
  op,
  val,
  valIsRef,
  meta,
  kind,
  compact,
  selected,
  onClick,
}: {
  x: number;
  y: number;
  indicator: string;
  op: string;
  val: string;
  valIsRef?: boolean;
  meta: string;
  kind: "momentum" | "trend" | "volume";
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const T = useT();
  const h = compact ? 88 : 108;
  const kindColor: Record<string, string> = {
    momentum: T.primaryLight,
    trend: T.accent,
    volume: "#c7a885",
  };
  const color = kindColor[kind] || T.primaryLight;
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 200,
        height: h,
        background: T.surfaceLow,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: onClick ? "pointer" : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${T.primary}, 0 8px 28px -10px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${T.outlineFaint}, 0 4px 12px -8px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 10,
          color,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: 2, background: color }} />
        {meta}
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 15,
          fontWeight: 500,
          color: T.text,
          marginTop: 6,
          letterSpacing: -0.2,
        }}
      >
        {indicator}
      </div>
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 12,
          color: T.text2,
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: T.text3 }}>{op}</span>
        <span style={{ color: valIsRef ? T.primaryLight : T.accent }}>{val}</span>
      </div>
      <Pin x={196} y={h / 2 - 4} color={T.primary} />
    </div>
  );
}

// Boxed container for nested groups. The root group renders without a box
// (its gate sits at the same canvas position the pre-Phase-C global gate
// occupied), so this only renders for depth ≥1 nodes. Border styling is
// state-driven (default / hover / selected) and clicking the box selects
// the group — the gate glyph is its own click target but selects the same
// group (Gap 13: one selection target, two affordances).
function GroupBox({
  group,
  selected,
  onSelect,
}: {
  group: GroupLayout;
  selected: boolean;
  onSelect: () => void;
}) {
  const T = useT();
  const [hover, setHover] = useState(false);
  const border = selected
    ? `1.5px solid ${T.primaryLight}`
    : hover
      ? `1px solid ${T.outlineVariant}`
      : `1px dashed ${T.outlineFaint}`;
  const shadow = selected
    ? `0 0 0 4px ${T.primary}20`
    : undefined;
  return (
    <div
      onClick={(e) => {
        // Only trigger when the box itself is clicked, not a child node
        // bubbling up. The leaf/group children stop propagation by virtue
        // of having their own onClick handlers.
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.boxLabel === "true") {
          onSelect();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: group.x,
        top: group.y,
        width: group.w,
        height: group.h,
        borderRadius: 14,
        border,
        background: T.surfaceLow + "40",
        boxShadow: shadow,
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      <div
        data-box-label="true"
        style={{
          position: "absolute",
          left: GROUP_PAD,
          top: 6,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          height: GROUP_LABEL_H,
          lineHeight: `${GROUP_LABEL_H}px`,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        group · {group.node.logic}
      </div>
    </div>
  );
}

// Gate glyph as a click button. Both the root and any nested group use
// this — clicking selects the corresponding group. Phase E will swap the
// click handler for an in-drawer atomic logic toggle; for Phase C the
// drawer placeholder owns the toggle.
function GateButton({
  x,
  y,
  logic,
  selected,
  onClick,
}: {
  x: number;
  y: number;
  logic: ConditionLogic;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Group logic gate (currently ${logic})`}
      title={`Click to edit group logic (${logic})`}
      style={{
        position: "absolute",
        left: x,
        top: y - GATE_H / 2,
        width: GATE_W,
        height: GATE_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        outline: selected ? "2px solid currentColor" : "none",
        outlineOffset: 4,
        borderRadius: 12,
      }}
    >
      <GateGlyph logic={logic} size={GATE_W * 0.5} />
    </button>
  );
}

// Per-gate "add input" slot. One per group. Wide always-visible button
// attached to the gate column, semantically "add an input to this gate".
// Empty groups (no children yet) get an extra copy hint when they're the
// root of an empty tree, since they're the user's only authoring path.
function InsertSlot({
  slot,
  isTreeEmpty,
  autoOpen,
  onAutoOpenConsumed,
  onAddCondition,
  onAddGroup,
}: {
  slot: InsertionSlot;
  // True only for the root group when the entire tree is empty —
  // drives the "Click + to add your first condition or group" copy.
  isTreeEmpty: boolean;
  autoOpen: boolean;
  onAutoOpenConsumed: () => void;
  onAddCondition: () => void;
  onAddGroup: (logic: ConditionLogic) => void;
}) {
  const T = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hover, setHover] = useState(false);

  // Auto-open the picker when the parent flagged this slot (e.g. after
  // adding an empty group, surface the first-child picker so the user
  // isn't left with a dangling empty box).
  useEffect(() => {
    if (autoOpen) {
      setPickerOpen(true);
      onAutoOpenConsumed();
    }
  }, [autoOpen, onAutoOpenConsumed]);

  const x = slot.cx - slot.w / 2;
  const y = slot.cy - slot.h / 2;
  const showHint = isTreeEmpty && slot.isEmpty;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: slot.w,
        height: slot.h,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label="Add an input to this gate"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
            border: `1px dashed ${hover || pickerOpen ? T.outlineVariant : T.outlineFaint}`,
            background: hover || pickerOpen ? T.surface2 : T.surface2 + "aa",
            color: T.text2,
            cursor: "pointer",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontFamily: T.fontMono,
            fontSize: 12,
            lineHeight: 1,
            fontWeight: 500,
            letterSpacing: 0.2,
            transition: "border-color 120ms ease, background 120ms ease",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span>{slot.isEmpty ? "Add first input" : "Add input"}</span>
        </button>
        {pickerOpen && (
          <InsertPicker
            topOffset={ADD_SLOT_H + 6}
            onAddCondition={() => {
              setPickerOpen(false);
              onAddCondition();
            }}
            onAddGroup={(logic) => {
              setPickerOpen(false);
              onAddGroup(logic);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {showHint && (
          <div
            style={{
              position: "absolute",
              top: ADD_SLOT_H + 6,
              left: 0,
              width: "100%",
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              textAlign: "center",
              lineHeight: 1.4,
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            Click + to add your first condition or group.
          </div>
        )}
      </div>
    </div>
  );
}

// Phase D: floating two-item picker that pops out of an inline `+` slot.
// Item 1 inserts a draft condition (handled by the parent's create-mode
// ConditionDrawer); item 2 reveals an AND/OR submenu and inserts an empty
// group. Keyboard: ↑/↓ cycle, Enter confirms, Esc closes, → opens submenu
// on the "Empty group" item.
function InsertPicker({
  topOffset,
  onAddCondition,
  onAddGroup,
  onClose,
}: {
  // Vertical offset (px) from the picker's anchor (the relative-positioned
  // shell wrapping the slot's button). For the 16px between/end button the
  // caller passes 22; for the 44px empty-group button it passes 50 — both
  // produce a 6px breathing-room gap between button and popover.
  topOffset: number;
  onAddCondition: () => void;
  onAddGroup: (logic: ConditionLogic) => void;
  onClose: () => void;
}) {
  const T = useT();
  const [focusIdx, setFocusIdx] = useState(0); // 0 = condition, 1 = group
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuIdx, setSubmenuIdx] = useState(0); // 0 = AND, 1 = OR
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click. Capture-phase so a click on another slot's
  // toggle doesn't end up opening a second picker on top of this one.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (submenuOpen) setSubmenuOpen(false);
      else onClose();
      return;
    }
    if (submenuOpen) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setSubmenuIdx((i) => (i === 0 ? 1 : 0));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSubmenuOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onAddGroup(submenuIdx === 0 ? "AND" : "OR");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i === 1 ? 0 : 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i === 0 ? 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusIdx === 0) onAddCondition();
      else setSubmenuOpen(true);
    } else if (e.key === "ArrowRight" && focusIdx === 1) {
      e.preventDefault();
      setSubmenuOpen(true);
    }
  };

  const itemBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    color: T.text2,
    fontFamily: T.fontMono,
    fontSize: 12,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  };
  const focusedBg = T.surface3;

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        // Auto-focus the menu container so arrow-key nav works without
        // the user clicking inside first. tabIndex=-1 keeps it out of
        // the regular tab order.
        if (el && document.activeElement !== el) el.focus();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="menu"
      style={{
        position: "absolute",
        top: topOffset,
        left: 0,
        minWidth: 168,
        background: T.surface2,
        borderRadius: 10,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 12px 32px -10px rgba(0,0,0,0.6)`,
        padding: 4,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        outline: "none",
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onAddCondition}
        onMouseEnter={() => setFocusIdx(0)}
        style={{
          ...itemBase,
          borderRadius: 6,
          background: focusIdx === 0 ? focusedBg : "transparent",
        }}
      >
        <span style={{ color: T.text3 }}>+</span> Condition
      </button>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={submenuOpen}
        onClick={() => setSubmenuOpen((v) => !v)}
        onMouseEnter={() => setFocusIdx(1)}
        style={{
          ...itemBase,
          borderRadius: 6,
          background: focusIdx === 1 ? focusedBg : "transparent",
          justifyContent: "space-between",
        }}
      >
        <span>
          <span style={{ color: T.text3 }}>+</span> Empty group
        </span>
        <span style={{ color: T.text3, fontSize: 11 }}>▸</span>
      </button>
      {submenuOpen && (
        <div
          role="menu"
          aria-label="Empty group logic"
          style={{
            position: "absolute",
            left: "100%",
            top: 32,
            marginLeft: 4,
            background: T.surface2,
            borderRadius: 10,
            boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 12px 32px -10px rgba(0,0,0,0.6)`,
            padding: 4,
            minWidth: 96,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {(["AND", "OR"] as const).map((logic, i) => (
            <button
              key={logic}
              type="button"
              role="menuitem"
              onClick={() => onAddGroup(logic)}
              onMouseEnter={() => setSubmenuIdx(i)}
              style={{
                ...itemBase,
                borderRadius: 6,
                background: submenuIdx === i ? focusedBg : "transparent",
                fontFamily: T.fontHead,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {logic}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type CompareMode = "Constant" | "Indicator";

function useSliderDrag(onChange: (pct: number) => void) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const update = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChangeRef.current(pct);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    update(e.clientX);
    e.preventDefault();
    e.stopPropagation();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.hasPointerCapture(e.pointerId)) return;
    update(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };

  return { trackRef, onPointerDown, onPointerMove, onPointerUp };
}

// Operator options match backend's Operator enum (schemas/strategy.py).
// `value` is the wire format; `label` is the canvas/drawer glyph.
// `hint` is the hover tooltip — kept short and plain-English so a new user
// can tell `×↑` (crosses above) from `>` (greater than) without prior
// quant background.
const OPERATOR_OPTIONS: { value: Operator; label: string; hint: string }[] = [
  { value: ">", label: ">", hint: "Greater than — the indicator is above the value." },
  { value: ">=", label: "≥", hint: "Greater than or equal to the value." },
  { value: "<", label: "<", hint: "Less than — the indicator is below the value." },
  { value: "<=", label: "≤", hint: "Less than or equal to the value." },
  { value: "==", label: "=", hint: "Equal to the value." },
  {
    value: "crosses_above",
    label: "×↑",
    hint: "Crosses above — the indicator just rose past the value (was below on the previous bar, now at or above).",
  },
  {
    value: "crosses_below",
    label: "×↓",
    hint: "Crosses below — the indicator just dropped past the value (was above on the previous bar, now at or below).",
  },
];
const COMPARE_MODES: CompareMode[] = ["Constant", "Indicator"];

// Bar resolutions a condition can evaluate against. Mirrors backend's
// Timeframe enum (schemas/strategy.py). `available: false` chips render as
// locked ("coming soon") — backend rejects them today, so the UI disables
// them up-front rather than letting a save fail at validation. Daily,
// weekly and monthly are evaluated end-to-end; intraday (5m–4h) is
// reserved until PSX intraday history is deep enough to backtest against.
// Order matches the natural intraday → swing → positional progression a
// trader would scan.
const TIMEFRAMES: { value: Timeframe; label: string; available: boolean }[] = [
  { value: "5m", label: "5m", available: false },
  { value: "15m", label: "15m", available: false },
  { value: "30m", label: "30m", available: false },
  { value: "1h", label: "1h", available: false },
  { value: "4h", label: "4h", available: false },
  { value: "1D", label: "1D", available: true },
  { value: "1W", label: "1W", available: true },
  { value: "1M", label: "1M", available: true },
];

// Plain-English descriptions for the section headers in ConditionDrawer.
// Surfaced via the InfoTooltip ("i in circle") next to each Kicker so a new
// user can learn the section's purpose without reading docs.
const FIELD_INFO = {
  timeframe:
    "Which candle this condition checks. 1D = one trading day per bar, 1W = one week, 1M = one month. Higher timeframes capture broader trends; lower ones (5m, 15m, 1h…) react faster but are noisier — intraday is coming soon as we backfill enough history.",
  indicator:
    "What the strategy looks at — price (Close, Open, High, Low), a moving average (SMA/EMA), momentum (RSI, MACD), volatility (ATR, Bollinger Bands), volume, etc. Pick the data point you want this rule to watch.",
  period:
    "Lookback window for the indicator, in bars (one bar = one trading day on daily data). Larger periods are smoother and slower to react; smaller periods are noisier but quicker.",
  operator:
    "How to compare the indicator on the left to the value on the right: greater than, less than, equal, or a 'cross' that fires only the moment the line moves past the threshold.",
  comparedTo:
    "Compare the indicator to a fixed number you choose (Constant — e.g. 'RSI < 30') or to another live indicator's value (Indicator — e.g. 'Close crosses above SMA 50').",
} as const;

function DrawerContainer({ children }: { children: React.ReactNode }) {
  const T = useT();
  const { isMobile } = useBreakpoint();
  return (
    <div
      style={{
        position: "absolute",
        top: isMobile ? 0 : 16,
        right: isMobile ? 0 : 16,
        bottom: isMobile ? 0 : 16,
        left: isMobile ? 0 : "auto",
        width: isMobile ? "100%" : 380,
        maxWidth: "100%",
        background: T.surface2,
        borderRadius: isMobile ? 0 : 12,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 20px 60px -20px rgba(0,0,0,0.7)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 30,
      }}
    >
      {children}
    </div>
  );
}

// Period maps indicators that have parametric variants on the backend
// (SMA_20/50/200, EMA_12/26, RSI). The period is baked into the enum
// value, so changing it remaps `cond.indicator` rather than touching
// `cond.params`. Returns null when the indicator has no parametric peer.
function getPeriodConfig(
  indicator: string,
): { current: number; choices: number[]; family: "rsi" | "sma" | "ema" } | null {
  if (indicator === "rsi") return { current: 14, choices: [14], family: "rsi" };
  const smaMatch = indicator.match(/^sma_(\d+)$/);
  if (smaMatch) return { current: Number(smaMatch[1]), choices: [20, 50, 200], family: "sma" };
  const emaMatch = indicator.match(/^ema_(\d+)$/);
  if (emaMatch) return { current: Number(emaMatch[1]), choices: [12, 26], family: "ema" };
  return null;
}

function withPeriod(indicator: string, period: number): string {
  if (indicator === "rsi") return "rsi";
  if (/^sma_\d+$/.test(indicator)) return `sma_${period}`;
  if (/^ema_\d+$/.test(indicator)) return `ema_${period}`;
  return indicator;
}

// Controlled ConditionDrawer — reads `cond` (the live SingleCondition from
// EditorView state), seeds local form state on mount, calls `onApply` with
// the next SingleCondition when the user hits Save. PR-2 wires the LHS
// indicator picker, RHS indicator picker, and period selector via
// `indicatorMeta` from /strategies/meta/indicators.
function ConditionDrawer({
  cond,
  displayName,
  indicatorMeta,
  onApply,
  onDelete,
  onDuplicate,
  onClose,
}: {
  cond: SingleCondition;
  displayName: string;
  indicatorMeta: IndicatorMeta;
  onApply: (next: SingleCondition) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
}) {
  const T = useT();
  const initialCompare: CompareMode = cond.value.type === "indicator" ? "Indicator" : "Constant";
  const initialThreshold = cond.value.type === "constant" ? cond.value.value : 0;
  const initialRefIndicator = cond.value.type === "indicator" ? cond.value.indicator : "";

  const [indicator, setIndicator] = useState<string>(cond.indicator);
  const [op, setOp] = useState<Operator>(cond.operator);
  const [compareMode, setCompareMode] = useState<CompareMode>(initialCompare);
  const [threshold, setThreshold] = useState<number>(initialThreshold);
  const [refIndicator, setRefIndicator] = useState<string>(initialRefIndicator);
  // Bar resolution. Backend defaults absent values to "1D"; if a legacy
  // condition was saved before the field existed we surface "1D" so the
  // chip row reflects the live evaluation behavior.
  const [timeframe, setTimeframe] = useState<Timeframe>(cond.timeframe ?? "1D");
  const thresholdPct = Math.max(0, Math.min(100, threshold));

  const slider = useSliderDrag((pct) => setThreshold(Math.round(pct * 100)));

  // Build Combobox options from IndicatorMeta. Group name becomes the
  // right-aligned hint; value is the wire format consumed by the backend.
  const indicatorOptions: ComboOption[] = useMemo(() => {
    const opts: ComboOption[] = [];
    for (const [group, list] of Object.entries(indicatorMeta.indicators)) {
      for (const ind of list) {
        opts.push({
          value: ind,
          label: formatIndicator(ind, null),
          keywords: ind.replace(/_/g, " "),
          hint: group.replace(/_/g, " "),
        });
      }
    }
    return opts;
  }, [indicatorMeta]);

  const period = getPeriodConfig(indicator);
  const lhsLabel = formatIndicator(indicator, null);
  const refLabel = refIndicator ? formatIndicator(refIndicator, null) : "—";
  const previewVal = compareMode === "Constant" ? String(threshold) : refLabel;
  const previewOp = formatOp(op);

  const handleIndicatorChange = (next: string) => {
    setIndicator(next);
    // If user typed something not in the list, leave it — backend will
    // 422 on save and we'll surface that error. Free-text is intentional.
  };

  const handlePeriodChange = (n: number) => {
    setIndicator((curr) => withPeriod(curr, n));
  };

  const handleSave = () => {
    let nextValue: ConditionValue;
    if (compareMode === "Constant") {
      nextValue = { type: "constant", value: threshold };
    } else if (refIndicator) {
      nextValue = { type: "indicator", indicator: refIndicator };
    } else {
      // Compare-to-Indicator with no reference picked — fall back to
      // constant rather than emitting an invalid SingleCondition.
      nextValue = { type: "constant", value: threshold };
    }
    const next: SingleCondition = {
      kind: "condition",
      indicator,
      operator: op,
      value: nextValue,
      timeframe,
      params: cond.params ?? null,
    };
    onApply(next);
  };

  return (
    <DrawerContainer>
      <div style={{ padding: "18px 22px 0", position: "relative" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: T.text3,
            cursor: "pointer",
          }}
        >
          {Icon.close}
        </button>
        <Kicker color={T.primaryLight}>condition</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.4,
          }}
        >
          {displayName}
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          {previewOp} {previewVal}
        </div>
      </div>

      <div style={{ flex: 1, overflowX: "hidden", overflowY: "auto", padding: 22, paddingTop: 16 }}>
        <div style={{ marginTop: 4 }}>
          <Kicker info={FIELD_INFO.timeframe}>timeframe</Kicker>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf.value;
              const locked = !tf.available;
              const tip = locked
                ? `${tf.label} timeframe — coming soon. We're backfilling intraday history; daily (1D) is the only timeframe evaluated today.`
                : undefined;
              return (
                <button
                  key={tf.value}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (!locked) setTimeframe(tf.value);
                  }}
                  title={tip}
                  aria-label={
                    locked ? `${tf.label} timeframe (coming soon, locked)` : `${tf.label} timeframe`
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    border: "none",
                    cursor: locked ? "not-allowed" : "pointer",
                    fontFamily: T.fontMono,
                    fontVariantNumeric: "tabular-nums",
                    background: active ? T.primary + "22" : T.surface,
                    color: active ? T.primaryLight : locked ? T.text3 : T.text2,
                    opacity: locked ? 0.55 : 1,
                    boxShadow: `0 0 0 1px ${active ? T.primary : T.outlineFaint}`,
                    transition: "background 140ms, color 140ms",
                  }}
                >
                  {tf.label}
                  {locked && (
                    <span style={{ display: "inline-flex", marginLeft: 1, color: T.text3 }}>
                      {Icon.lock}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <Combobox
            label="indicator"
            info={FIELD_INFO.indicator}
            value={lhsLabel}
            onChange={(v) => {
              // Combobox commits the option's `value` (wire format), but
              // free-typed text comes through verbatim. Map back to the
              // wire format if the typed text matches a known label.
              const match = indicatorOptions.find(
                (o) => o.label.toLowerCase() === v.toLowerCase() || o.value === v,
              );
              handleIndicatorChange(match ? match.value : v);
            }}
            options={indicatorOptions}
            mono
            placeholder="Pick an indicator…"
            emptyHint="No matching indicator"
          />
        </div>

        {period && (
          <div style={{ marginTop: 14 }}>
            <Kicker info={FIELD_INFO.period}>period</Kicker>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {period.choices.map((p) => {
                const active = p === period.current;
                const locked = period.family === "rsi";
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={locked}
                    onClick={() => handlePeriodChange(p)}
                    title={locked ? "RSI period is fixed at 14" : undefined}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      fontSize: 12,
                      border: "none",
                      cursor: locked ? "default" : "pointer",
                      opacity: locked ? 0.7 : 1,
                      fontFamily: T.fontMono,
                      fontVariantNumeric: "tabular-nums",
                      background: active ? T.primary + "22" : T.surface,
                      color: active ? T.primaryLight : T.text3,
                      boxShadow: `0 0 0 1px ${active ? T.primary : T.outlineFaint}`,
                      transition: "background 140ms, color 140ms",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <Kicker info={FIELD_INFO.operator}>operator</Kicker>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
              marginTop: 8,
            }}
          >
            {OPERATOR_OPTIONS.map((o) => {
              const active = op === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOp(o.value)}
                  title={o.hint}
                  style={{
                    padding: "8px 0",
                    textAlign: "center",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: T.fontMono,
                    fontSize: 13,
                    background: active ? T.primary + "22" : T.surface,
                    color: active ? T.primaryLight : T.text2,
                    boxShadow: active
                      ? `0 0 0 1.5px ${T.primary}`
                      : `0 0 0 1px ${T.outlineFaint}`,
                    transition: "background 140ms, color 140ms, box-shadow 140ms",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <Kicker info={FIELD_INFO.comparedTo}>compared to</Kicker>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {COMPARE_MODES.map((t) => {
              const active = compareMode === t;
              const modeHint =
                t === "Constant"
                  ? "Compare against a fixed number you choose with the slider/input below."
                  : "Compare against another live indicator's value (e.g. Close vs SMA 50).";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCompareMode(t)}
                  title={modeHint}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: active ? T.surface3 : T.surface,
                    color: active ? T.text : T.text3,
                    boxShadow: `0 0 0 1px ${active ? T.outlineVariant : T.outlineFaint}`,
                    transition: "background 140ms, color 140ms",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {compareMode === "Constant" ? (
            <div
              style={{
                marginTop: 10,
                padding: "12px 14px",
                background: T.surface,
                borderRadius: 8,
                boxShadow: `0 0 0 1px ${T.outlineFaint}`,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={threshold}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  if (digits === "") {
                    setThreshold(0);
                    return;
                  }
                  const n = Number(digits);
                  if (Number.isFinite(n)) setThreshold(Math.max(0, Math.min(100, n)));
                }}
                style={{
                  fontFamily: T.fontHead,
                  fontSize: 28,
                  color: T.text,
                  letterSpacing: -0.4,
                  fontVariantNumeric: "tabular-nums",
                  background: "transparent",
                  border: "none",
                  width: 64,
                  padding: 0,
                }}
              />
              <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>of 100</span>
              <div style={{ flex: 1 }} />
              <div
                ref={slider.trackRef}
                onPointerDown={slider.onPointerDown}
                onPointerMove={slider.onPointerMove}
                onPointerUp={slider.onPointerUp}
                onPointerCancel={slider.onPointerUp}
                style={{
                  position: "relative",
                  width: 120,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  touchAction: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 4,
                    borderRadius: 2,
                    background: T.surface3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${thresholdPct}%`,
                      background: T.primaryLight,
                      transition: "width 80ms linear",
                    }}
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: `${thresholdPct}%`,
                    top: "50%",
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: T.primaryLight,
                    transform: "translate(-6px, -6px)",
                    boxShadow: `0 0 0 3px ${T.primaryLight}33`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <Combobox
                label="reference indicator"
                info="The indicator on the right side of the comparison. Both sides are evaluated on the same bar, so this lets you write rules like 'Close > SMA 50' or 'EMA 12 crosses above EMA 26'."
                value={refIndicator ? formatIndicator(refIndicator, null) : ""}
                onChange={(v) => {
                  const match = indicatorOptions.find(
                    (o) => o.label.toLowerCase() === v.toLowerCase() || o.value === v,
                  );
                  setRefIndicator(match ? match.value : v);
                }}
                options={indicatorOptions}
                mono
                placeholder="Pick an indicator…"
                emptyHint="No matching indicator"
              />
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
        }}
      >
        {onDelete && (
          <Btn variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Btn>
        )}
        <div style={{ flex: 1 }} />
        {onDuplicate && (
          <Btn variant="outline" size="sm" onClick={onDuplicate}>
            Duplicate
          </Btn>
        )}
        <Btn variant="primary" size="sm" onClick={handleSave}>
          Apply
        </Btn>
      </div>
    </DrawerContainer>
  );
}


// Phase E GroupDrawer — mirrors ConditionDrawer's shape. Exposes the AND/OR
// logic toggle, a read-only children summary, and the Ungroup / Delete
// actions. Root groups can do neither (root is the strategy itself); the
// buttons render disabled with explanatory tooltips so the affordance is
// still visible.
function GroupDrawer({
  group,
  isRoot,
  onSetLogic,
  onUngroup,
  onDelete,
  onClose,
}: {
  group: ConditionGroup;
  isRoot: boolean;
  onSetLogic: (logic: ConditionLogic) => void;
  onUngroup: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const T = useT();
  const total = group.children.length;
  const conds = group.children.filter((c) => c.kind === "condition").length;
  const subs = total - conds;
  const summary =
    total === 0
      ? "empty group"
      : `${total} child${total === 1 ? "" : "ren"} — ${conds} condition${conds === 1 ? "" : "s"}, ${subs} sub-group${subs === 1 ? "" : "s"}`;
  return (
    <DrawerContainer>
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.text3,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {isRoot ? "root group" : "group"}
        </div>
        <div
          style={{
            fontFamily: T.fontHead,
            fontSize: 18,
            fontWeight: 500,
            color: T.text,
            marginTop: 4,
            letterSpacing: -0.2,
          }}
        >
          {group.logic}
        </div>
        <div style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>
          {summary}
        </div>
      </div>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.text3,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          logic
        </div>
        <div
          role="radiogroup"
          aria-label="Group logic"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            background: T.surfaceLow,
            borderRadius: 10,
            padding: 4,
            border: `1px solid ${T.outlineFaint}`,
          }}
        >
          {(["AND", "OR"] as const).map((opt) => {
            const active = group.logic === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSetLogic(opt)}
                style={{
                  background: active ? T.primary : "transparent",
                  color: active ? T.surfaceLowest : T.text2,
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontFamily: T.fontHead,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <p
          style={{
            margin: 0,
            color: T.text3,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {group.logic === "AND"
            ? "All child conditions must hold for this group to fire."
            : "Any one child firing makes this group fire."}
        </p>
      </div>
      <div
        style={{
          marginTop: "auto",
          padding: 14,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
        }}
      >
        <Btn
          variant="danger"
          size="sm"
          onClick={onDelete}
          disabled={isRoot}
          title={isRoot ? "Root group can't be deleted" : "Delete this group and its children"}
        >
          Delete
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn
          variant="outline"
          size="sm"
          onClick={onUngroup}
          disabled={isRoot}
          title={isRoot ? "Root group can't be ungrouped" : "Replace this group with its children"}
        >
          Ungroup
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onClose}>
          Close
        </Btn>
      </div>
    </DrawerContainer>
  );
}

// Phase E / Gap 21: BEFORE / AFTER preview when ungrouping a sub-group whose
// logic differs from its parent's. Cancel takes the autoFocus so a reflex
// `Enter` press is non-destructive; Ungroup is `outline`-styled (not primary)
// so muscle-memory doesn't fire it.
function UngroupConfirmModal({
  before,
  after,
  onCancel,
  onConfirm,
}: {
  before: string;
  after: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const T = useT();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <Modal onClose={onCancel} label="Ungroup this group?">
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
          Ungroup this group?
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 13,
            color: T.text2,
            lineHeight: 1.55,
          }}
        >
          The inner group's logic differs from its parent's, so flattening it
          changes how the strategy fires. Review the new expression below.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 1fr",
            gap: "10px 12px",
            alignItems: "baseline",
            marginBottom: 18,
            fontFamily: T.fontMono,
            fontSize: 12.5,
          }}
        >
          <div style={{ color: T.text3, letterSpacing: 0.6, textTransform: "uppercase", fontSize: 10 }}>
            Before
          </div>
          <div
            style={{
              color: T.text,
              padding: "10px 12px",
              background: T.surfaceLow,
              borderRadius: 8,
              border: `1px solid ${T.outlineFaint}`,
              wordBreak: "break-word",
            }}
          >
            {before}
          </div>
          <div style={{ color: T.text3, letterSpacing: 0.6, textTransform: "uppercase", fontSize: 10 }}>
            After
          </div>
          <div
            style={{
              color: T.text,
              padding: "10px 12px",
              background: T.surfaceLow,
              borderRadius: 8,
              border: `1px solid ${T.warning}55`,
              wordBreak: "break-word",
            }}
          >
            {after}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              background: T.primary,
              color: "#fff",
              border: `1px solid ${T.primary}`,
              borderRadius: 4,
              padding: "6px 12px",
              fontFamily: T.fontSans,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <Btn variant="outline" size="sm" onClick={onConfirm}>
            Ungroup
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// Phase E: cascade-delete confirmation. Fires only for groups with 2+ direct
// children — single-child / empty groups are low-stakes and skip the modal.
function DeleteGroupConfirmModal({
  childCount,
  onCancel,
  onConfirm,
}: {
  childCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const T = useT();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <Modal onClose={onCancel} label="Delete this group?">
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
          Delete this group?
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 13,
            color: T.text2,
            lineHeight: 1.55,
          }}
        >
          This removes the group and all {childCount} of its children from the
          strategy. You can undo only by reverting unsaved changes.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              background: T.primary,
              color: "#fff",
              border: `1px solid ${T.primary}`,
              borderRadius: 4,
              padding: "6px 12px",
              fontFamily: T.fontSans,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <Btn variant="danger" size="sm" onClick={onConfirm}>
            Delete group
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// B047 deploy modal — single-screen universe picker (sectors + explicit
// symbols + filters) before the strategy goes live. Risk block is hidden:
// risk lives on bots/backtests, not on the deploy.
function DeployUniverseModal({
  value,
  onChange,
  stocks,
  busy,
  onCancel,
  onConfirm,
}: {
  value: UniverseAndRiskValue;
  onChange: (next: UniverseAndRiskValue) => void;
  stocks: StockResponse[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const T = useT();
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) {
      if (s.sector_name && s.is_active) set.add(s.sector_name);
    }
    return Array.from(set).sort();
  }, [stocks]);
  const availableSymbols = useMemo(
    () =>
      stocks
        .filter((s) => s.is_active)
        .map((s) => ({ symbol: s.symbol, name: s.name }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [stocks],
  );
  const sectors = value.stock_filters?.sectors ?? [];
  const symbols = value.stock_symbols ?? [];
  const hasUniverse = sectors.length > 0 || symbols.length > 0;

  return (
    <Modal onClose={busy ? () => undefined : onCancel} label="Deploy strategy" width={720}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div
            style={{
              fontFamily: T.fontHead,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: -0.3,
              marginBottom: 6,
            }}
          >
            Deploy strategy
          </div>
          <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.55 }}>
            Pick the universe the signal scanner should watch. Without one,
            the strategy will stay deployed but no signals will fire.
          </p>
        </div>

        <UniverseAndRiskFields
          value={value}
          onChange={onChange}
          availableSectors={availableSectors}
          availableSymbols={availableSymbols}
          showRisk={false}
          disabled={busy}
        />

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            alignItems: "center",
            paddingTop: 8,
            borderTop: `1px solid ${T.outlineFaint}`,
          }}
        >
          {!hasUniverse && (
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 10.5,
                color: T.warning,
                marginRight: "auto",
              }}
            >
              no universe — scanner will stay quiet
            </span>
          )}
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Btn>
          <Btn
            variant="deploy"
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            icon={Icon.spark}
          >
            {busy ? "Deploying…" : "Deploy"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}


