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
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";
import type {
  ConditionLogic,
  ConditionValue,
  ExitRules,
  IndicatorMeta,
  Operator,
  PositionSizing,
  SingleCondition,
  StrategyResponse,
  StrategyUpdateBody,
  StrategyDependentBot,
  StrategyDependentsResponse,
} from "@/lib/api/strategies";
import {
  type CondId,
  type ConditionGroup,
  type ConditionLeaf,
  flattenLeaves,
  fromBackend,
  hasAnyLeaf,
  insertChild,
  leafCount,
  leafFromCond,
  findNode,
  findParent,
  normalizeWireGroup,
  removeNode,
  replaceNode,
  toBackend,
} from "@/lib/strategy/tree";

type SelKind = "condition" | "execution" | "group";
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
export function buildUpdateBody(
  name: string,
  tree: ConditionGroup,
  exit: ExitRules,
  sizing: PositionSizing,
): StrategyUpdateBody {
  return {
    name,
    entry_rules: { conditions: toBackend(tree) },
    exit_rules: {
      ...exit,
      conditions: exit.conditions ? normalizeWireGroup(exit.conditions) : exit.conditions,
    },
    position_sizing: sizing,
  };
}

function deriveUniverseLabel(s: StrategyResponse): string {
  if (s.stock_symbols && s.stock_symbols.length > 0) {
    if (s.stock_symbols.length <= 2) return s.stock_symbols.join(", ");
    return `${s.stock_symbols.length} symbols`;
  }
  if (s.stock_filters?.sectors && s.stock_filters.sectors.length > 0) {
    if (s.stock_filters.sectors.length === 1) return s.stock_filters.sectors[0];
    return `${s.stock_filters.sectors.length} sectors`;
  }
  return "KSE-100";
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
  const leaves = useMemo(() => flattenLeaves(tree), [tree]);
  const [exit, setExit] = useState<ExitRules>(initialStrategy.exit_rules);
  const [sizing, setSizing] = useState<PositionSizing>(initialStrategy.position_sizing);
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
  const router = useRouter();

  const universeLabel = deriveUniverseLabel(initialStrategy);

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

  // Performs the actual PUT. Split out so the impact-warning modal can call
  // it directly after confirmation, bypassing the pre-flight check.
  const performSave = async () => {
    if (!dirty || saveStatus === "saving") return;
    const body = buildUpdateBody(name, tree, exit, sizing);
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/strategies/${initialStrategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed (${res.status})`);
      }
      setSavedAt(Date.now());
      setDirty(false);
      setSaveStatus("idle");
      setFlash("Draft saved");
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

  const handleValidate = () => {
    const n = leafCount(tree);
    setFlash(`Strategy is valid · ${n} condition${n === 1 ? "" : "s"} connected`);
  };

  const handleDeploy = async () => {
    const next = !deployed;
    // Optimistic flip; revert on failure.
    setDeployed(next);
    try {
      const res = await fetch(`/api/strategies/${initialStrategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "ACTIVE" : "PAUSED" }),
      });
      if (!res.ok) throw new Error(`Status update failed (${res.status})`);
      setSavedAt(Date.now());
      setFlash(next ? "Strategy deployed · live signal feed active" : "Strategy paused · signals halted");
    } catch (err) {
      setDeployed(!next);
      setFlash(err instanceof Error ? err.message : "Status update failed");
    }
  };

  const handleRestoreVersion = (label: string) => {
    setSavedAt(Date.now());
    setFlash(`Restored ${label}`);
  };

  // Create-mode wiring — clicking "+ condition" stages a draft cond and the
  // parent group it should be appended to. Save appends, Close cancels.
  // Phase B's corner pill always targets the root; Phase D's inline `+`
  // slots will pass nested group ids.
  const [creating, setCreating] = useState<{ parentId: CondId; cond: SingleCondition } | null>(null);
  const handleAddCondition = (parentId: CondId = tree.id) => {
    setSelection(null);
    setCreating({
      parentId,
      cond: {
        kind: "condition",
        indicator: "rsi",
        operator: "<",
        value: { type: "constant", value: 50 },
        params: null,
      },
    });
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

  const handleToggleRootLogic = () => {
    setTree((t) => ({ ...t, logic: t.logic === "AND" ? "OR" : "AND" }));
    setDirty(true);
  };

  const selectedLeaf: ConditionLeaf | null = (() => {
    if (selection?.kind !== "condition") return null;
    const node = findNode(tree, selection.id);
    if (!node || node.kind !== "condition") return null;
    return node;
  })();

  return (
    <AppFrame route="/strategies">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          name={name}
          slug={String(initialStrategy.id)}
          universe={universeLabel}
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
            leaves={leaves}
            logic={tree.logic}
            selection={selection}
            onSelect={onSelect}
            onToggleLogic={handleToggleRootLogic}
            drawerOpen={selection !== null || creating !== null}
            deployed={deployed}
            onValidate={handleValidate}
            onDeploy={handleDeploy}
            onAddCondition={() => handleAddCondition(tree.id)}
            strategyId={initialStrategy.id}
          />
          {creating && (
            <ConditionDrawer
              key="create"
              cond={creating.cond}
              displayName="New condition"
              indicatorMeta={indicatorMeta}
              onApply={(nextCond) => {
                const leaf = leafFromCond(nextCond);
                setTree((t) => insertChild(t, creating.parentId, leaf));
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
          {selection?.kind === "execution" && (
            <ExecutionDrawer
              exit={exit}
              sizing={sizing}
              onApply={(nextExit, nextSizing) => {
                setExit(nextExit);
                setSizing(nextSizing);
                setDirty(true);
                close();
                setFlash("Saved · Execution");
              }}
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
  universe,
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
  universe: string;
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
          <span
            style={{
              color: T.text3,
              fontFamily: T.fontMono,
              fontSize: 13,
              fontWeight: 400,
              marginLeft: 14,
              display: isMobile ? "block" : "inline",
            }}
          >
            · {universe}
          </span>
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
  leaves,
  logic,
  selection,
  onSelect,
  onToggleLogic,
  drawerOpen,
  deployed,
  onValidate,
  onDeploy,
  onAddCondition,
  strategyId,
}: {
  leaves: ConditionLeaf[];
  logic: ConditionLogic;
  selection: Selection;
  onSelect: (kind: SelKind, id: CondId) => void;
  onToggleLogic: () => void;
  drawerOpen: boolean;
  deployed: boolean;
  onValidate: () => void;
  onDeploy: () => void;
  onAddCondition: () => void;
  strategyId: number;
}) {
  const isSelected = (kind: SelKind, id: CondId) =>
    selection?.kind === kind && selection.id === id;
  const T = useT();
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
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

  const resetView = () => {
    setPan({ x: 40, y: 20 });
    setZoom(1);
  };

  return (
    <div
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
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
          // Geometry derived from `leaves.length` so the canvas reshapes when
          // conditions are added/removed. Y values centered on the gate glyph;
          // with a single leaf the gate is hidden and the condition wires
          // directly into ExecNode. Phase B still flattens the tree for
          // rendering — Phase C is the boxed-group visual rewrite.
          const NODE_X = 40;
          const NODE_W = 200;
          const NODE_H = 108;
          const NODE_Y0 = 40;
          const NODE_GAP = 120;
          const condTopY = (i: number) => NODE_Y0 + i * NODE_GAP;
          const condPinY = (i: number) => condTopY(i) + NODE_H / 2;
          const N = leaves.length;
          const gateY = N > 0 ? (condPinY(0) + condPinY(N - 1)) / 2 : 200;
          const showGate = N > 1;
          const execY = gateY - 54;
          const execPinY = gateY;
          const out1Y = gateY - 224; // Backtest pin at gateY-204
          const out2Y = gateY - 36;  // Live signals pin at gateY-16
          const out3Y = gateY + 136; // Automate pin at gateY+156
          const gateBlockX = 410;
          const gateBlockW = 110;
          const condRightX = NODE_X + NODE_W;
          const gateLeftX = 385;
          const gateRightX = 545;
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
                {leaves.map((leaf, i) => {
                  const cy = condPinY(i);
                  const tx = showGate ? gateLeftX : 620;
                  const ty = showGate ? gateY : execPinY;
                  const midX = condRightX + 80;
                  return (
                    <Connector
                      key={leaf.id}
                      d={`M ${condRightX} ${cy} C ${midX} ${cy} ${midX} ${ty} ${tx} ${ty}`}
                      dashed
                      T={T}
                    />
                  );
                })}
                {showGate && (
                  <Connector
                    d={`M ${gateRightX} ${gateY} C 585 ${gateY} 585 ${execPinY} 620 ${execPinY}`}
                    color={T.primaryLight}
                    width={2}
                    T={T}
                  />
                )}
                <Connector
                  d={`M 860 ${execPinY} C 870 ${execPinY} 870 ${out1Y + 20} 880 ${out1Y + 20}`}
                  color={T.primary}
                  width={1.3}
                  T={T}
                />
                <Connector
                  d={`M 860 ${execPinY} C 870 ${execPinY} 870 ${out2Y + 20} 880 ${out2Y + 20}`}
                  color={T.deploy}
                  width={1.6}
                  T={T}
                />
                <Connector
                  d={`M 860 ${execPinY} C 870 ${execPinY} 870 ${out3Y + 20} 880 ${out3Y + 20}`}
                  color={T.accent}
                  width={1.3}
                  T={T}
                />
              </svg>

              {leaves.map((leaf, i) => {
                const meta = condToMeta(leaf.cond);
                return (
                  <CondNode
                    key={leaf.id}
                    x={NODE_X}
                    y={condTopY(i)}
                    {...meta}
                    selected={isSelected("condition", leaf.id)}
                    onClick={() => onSelect("condition", leaf.id)}
                  />
                );
              })}

              {showGate && (
                <button
                  type="button"
                  onClick={onToggleLogic}
                  aria-label={`Toggle gate logic (currently ${logic})`}
                  title={`Click to toggle ${logic === "AND" ? "→ OR" : "→ AND"}`}
                  style={{
                    position: "absolute",
                    left: gateBlockX,
                    top: gateY - gateBlockW / 2,
                    width: gateBlockW,
                    height: gateBlockW,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <GateGlyph logic={logic} size={68} />
                </button>
              )}

              <ExecNode
                x={620}
                y={execY}
                selected={isSelected("execution", "exec")}
                onClick={() => onSelect("execution", "exec")}
              />

              <OutputPin
                x={880}
                y={out1Y}
                tint={T.primary}
                glyph="⎈"
                title="Backtest"
                status="+14.2%"
                statusColor={T.gain}
                sub="last run 2m ago"
                href={`/backtest?strategy_id=${strategyId}`}
              />
              <OutputPin
                x={880}
                y={out2Y}
                tint={deployed ? T.deploy : T.text3}
                glyph="◉"
                title="Live signals"
                status={deployed ? "Deployed" : "Paused"}
                statusColor={deployed ? T.deploy : T.text3}
                sub={deployed ? "3 today · 100 scanned" : "feed halted"}
                emphasized={deployed}
                href="/signals"
              />
              <OutputPin
                x={880}
                y={out3Y}
                tint={T.accent}
                glyph="◇"
                title="Automate"
                status="No bot"
                statusColor={T.text3}
                sub="bind for paper trading"
                href={`/bots/new?strategy_id=${strategyId}`}
              />
            </>
          );
        })()}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 76,
          left: 24,
          display: "flex",
          gap: 6,
          zIndex: 5,
        }}
      >
        <AddPill onClick={onAddCondition}>condition</AddPill>
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

      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          padding: 6,
          background: T.surface2 + "e6",
          backdropFilter: "blur(10px)",
          borderRadius: 999,
          boxShadow: `0 10px 40px -10px rgba(0,0,0,0.6), 0 0 0 1px ${T.outlineFaint}`,
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <Btn variant="ghost" size="sm" onClick={onValidate}>
          Validate
        </Btn>
        <div style={{ width: 1, height: 20, background: T.outlineFaint }} />
        <Link href={`/backtest?strategy_id=${strategyId}&run=1`} style={{ textDecoration: "none" }}>
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

function ExecNode({ x, y, selected, onClick }: { x: number; y: number; selected?: boolean; onClick?: () => void }) {
  const T = useT();
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
        width: 240,
        height: 108,
        background: T.surfaceLow,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: onClick ? "pointer" : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${T.accent}, 0 10px 30px -10px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${T.outlineFaint}, 0 4px 14px -8px rgba(0,0,0,0.5)`,
        borderLeft: `3px solid ${T.accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.accent,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: 2, background: T.accent }} />
        execution
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 16,
          fontWeight: 500,
          color: T.text,
          marginTop: 6,
          letterSpacing: -0.2,
        }}
      >
        Buy · <span style={{ fontStyle: "italic", color: T.accent }}>10%</span> of book
      </div>
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.text3,
          marginTop: 6,
          display: "flex",
          gap: 10,
        }}
      >
        <span>
          SL <span style={{ color: T.loss }}>5%</span>
        </span>
        <span>
          TP <span style={{ color: T.gain }}>15%</span>
        </span>
        <span>
          hold <span style={{ color: T.text2 }}>21d</span>
        </span>
      </div>
      <Pin x={-4} y={50} color={T.primaryLight} />
      <Pin x={236} y={50} color={T.accent} />
    </div>
  );
}

function OutputPin({
  x,
  y,
  tint,
  glyph,
  title,
  status,
  statusColor,
  sub,
  emphasized,
  href,
}: {
  x: number;
  y: number;
  tint: string;
  glyph: string;
  title: string;
  status: string;
  statusColor: string;
  sub: string;
  emphasized?: boolean;
  href?: string;
}) {
  const T = useT();
  const body = (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 180,
        padding: "12px 14px",
        background: T.surfaceLow,
        borderRadius: 10,
        textDecoration: "none",
        boxShadow: emphasized
          ? `0 0 0 1px ${tint}88, 0 0 0 4px ${tint}18, 0 6px 24px -10px rgba(0,0,0,0.55)`
          : `0 0 0 1px ${T.outlineFaint}, 0 4px 14px -8px rgba(0,0,0,0.5)`,
      }}
    >
      <Pin x={-4} y={20} color={tint} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: tint + "22",
            color: tint,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: T.fontHead,
            fontSize: 13,
          }}
        >
          {glyph}
        </span>
        <span style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500, color: T.text }}>
          {title}
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 12,
        }}
      >
        {emphasized && <StatusDot color={statusColor} pulse />}
        <span style={{ color: statusColor, fontVariantNumeric: "tabular-nums" }}>{status}</span>
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, marginTop: 3 }}>
        {sub}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

function AddPill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 11.5,
        color: T.text3,
        background: T.surface2 + "cc",
        border: `1px dashed ${T.outlineVariant}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: T.fontMono,
        backdropFilter: "blur(6px)",
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        (e.currentTarget as HTMLButtonElement).style.color = T.text2;
        (e.currentTarget as HTMLButtonElement).style.borderStyle = "solid";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = T.text3;
        (e.currentTarget as HTMLButtonElement).style.borderStyle = "dashed";
      }}
    >
      + {children}
    </button>
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
const OPERATOR_OPTIONS: { value: Operator; label: string }[] = [
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: "==", label: "=" },
  { value: "crosses_above", label: "×↑" },
  { value: "crosses_below", label: "×↓" },
];
const COMPARE_MODES: CompareMode[] = ["Constant", "Indicator"];

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
          <Combobox
            label="indicator"
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
            <Kicker>period</Kicker>
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
          <Kicker>operator</Kicker>
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
          <Kicker>compared to</Kicker>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {COMPARE_MODES.map((t) => {
              const active = compareMode === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCompareMode(t)}
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


type ExitKey = "stopLoss" | "takeProfit" | "trailingStop" | "maxHolding";

// "5%" / "5" → 5, "" / "—" → null. Bounded to [0, 100] to match backend
// validators (stop_loss_pct etc are pct floats). parseDays is similar but
// integers only and unbounded above.
function parsePct(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function parseDays(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function fmtPct(n: number | null | undefined): string {
  return n == null ? "5%" : `${n}%`;
}

function fmtDays(n: number | null | undefined): string {
  return n == null ? "21 days" : `${n} days`;
}

// Controlled ExecutionDrawer — Direction (long-only) and Exit-signal (no
// separate exit tree in the data model) are intentionally hidden in PR-1.
// Sizing maps to position_sizing.value (assumes fixed_percent, see ADR-10).
function ExecutionDrawer({
  exit,
  sizing,
  onApply,
  onClose,
}: {
  exit: ExitRules;
  sizing: PositionSizing;
  onApply: (nextExit: ExitRules, nextSizing: PositionSizing) => void;
  onClose: () => void;
}) {
  const T = useT();
  const [sizingPct, setSizingPct] = useState<number>(() =>
    Math.max(0, Math.min(100, Math.round(sizing.value)))
  );
  const [exits, setExits] = useState<Record<ExitKey, { on: boolean; value: string }>>(() => ({
    stopLoss: {
      on: exit.stop_loss_pct != null,
      value: fmtPct(exit.stop_loss_pct),
    },
    takeProfit: {
      on: exit.take_profit_pct != null,
      value: fmtPct(exit.take_profit_pct),
    },
    trailingStop: {
      on: exit.trailing_stop_pct != null,
      value: fmtPct(exit.trailing_stop_pct),
    },
    maxHolding: {
      on: exit.max_holding_days != null,
      value: fmtDays(exit.max_holding_days),
    },
  }));

  const slider = useSliderDrag((pct) => setSizingPct(Math.round(pct * 100)));

  const toggleExit = (k: ExitKey) =>
    setExits((prev) => ({ ...prev, [k]: { ...prev[k], on: !prev[k].on } }));
  const setExitValue = (k: ExitKey, v: string) =>
    setExits((prev) => ({ ...prev, [k]: { ...prev[k], value: v } }));

  const handleSave = () => {
    const nextExit: ExitRules = {
      ...exit,
      stop_loss_pct: exits.stopLoss.on ? parsePct(exits.stopLoss.value) : null,
      take_profit_pct: exits.takeProfit.on ? parsePct(exits.takeProfit.value) : null,
      trailing_stop_pct: exits.trailingStop.on ? parsePct(exits.trailingStop.value) : null,
      max_holding_days: exits.maxHolding.on ? parseDays(exits.maxHolding.value) : null,
    };
    const nextSizing: PositionSizing = {
      ...sizing,
      value: sizingPct,
    };
    onApply(nextExit, nextSizing);
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
        <Kicker color={T.accent}>execution node</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.4,
          }}
        >
          Position <span style={{ fontStyle: "italic", color: T.accent }}>sizing</span> &amp; exits
        </h2>
      </div>
      <div style={{ flex: 1, overflowX: "hidden", overflowY: "auto", padding: 22, paddingTop: 14 }}>
        <Ribbon kicker="sizing" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline" }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={sizingPct}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                if (digits === "") {
                  setSizingPct(0);
                  return;
                }
                const n = Number(digits);
                if (Number.isFinite(n)) setSizingPct(Math.max(0, Math.min(100, n)));
              }}
              style={{
                fontFamily: T.fontHead,
                fontSize: 54,
                color: T.text,
                letterSpacing: -1,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                background: "transparent",
                border: "none",
                padding: 0,
                width: 90,
              }}
            />
            <span
              style={{
                fontFamily: T.fontHead,
                fontSize: 54,
                color: T.text,
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              %
            </span>
          </div>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            of portfolio per trade
          </span>
        </div>
        <div
          ref={slider.trackRef}
          onPointerDown={slider.onPointerDown}
          onPointerMove={slider.onPointerMove}
          onPointerUp={slider.onPointerUp}
          onPointerCancel={slider.onPointerUp}
          style={{
            marginTop: 14,
            position: "relative",
            height: 18,
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
              height: 6,
              borderRadius: 3,
              background: T.surface3,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${sizingPct}%`,
                background: T.accent,
                borderRadius: 3,
                transition: "width 80ms linear",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: `${sizingPct}%`,
              top: "50%",
              width: 16,
              height: 16,
              borderRadius: 8,
              background: T.accent,
              transform: "translate(-8px, -8px)",
              boxShadow: `0 0 0 3px ${T.accent}33`,
            }}
          />
        </div>

        <Ribbon kicker="exits" />
        <ExitRow
          label="Stop loss"
          value={exits.stopLoss.value}
          color={T.loss}
          on={exits.stopLoss.on}
          onToggle={() => toggleExit("stopLoss")}
          onValueChange={(v) => setExitValue("stopLoss", v)}
        />
        <ExitRow
          label="Take profit"
          value={exits.takeProfit.value}
          color={T.gain}
          on={exits.takeProfit.on}
          onToggle={() => toggleExit("takeProfit")}
          onValueChange={(v) => setExitValue("takeProfit", v)}
        />
        <ExitRow
          label="Trailing stop"
          value={exits.trailingStop.value}
          on={exits.trailingStop.on}
          onToggle={() => toggleExit("trailingStop")}
          onValueChange={(v) => setExitValue("trailingStop", v)}
        />
        <ExitRow
          label="Max holding"
          value={exits.maxHolding.value}
          on={exits.maxHolding.on}
          onToggle={() => toggleExit("maxHolding")}
          onValueChange={(v) => setExitValue("maxHolding", v)}
        />

        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 8,
            background: T.warning + "10",
            fontSize: 11.5,
            color: T.text2,
            lineHeight: 1.55,
            display: "flex",
            gap: 8,
          }}
        >
          <span style={{ color: T.warning }}>{Icon.warn}</span>
          <span>
            With {sizingPct}% per trade and 5 concurrent positions, up to {Math.min(100, sizingPct * 5)}%
            of portfolio can be deployed.
          </span>
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
        <div style={{ flex: 1 }} />
        <Btn variant="primary" size="sm" onClick={handleSave}>
          Apply
        </Btn>
      </div>
    </DrawerContainer>
  );
}

function ExitRow({
  label,
  value,
  color,
  on,
  onToggle,
  onValueChange,
}: {
  label: string;
  value: string;
  color?: string;
  on: boolean;
  onToggle: () => void;
  onValueChange?: (v: string) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: `1px dotted ${T.outlineFaint}`,
        opacity: on ? 1 : 0.5,
        transition: "opacity 140ms",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        aria-label={label}
        style={{
          width: 36,
          height: 24,
          borderRadius: 12,
          background: "transparent",
          position: "relative",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "5px 5px",
            borderRadius: 7,
            background: on ? T.accent : T.surface3,
            transition: "background 140ms",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 7,
            left: on ? 18 : 7,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: "#fff",
            transition: "left 140ms",
          }}
        />
      </button>
      <span style={{ fontFamily: T.fontSans, fontSize: 12.5, color: T.text, flex: 1 }}>
        {label}
      </span>
      {onValueChange && on ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          style={{
            fontFamily: T.fontMono,
            fontSize: 12.5,
            color: color || T.text2,
            fontVariantNumeric: "tabular-nums",
            background: "transparent",
            border: "none",
            padding: 0,
            width: 80,
            textAlign: "right",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: T.fontMono,
            fontSize: 12.5,
            color: color || T.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

