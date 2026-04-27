// In-memory condition-tree model for the strategy editor.
//
// The wire shape (`@/lib/api/strategies`'s `ConditionGroup` / `SingleCondition`)
// is what the backend stores. The editor wraps it with stable client-side IDs
// so React keys and selection state stay consistent across edits — the IDs are
// generated once at hydrate time and never sent back to the server.
//
// All mutating helpers are immutable (return a new tree). Trees are bounded
// in size by user authoring (hundreds of nodes max), so structural sharing
// would be premature — full clones per edit are simpler and fast enough.

import type {
  ConditionGroup as ConditionGroupWire,
  ConditionLogic,
  SingleCondition,
} from "@/lib/api/strategies";

export type CondId = string;

export interface ConditionLeaf {
  kind: "condition";
  id: CondId;
  cond: SingleCondition;
}

export interface ConditionGroup {
  kind: "group";
  id: CondId;
  logic: ConditionLogic;
  children: ConditionNode[];
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

// Mirrors backend MAX_CONDITION_DEPTH in app/schemas/strategy.py — the
// validator there rejects depth > 32, and so do we client-side once Phase E
// lands group editing. Kept in sync manually; if the backend constant moves,
// update both.
export const MAX_CONDITION_DEPTH = 32;

// ── ID generation ──────────────────────────────────────────────────────

// Prefixed UUIDs so trees show up readable in React DevTools. Falls back to
// a Math.random-based ID in the (vanishingly rare) environment without
// `crypto.randomUUID` — good enough for a key inside a single editor session.
export function newId(prefix: "c" | "g"): CondId {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${uuid}`;
}

// ── Read helpers ───────────────────────────────────────────────────────

export function findNode(
  root: ConditionGroup,
  id: CondId,
): ConditionNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    if (child.id === id) return child;
    if (child.kind === "group") {
      const hit = findNode(child, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function findParent(
  root: ConditionGroup,
  id: CondId,
): ConditionGroup | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    if (child.kind === "group") {
      const hit = findParent(child, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function depth(root: ConditionGroup): number {
  let max = 1;
  for (const child of root.children) {
    if (child.kind === "group") {
      const d = 1 + depth(child);
      if (d > max) max = d;
    }
  }
  return max;
}

export function leafCount(root: ConditionGroup): number {
  let n = 0;
  for (const child of root.children) {
    if (child.kind === "condition") n += 1;
    else n += leafCount(child);
  }
  return n;
}

export function hasAnyLeaf(root: ConditionGroup): boolean {
  return leafCount(root) > 0;
}

// Flatten leaves left-to-right (depth-first). Phase B's canvas still
// renders a flat list — this is how it walks the tree until Phase C
// introduces real boxed-group rendering.
export function flattenLeaves(root: ConditionGroup): ConditionLeaf[] {
  const out: ConditionLeaf[] = [];
  const visit = (g: ConditionGroup) => {
    for (const child of g.children) {
      if (child.kind === "condition") out.push(child);
      else visit(child);
    }
  };
  visit(root);
  return out;
}

// ── Mutating helpers (immutable) ───────────────────────────────────────

export function insertChild(
  root: ConditionGroup,
  parentId: CondId,
  child: ConditionNode,
  index?: number,
): ConditionGroup {
  return mapGroups(root, (g) => {
    if (g.id !== parentId) return g;
    const at = index === undefined ? g.children.length : index;
    const next = g.children.slice();
    next.splice(at, 0, child);
    return { ...g, children: next };
  });
}

export function removeNode(root: ConditionGroup, id: CondId): ConditionGroup {
  if (root.id === id) {
    // Removing the root collapses to an empty AND group — entry-rules
    // validation will catch the missing-leaf case at save time.
    return { ...root, children: [] };
  }
  return mapGroups(root, (g) => {
    if (!g.children.some((c) => c.id === id)) return g;
    return { ...g, children: g.children.filter((c) => c.id !== id) };
  });
}

export function replaceNode(
  root: ConditionGroup,
  id: CondId,
  next: ConditionNode,
): ConditionGroup {
  if (root.id === id && next.kind === "group") return next;
  return mapGroups(root, (g) => {
    if (!g.children.some((c) => c.id === id)) return g;
    return {
      ...g,
      children: g.children.map((c) => (c.id === id ? next : c)),
    };
  });
}

export function setGroupLogic(
  root: ConditionGroup,
  id: CondId,
  logic: ConditionLogic,
): ConditionGroup {
  if (root.id === id) return { ...root, logic };
  return mapGroups(root, (g) => (g.id === id ? { ...g, logic } : g));
}

// Walks every group in the tree, returning a new tree with `transform`
// applied to each group bottom-up. Leaves pass through unchanged. Returns
// the original reference when `transform` is a no-op so React can skip
// re-renders on touch-but-no-change paths (e.g. setGroupLogic on a node
// whose logic already matches).
function mapGroups(
  group: ConditionGroup,
  transform: (g: ConditionGroup) => ConditionGroup,
): ConditionGroup {
  let changed = false;
  const nextChildren: ConditionNode[] = group.children.map((child) => {
    if (child.kind !== "group") return child;
    const mapped = mapGroups(child, transform);
    if (mapped !== child) changed = true;
    return mapped;
  });
  const intermediate = changed ? { ...group, children: nextChildren } : group;
  const out = transform(intermediate);
  return out;
}

// ── Hydrate / serialize ────────────────────────────────────────────────

// Wire-shape children may arrive without `kind` (if anything ever bypasses
// the backend's read-time normalizer); use the structural tell — `logic` →
// group, otherwise leaf — exactly the same heuristic the backend's
// `_backfill` migration uses.
function isWireGroup(node: unknown): node is ConditionGroupWire {
  return typeof node === "object" && node !== null && "logic" in node;
}

export function fromBackend(group: ConditionGroupWire): ConditionGroup {
  return {
    kind: "group",
    id: newId("g"),
    logic: group.logic,
    children: group.conditions.map((child) => {
      if (isWireGroup(child)) return fromBackend(child);
      return {
        kind: "condition",
        id: newId("c"),
        cond: {
          kind: "condition",
          indicator: child.indicator,
          operator: child.operator,
          value: child.value,
          params: child.params ?? null,
        },
      };
    }),
  };
}

export function toBackend(root: ConditionGroup): ConditionGroupWire {
  return {
    kind: "group",
    logic: root.logic,
    conditions: root.children.map((child) => {
      if (child.kind === "group") return toBackend(child);
      return {
        kind: "condition",
        indicator: child.cond.indicator,
        operator: child.cond.operator,
        value: child.cond.value,
        params: child.cond.params ?? null,
      };
    }),
  };
}

// Recursively normalize a wire-shape group so every node carries its
// `kind` discriminator. Used for serializing the (un-edited) exit_rules
// tree on save — the editor doesn't manage exits as a tree state, but we
// still need to emit a strict-validation-clean payload after Phase A.
export function normalizeWireGroup(group: ConditionGroupWire): ConditionGroupWire {
  return {
    kind: "group",
    logic: group.logic,
    conditions: group.conditions.map((child) => {
      if (isWireGroup(child)) return normalizeWireGroup(child);
      return {
        kind: "condition",
        indicator: child.indicator,
        operator: child.operator,
        value: child.value,
        params: child.params ?? null,
      };
    }),
  };
}

// ── Convenience constructors ───────────────────────────────────────────

export function emptyGroup(logic: ConditionLogic = "AND"): ConditionGroup {
  return { kind: "group", id: newId("g"), logic, children: [] };
}

export function leafFromCond(cond: SingleCondition): ConditionLeaf {
  return {
    kind: "condition",
    id: newId("c"),
    cond: { ...cond, kind: "condition", params: cond.params ?? null },
  };
}
