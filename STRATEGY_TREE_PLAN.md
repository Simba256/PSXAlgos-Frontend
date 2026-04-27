# Strategy Condition Tree — Implementation Plan

> Created: 2026-04-27
> Status: Planned — awaiting approval before Phase A starts
> Scope: Replace the flat `logic + conditions[]` model with a recursive boolean tree of conditions and groups, with inline `+` insertion on the canvas. Spans backend (`psxDataPortal/backend`) and frontend (`psx-ui/app`).
> Sibling: `STRATEGY_EDITOR_WIRING_PLAN.md` (this is the next evolution of that editor).

---

## Why this exists

User request (verbatim, 2026-04-27):

> *"I want to have a complete tree like structure, and they can add conditions and nodes, and like it can be they have 2 groups and they individually `and` and their outputs go to an `or` and so on."*

i.e. a strategy should be expressible as an arbitrary boolean tree, not a single AND/OR over a flat list. Example target shape:

```
       ┌─ Cond A ─┐
       │         ├─ AND ─┐
       └─ Cond B ─┘      │
                         ├─ OR ──→ Exec
       ┌─ Cond C ─┐      │
       │         ├─ AND ─┘
       └─ Cond D ─┘
```

Today this can't be authored (canvas has only one global AND/OR gate) and can't be stored (schema is flat). This plan fixes both, plus replaces the corner "+ condition" pill with **inline `+` insertion points everywhere on the graph**.

---

## Decisions locked in (from 2026-04-27 conversation)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Arbitrary nesting depth.** No artificial cap. | Users will hit any cap eventually; recursion costs nothing extra at runtime. |
| 2 | **`+` adds an empty group**, then user fills it. No "wrap selection" flow in v1. | Simpler UX; no multi-select state to manage. |
| 3 | **Auto-layout, no drag-and-drop.** Node positions are deterministically computed from tree shape. | No manual positions to persist, no overlap-resolution code, layout is reproducible. |
| 4 | **Boxed groups** — each group renders as a rounded rectangle with its own gate glyph inside. | At arbitrary depth, explicit boundaries beat implicit indentation for legibility. |
| 5 | **Phased shipping**, one PR per phase. | Each phase is independently shippable and reviewable; backend lands first so the contract is solid. |

---

## Current state — what exists today

### Backend

- `backend/app/schemas/strategy.py:131-141` — `ConditionGroup = { logic: AND|OR, conditions: List[SingleCondition] }`. **Flat. One level. No nested groups.**
- `backend/app/schemas/strategy.py:139-141` — `EntryRules = { conditions: ConditionGroup }`. Exactly one group.
- `backend/app/services/backtesting/condition_evaluator.py:230-253` — `evaluate_condition_group()` iterates `group["conditions"]` and ANDs/ORs the booleans. **Iterates leaves only; does not recurse into child groups (because there are none).**
- Same evaluator is used by `signal_scanner.py`, `backtesting/engine.py`, and `trading_bot_engine.py`. One change ripples to all three.

### Frontend

- `psx-ui/app/app/strategies/[id]/editor-view.tsx:188-200` — state is `rules: RuleNode[]` (flat) and `logic: "AND" | "OR"` (single global).
- `:1238-1399` — Canvas paints conditions as a vertical stack on the left, an optional gate glyph in the middle (visible only when `rules.length > 1`), a single ExecNode on the right, three hardcoded OutputPins.
- `:1402-1413` — single `<AddPill>` at `bottom: 76, left: 24` is the only add affordance. Calls `onAddCondition` (`:350`) which stages a draft `SingleCondition` and opens the right-side `ConditionDrawer`.
- `:139-156` — serializer wraps the flat array as `{ logic, conditions: [...] }` for the backend.

The canvas already supports selection, drawer-driven editing, deletion, duplication, and the AND/OR gate toggle — **all of that infrastructure is reusable**.

---

## Target data model

### Recursive node type (shared shape, frontend mirror of backend)

```ts
type ConditionNode =
  | {
      kind: "condition";
      id: string;             // stable client id ("c1", "c2", ...) for React keys
      cond: SingleCondition;  // existing SingleCondition shape, unchanged
    }
  | {
      kind: "group";
      id: string;
      logic: "AND" | "OR";
      children: ConditionNode[]; // condition or group, in user-defined order
    };

type EntryRules = { conditions: ConditionNode }; // root is always a group
```

### Backwards compatibility (free)

The current flat shape `{ logic: "AND", conditions: [c1, c2, c3] }` is **already a valid depth-1 tree** under the new model: a root group of logic AND with three condition children. Existing strategies hydrate without migration.

When sending to the backend, the same is true in reverse: a depth-1 tree serializes to exactly the legacy JSON, so old consumers (signal scanner / backtester / bot engine) keep working through Phase A.

---

## Phase A — Backend recursive schema + evaluator

**Branch**: `feat/condition-tree-backend`
**Repo**: `psxDataPortal`
**Output**: 1 PR. Existing strategies and tests continue to pass; new tests added for nested cases.

### A1. Schema change

`backend/app/schemas/strategy.py:131`:

```python
class ConditionGroup(BaseModel):
    """Recursive: children are conditions OR sub-groups."""
    logic: ConditionLogic = ConditionLogic.AND
    conditions: List[Union["ConditionGroup", SingleCondition]]
```

- Use **duck-typing** (presence of `logic` key ⇒ group, otherwise leaf). No `kind` field added to stored JSON. Pydantic v2's `Union[ConditionGroup, SingleCondition]` resolves cleanly because `SingleCondition` requires `indicator/operator/value` and would reject any payload with `logic`. (See Resolved Question 1.)
- Migrate existing in-database strategies? **No** — old shape (`SingleCondition[]`) is still valid because the union accepts it. Pydantic happily parses old JSON as `List[SingleCondition]`.
- Verify with one round-trip test of every existing strategy fixture.

### A2. Evaluator change

`backend/app/services/backtesting/condition_evaluator.py:230`:

```python
@staticmethod
def evaluate_condition_group(group, current_data, previous_data) -> bool:
    logic = group.get("logic", "AND").upper()
    children = group.get("conditions", [])
    if not children:
        return True

    results = []
    for child in children:
        if "logic" in child:                      # nested group
            results.append(
                ConditionEvaluator.evaluate_condition_group(
                    child, current_data, previous_data
                )
            )
        else:                                     # leaf condition
            results.append(
                ConditionEvaluator.evaluate_single_condition(
                    child, current_data, previous_data
                )
            )

    if logic == "AND":
        return all(results)
    if logic == "OR":
        return any(results)
    logger.warning(f"Unknown logic operator: {logic}")
    return False
```

Short-circuit eval (`all(...)` / `any(...)` are already short-circuiting in Python over generators — keep using them on the materialized list since recursion may be cheap).

### A3. Tests

Add to `backend/tests/services/test_condition_evaluator.py`:

- depth-2 nested tree: `(A AND B) OR (C AND D)` — verify all four truth-table combinations
- depth-3 nested tree: `((A AND B) OR C) AND D` — verify edge cases
- legacy flat shape still evaluates identically
- empty group at any depth returns `True`

### A4. Done when

- [ ] Schema PR opens, all 423+ existing backend tests still green
- [ ] New evaluator tests green
- [ ] Manual round-trip: load a Phase-A-built nested strategy via `/api/strategies/{id}`, save, reload — JSON identical

**Phase A does NOT touch any frontend code.** The legacy frontend continues to send flat trees and the backend keeps accepting them.

---

## Phase B — Frontend tree state + serialization

**Branch**: `feat/condition-tree-frontend-state`
**Repo**: `psx-ui`
**Output**: 1 PR. Canvas still renders flat (Phase C is the visual change). This phase only swaps the in-memory model.

### B1. New types

New file `psx-ui/app/lib/strategy/tree.ts`:

```ts
import type { SingleCondition, ConditionLogic } from "@/lib/api/strategies";

export type CondId = string;

export type ConditionLeaf = {
  kind: "condition";
  id: CondId;
  cond: SingleCondition;
};

export type ConditionGroup = {
  kind: "group";
  id: CondId;
  logic: ConditionLogic;
  children: ConditionNode[];
};

export type ConditionNode = ConditionLeaf | ConditionGroup;

// Helpers
export function newId(prefix: "c" | "g"): CondId { ... }
export function findNode(root: ConditionGroup, id: CondId): ConditionNode | null;
export function findParent(root: ConditionGroup, id: CondId): ConditionGroup | null;
export function insertChild(root: ConditionGroup, parentId: CondId, child: ConditionNode, index?: number): ConditionGroup;
export function removeNode(root: ConditionGroup, id: CondId): ConditionGroup;
export function replaceNode(root: ConditionGroup, id: CondId, next: ConditionNode): ConditionGroup;
export function depth(root: ConditionGroup): number;
export function leafCount(root: ConditionGroup): number;
```

All ops are **immutable** (return a new tree). Trees are small (bounded by user authoring, hundreds of nodes max), so structural sharing is unnecessary — full clones per edit are fine.

### B2. Hydrate / serialize

```ts
// Tolerate both legacy flat and new nested
export function fromBackend(rules: EntryRulesResponse): ConditionGroup;
export function toBackend(root: ConditionGroup): EntryRulesPayload;
```

`fromBackend` recognizes a flat list (no `logic` field on children) and wraps it as a depth-1 group. `toBackend` always emits the nested form; if the tree happens to be depth-1, the JSON is byte-identical to the legacy shape.

Unit-test the round-trip: every existing strategy fixture round-trips byte-for-byte.

### B3. Editor state swap

In `editor-view.tsx`:

- Replace `rules: RuleNode[]` + `logic` with `tree: ConditionGroup` (the root).
- Replace `setRules` / `setLogic` callsites with tree mutations via the helpers from B1.
- `selection` becomes `{ kind: "condition" | "group" | "execution"; id: CondId } | null`.
- `handleAddCondition` becomes `handleAddCondition(parentId)` — appends to a specific group. The temporary corner pill keeps calling it with `parentId = root.id` for now.
- `handleDeleteRule` becomes `handleDeleteNode(id)` — removes any node, cascades children.
- The flat-list canvas keeps rendering by **flattening** the tree: walk leaves left-to-right and lay them out as today. The gate visual derives from `tree.logic`. **Visually nothing changes** — Phase C is the visual rewrite.

### B4. Done when

- [ ] All existing strategies hydrate, edit, save, and round-trip identically
- [ ] Build / lint / typecheck green
- [ ] `npm run build` succeeds, smoke test on `/strategies/6` shows no regression

---

## Phase C — Canvas re-layout (boxed groups, auto-layout)

**Branch**: `feat/condition-tree-canvas`
**Repo**: `psx-ui`
**Output**: 1 PR. Canvas now renders the actual tree with boxed groups. Still no inline `+` (Phase D).

### C1. Auto-layout algorithm

Bottom-up pass to compute each subtree's height (in pixels), then a top-down pass to place each node:

```
layout(node):
  if leaf:
    return { w: NODE_W, h: NODE_H }
  for c in children:
    sz[c] = layout(c)
  inner_h = sum(sz[c].h for c in children) + GAP * (n-1)
  inner_w = max(sz[c].w for c in children) + GATE_W + GROUP_PAD
  return { w: inner_w + 2*GROUP_PAD, h: inner_h + 2*GROUP_PAD + GROUP_LABEL_H }

place(node, x, y):
  if leaf:
    render CondNode at (x, y)
    return
  render GroupBox at (x, y, w, h) with logic label at top
  cy = y + GROUP_PAD + GROUP_LABEL_H
  for c in children:
    place(c, x + GROUP_PAD, cy)
    cy += sz[c].h + GAP
  render GateGlyph at (x + w - GROUP_PAD - GATE_W, vertical center of children)
  draw wires from each child's right pin → gate's left pin
  draw wire from gate → group's right pin (parent will consume)
```

Constants: `NODE_W=200, NODE_H=108, GAP=24, GROUP_PAD=18, GROUP_LABEL_H=22, GATE_W=68`.

The root group is always present but **rendered without its own box** when it has no siblings (i.e. at depth 0). Its gate sits in the same position the current global gate occupies. So strategies with no nested groups look almost identical to today — the change is invisible to existing users until they add a sub-group.

### C2. Group rendering

New component `<GroupBox>`:
- Rounded rectangle (`borderRadius: 14`, `border: 1px dashed T.outlineVariant`)
- Soft tinted background (`T.surfaceLow + "40"`)
- Top-left label: small uppercase `GROUP · AND` / `GROUP · OR` in `T.fontMono, fontSize: 10, color: T.text3`
- Click anywhere on the box border → selects the group → opens GroupDrawer (Phase E)

### C3. Wires

- Leaf condition → containing group's gate: existing dashed Bezier (`Connector` component already exists)
- Group's gate → containing parent's gate: solid Bezier in `T.primaryLight`
- Root gate → ExecNode: solid (today's wire, unchanged)

### C4. Selection ergonomics

- Click a leaf → select condition → open ConditionDrawer (existing)
- Click a group's box border → select group → open GroupDrawer (Phase E placeholder; for now just shows logic toggle)
- Click empty canvas → clear selection (existing)

### C5. Done when

- [ ] Strategies with no nested groups render visually identical to today
- [ ] Manually constructed depth-2 strategy (built via direct state mutation in dev) renders correctly with boxed inner group, inner gate, wires
- [ ] Pan/zoom still works
- [ ] No layout overlap regardless of tree shape

---

## Phase D — Inline `+` insertion

**Branch**: `feat/condition-tree-inline-add`
**Repo**: `psx-ui`
**Output**: 1 PR. The corner pill is removed; users author the tree via inline insertion.

### D1. Insertion slots

Every group exposes the following slots:

- **Between siblings** — `+` between each pair of adjacent children, vertically centered on the gap.
- **End of group** — `+` at the bottom of the children list.
- **(Optional) Wrap-empty-group** — if a group has zero children, render a single large `+` placeholder centered in the box.

Each slot is positioned absolutely in canvas coords using the same auto-layout pass that Phase C computed. The `+` is small (16px), `T.surface3` background, `T.text3` color, hover-reveal (opacity 0 → 1 within 80px of pointer).

### D2. Insertion picker

Click `+` → small floating popover with two choices:

```
┌─────────────────────┐
│  + Condition        │
│  + Empty group ▸    │  ← submenu picks AND or OR
└─────────────────────┘
```

- **Condition** → opens `ConditionDrawer` in create mode (existing flow), targeted at this slot. On Apply, leaf is inserted at that index in that group.
- **Empty group** → submenu (AND / OR), inserts an empty group at that index, auto-selects it, and immediately opens its own first-child picker (so the user is never left with a dangling empty group).

### D3. Remove the corner pill

Delete `<AddPill onClick={onAddCondition}>condition</AddPill>` at `editor-view.tsx:1412`. Delete `AddPill` if no other callers (verify with grep). The empty-canvas case is handled by Phase D's wrap-empty placeholder.

### D4. Empty-state UX

When `tree.children.length === 0`, the root group's box renders the wrap-empty placeholder with copy: *"Click `+` to add your first condition or group."*

### D5. Done when

- [ ] All authoring of new conditions and groups happens via inline `+`
- [ ] Pill is gone
- [ ] Newly created empty groups auto-prompt for first child
- [ ] Save round-trips correctly through Phase B serializer

---

## Phase E — Group editing

**Branch**: `feat/condition-tree-group-edit`
**Repo**: `psx-ui`
**Output**: 1 PR. Groups become first-class editable entities.

### E1. GroupDrawer

New right-side drawer mirroring `ConditionDrawer`'s shape. Sections:

- **Logic** — segmented control AND / OR (replaces the inline gate toggle for selected groups; toggle still works on the gate glyph for root)
- **Children summary** — read-only count: *"3 children — 2 conditions, 1 sub-group"*
- **Actions** —
  - **Ungroup** — replaces this group with its children in the parent. Disabled if this is the root.
  - **Delete** — removes the group and all descendants. Confirmation modal if it has 2+ children. Disabled if this is the root and removing it would leave the strategy with zero conditions (root must always exist; can be empty though).

### E2. Keyboard

- `Delete` / `Backspace` on a selected group → opens delete confirmation
- `Escape` → close drawer (existing)
- (Stretch) `Cmd/Ctrl+G` → wrap selection in a new group. **Out of scope for v1** (decision #2: no wrap-selection flow).

### E3. Validation

- Strategy must save with at least one leaf condition somewhere in the tree (existing rule, generalized).
- Empty groups are allowed during authoring but flagged with a soft warning on Save: *"Group 'X' is empty and will always evaluate to true."* Backend already treats empty groups as `True` (Phase A), so this is a UX hint, not a hard error.

### E4. Done when

- [ ] All group operations (rename of logic, ungroup, delete) work and persist
- [ ] Cascade delete works to arbitrary depth
- [ ] Empty-group warning surfaces on Save

---

## Cross-cutting concerns

### Performance

Trees are bounded by author intent — practically <100 nodes even for the most ambitious user. Full re-layout on every edit is fine; no need for incremental layout or memoization beyond `useMemo` on the rendered tree.

### Tests

- **Backend** (Phase A): nested evaluator unit tests, schema round-trip tests on all existing fixtures.
- **Frontend** (Phase B): `tree.ts` helper unit tests (`vitest`), `fromBackend` / `toBackend` round-trip tests on all existing strategies.
- **Frontend** (Phase C+): smoke tests via `npm run build` + manual run-through on `/strategies/6` with at least one tree built per phase.
- **Backtester / signal scanner / bot engine**: no new tests — they all consume `condition_evaluator`, so Phase A's tests cover them transitively.

### Documentation updates per phase

- Phase A → update `psxDataPortal/backend/BACKEND.md` (Condition schema section), `psxDataPortal/PROJECT_TRACKER.md`
- Phase B → update `psx-ui/PROJECT_TRACKER.md`, add a brief tree-helpers section to a frontend `lib/strategy/README.md` if absent
- Phase C → update `psx-ui/FRONTEND.md` if it exists (component architecture section)
- Phase D, E → `psx-ui/PROJECT_TRACKER.md`, mention in user-facing changelog if there is one

### Risks

| Risk | Mitigation |
|---|---|
| Existing strategies don't round-trip after schema change | Phase A fixture test on every fixture before merging |
| Nested evaluator regresses bot/signal/backtester | All three share `condition_evaluator`; Phase A unit tests cover the recursion |
| Auto-layout produces overlap at extreme depths | Layout is bottom-up — children's height bubbles up before parent placement; mathematically cannot overlap. Smoke-test depth 5+ manually. |
| `+` discoverability if hover-reveal is too subtle | Make the wrap-empty placeholder always-visible. For populated groups, `+` shows on group hover (not just pointer-proximity), so users always see one when their attention is on a group. |
| Users accidentally delete deep groups | Confirmation modal for groups with 2+ children (Phase E1). Existing soft-delete at the strategy level handles total-undo. |

### Out of scope

- Drag-and-drop reordering of nodes between groups
- Wrap-selection (multi-select 2+ siblings → "group these")
- Templates / presets containing nested trees (the wizard at `/strategies/new` keeps emitting flat trees for v1)
- Multiple ExecNodes / multiple Output pins (still hardcoded scaffolding)
- Visualizing tree depth in the strategies index (`/strategies` list)

---

## Phase rollout summary

| Phase | Repo | Files touched (approx) | Behavior change |
|---|---|---|---|
| **A** | `psxDataPortal` | `schemas/strategy.py`, `services/backtesting/condition_evaluator.py`, tests | None visible — backend now accepts nested trees, but no client sends them yet |
| **B** | `psx-ui` | `lib/strategy/tree.ts` (new), `editor-view.tsx`, `lib/api/strategies.ts` (types) | None visible — internal model swap |
| **C** | `psx-ui` | `editor-view.tsx`, new `<GroupBox>` component | Visual: existing strategies look identical, but the canvas now correctly renders nested trees if hand-built |
| **D** | `psx-ui` | `editor-view.tsx` | Authoring: corner pill replaced with inline `+` everywhere |
| **E** | `psx-ui` | `editor-view.tsx`, new `GroupDrawer` | Group rename / ungroup / cascade delete |

Each phase is independently shippable. Stop after any phase = working product, just less complete.

---

## Resolved questions (2026-04-27)

1. **JSON encoding** — duck-typing wins: a node is a group iff it has a `logic` key, otherwise it's a leaf condition. No `kind` field added to stored JSON. Existing strategies stay byte-identical on next save. **Robustness rationale**: any future tooling that reads stored rules — legacy migrations, ad-hoc SQL queries against the JSON column, third-party exports — will already work without knowing about a discriminator. The shape *is* the discriminator. Pydantic v2 union resolution still works (it tries each member of the union and accepts the first that validates; `SingleCondition` requires `indicator/operator/value` and rejects anything with `logic`, so disambiguation is unambiguous).
2. **Group name field** — deferred. Groups have only `logic + conditions[]` in v1. If users start authoring deep trees and want labels for legibility, adding an optional `name: string | null` later is purely additive (no migration, no UI breakage).
3. **Wide trees** — pan + zoom is the v1 answer. Deep/wide trees that exceed the viewport are pannable just like today's canvas. No collapse / minimap / fit-to-viewport features in v1.
