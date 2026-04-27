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

### Backwards compatibility

The current flat shape `{ logic: "AND", conditions: [c1, c2, c3] }` is **structurally a depth-1 tree** under the new model — a root group of logic AND with N condition children. Pydantic doesn't see it that way out of the box because the children lack the `kind` discriminator, so we add a **read-time normalizer** at the strategies router boundary:

```python
def _backfill_kind(node: dict) -> dict:
    if "logic" in node:
        node["kind"] = "group"
        node["conditions"] = [_backfill_kind(c) for c in node.get("conditions", [])]
    else:
        node["kind"] = "condition"
    return node
```

Run it once on the `entry_rules.conditions` (and `exit_rules.conditions` if present) before validation. From there everything goes through the normal Pydantic pipeline. On the next save, the normalized JSON (with `kind` fields) persists. Old consumers (signal scanner / backtester / bot engine) all read through the same normalizer, so they keep working seamlessly during the rollout.

---

## Phase A — Backend recursive schema + evaluator

**Branch**: `feat/condition-tree-backend`
**Repo**: `psxDataPortal`
**Output**: 1 PR. Existing strategies and tests continue to pass; new tests added for nested cases.

### A1. Schema change

`backend/app/schemas/strategy.py:123` and `:131`:

```python
class SingleCondition(BaseModel):
    """A single condition comparing an indicator to a value."""
    kind: Literal["condition"] = "condition"
    indicator: Indicator
    operator: Operator
    value: ConditionValue
    params: Optional[Dict[str, int]] = None


class ConditionGroup(BaseModel):
    """Recursive: children are conditions OR sub-groups."""
    kind: Literal["group"] = "group"
    logic: ConditionLogic = ConditionLogic.AND
    conditions: List[Annotated[
        Union["ConditionGroup", SingleCondition],
        Field(discriminator="kind"),
    ]]


ConditionGroup.model_rebuild()  # resolve forward ref
```

- **`ConditionGroup.model_rebuild()`** is required after class definition because of the recursive forward ref. Without it, validation raises `PydanticUndefinedAnnotation`. (Gap 2.)
- **Discriminator `kind`** routes Pydantic v2's union resolution directly (no trial-and-error per branch). Validation errors on malformed input now point at the correct schema instead of confusing the user with leaf-vs-group ambiguity. (See Resolved Question 1.)
- **No read-time normalizer.** Strict validation only. Legacy data is migrated once (Phase A3); all clients (editor + wizard) ship `kind` in their payloads. POSTs without `kind` return 422. (Gap 10.)
- **Depth ceiling.** Add a `@model_validator(mode="after")` on `EntryRules` and `ExitRules` that walks the tree and rejects depth > 32. Same validator enforces "at least one leaf condition exists somewhere in the tree" — strategies of all-empty-groups must not save (they'd evaluate to `True` and fire on every bar). (Gaps 1, 3.)
- **Empty `conditions: []`** is permitted at non-root depths (authoring flow needs it). The "at least one leaf" validator runs on the root only. (Gap 4.)
- Verify with one round-trip test of every existing strategy fixture: load (post-migration) → validate → re-serialize → values equal.

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

### A3. Data migration (Alembic) — critical-path

The `strategies.entry_rules` and `strategies.exit_rules` columns are `Column(JSON)` — no `ALTER TABLE` is needed since the column type doesn't change. Existing rows have the legacy shape (no `kind` fields). Since we deliberately do **not** ship a runtime normalizer (Gap 10), the migration is the **single mechanism** for transforming legacy data, and it must complete before the new app version starts serving traffic.

**Deploy ordering:**

1. **Frontend update lands first** (`/strategies/new` wizard emits `kind`; editor's `buildUpdateBody` emits `kind` — both shipped via the small Phase B.0 prep PR below). On the current backend, Pydantic ignores the unknown `kind` field, so this is a no-op on production behavior.
2. **Backend Phase A merges**, Railway runs the Alembic migration as a release command before swapping traffic. New app version with strict validation only sees migrated data.
3. **No window of mixed-shape traffic.** Migration completes atomically before the new app accepts requests.

**One-shot Alembic data migration** that walks every row and backfills `kind` so storage becomes homogeneous:

New migration `backend/alembic/versions/YYYYMMDD_NNNNNN_NNN_backfill_condition_kind.py`:

```python
"""backfill condition kind discriminator on strategy rules"""
from alembic import op
import sqlalchemy as sa
import json

revision = "..."
down_revision = "..."

def _backfill(node):
    if isinstance(node, dict):
        if "logic" in node and "kind" not in node:
            node["kind"] = "group"
        elif "indicator" in node and "kind" not in node:
            node["kind"] = "condition"
        for child in node.get("conditions", []) or []:
            _backfill(child)
    return node

def upgrade():
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, entry_rules, exit_rules FROM strategies")).fetchall()
    for row_id, entry, exit_ in rows:
        new_entry = _backfill(json.loads(entry) if isinstance(entry, str) else entry)
        new_exit = _backfill(json.loads(exit_) if isinstance(exit_, str) else exit_) if exit_ else None
        bind.execute(
            sa.text("UPDATE strategies SET entry_rules = :e, exit_rules = :x WHERE id = :id"),
            {"e": json.dumps(new_entry), "x": json.dumps(new_exit) if new_exit else None, "id": row_id},
        )

def downgrade():
    # Reversible: strip kind fields. Normalizer would re-add on next read,
    # but kept symmetric for completeness.
    bind = op.get_bind()
    def _strip(node):
        if isinstance(node, dict):
            node.pop("kind", None)
            for child in node.get("conditions", []) or []:
                _strip(child)
        return node
    rows = bind.execute(sa.text("SELECT id, entry_rules, exit_rules FROM strategies")).fetchall()
    for row_id, entry, exit_ in rows:
        bind.execute(
            sa.text("UPDATE strategies SET entry_rules = :e, exit_rules = :x WHERE id = :id"),
            {
                "e": json.dumps(_strip(json.loads(entry) if isinstance(entry, str) else entry)),
                "x": json.dumps(_strip(json.loads(exit_) if isinstance(exit_, str) else exit_)) if exit_ else None,
                "id": row_id,
            },
        )
```

- **Idempotent** — `_backfill` only adds `kind` if absent, so running the migration twice is a no-op on already-migrated rows.
- **Same code path on both Railway and local** — Alembic runs at deploy on Railway, manually on local DB before starting the new server.
- **No runtime normalizer to fall back on** (deliberate, Gap 10). If a row somehow ends up without `kind` post-migration (manual SQL, restored backup, etc.), reads will 422 — caught fast and loud rather than silently papered over.
- **Concurrency window.** Railway runs Alembic as a release command before traffic switches to the new deploy, so the migration completes before any new request hits. Local DB runs the migration manually before starting the new server. **No row-level locks needed**; migration is single-pass and bounded by the row count. (Gap 7.)
- **Rollback story.** If Phase A merges and we need to roll back: the OLD app code reads JSON and iterates `for cond in conditions:`, accessing `cond["indicator"]` etc. — it ignores any extra `kind` keys. So migrated data is forward-readable by the old app. Rollback is safe.
- **Cache safety.** Redis `get_cache()` only stores backtest job state (`backtest_job:{job_id}`), never strategy rules. No cache invalidation required. (Gap 24.)
- **Other tables**: confirmed `entry_rules` / `exit_rules` exist only on `strategies` — bots reference `strategy_id` and read live, backtests don't snapshot rules. Migration touches one table. (Gap 6.)

### A4. Tests

Add to `backend/tests/services/test_condition_evaluator.py`:

- depth-2 nested tree: `(A AND B) OR (C AND D)` — verify all four truth-table combinations
- depth-3 nested tree: `((A AND B) OR C) AND D` — verify edge cases
- payloads without `kind` fields **return 422** (no normalizer fallback)
- empty group at any depth returns `True` at runtime (root-level empty rejected at validation)
- **depth-32 tree validates; depth-33 rejects with a clear error** (Gap 1)
- **all-empty-groups tree rejects at the root EntryRules validator** (Gap 3)

Add to `backend/tests/schemas/test_strategy_schema.py`:

- POST /strategies with malformed nested tree returns 422 with a path that points at the bad node (e.g., `entry_rules.conditions.conditions.1.indicator`) (Gap 5)
- PUT /strategies/{id} same error shape

Add to `backend/tests/migrations/test_backfill_condition_kind.py` (or wherever migration tests live):

- Migration runs idempotently on a fixture DB containing legacy + already-normalized rows
- Downgrade restores legacy shape
- Mixed `entry_rules` (already has `kind`) + `exit_rules` (legacy) row migrates correctly

**Perf smoke** (Gap 23): one benchmark on a depth-5, 30-leaf tree, 12-month backtest of 100 stocks. Wall time must not regress more than 10% vs the same logic flattened to a single AND-of-ORs. If it does, optimize before merge (likely candidate: cache `_get_indicator_value` per-bar inside `evaluate_condition_group`).

### A5. Done when

- [ ] Schema PR opens, all 423+ existing backend tests still green
- [ ] New evaluator + migration + API-error-shape tests green
- [ ] Depth-32 limit + at-least-one-leaf validators tested
- [ ] Perf smoke: depth-5/30-leaf tree backtest within 10% of flattened equivalent
- [ ] Migration runs cleanly against a snapshot of the production DB (manual smoke test before merging)
- [ ] Manual round-trip: load a Phase-A-built nested strategy via `/api/strategies/{id}`, save, reload — JSON identical
- [ ] Pre-existing strategies still load and evaluate (**smoke**: signal scanner runs against ≥1 active strategy, 12-month backtest of one ACTIVE strategy completes, one ACTIVE bot's `evaluate_entry_rules` cycle passes)
- [ ] **Docs updated**: `backend/BACKEND.md` (rules schema section), `backend/app/schemas/README.md`, `backend/app/models/README.md` if it referenced rules shape (Gap 9)

**Phase A is preceded by a small frontend prep PR (Phase B.0)** that updates `/strategies/new` wizard's `presetToEntryRules` and editor's `buildUpdateBody` to emit `kind` discriminators. That prep PR is a no-op on the current backend (Pydantic ignores unknown fields) but is required so the moment Phase A's strict validation goes live, every client is already speaking the new shape. (Gap 10.)

---

## Phase B.0 — Frontend prep (ships before Phase A)

**Branch**: `feat/condition-tree-emit-kind`
**Repo**: `psx-ui`
**Output**: tiny PR. Required precursor to Phase A — without this, Phase A's strict validation breaks all wizard POSTs and editor saves the moment it deploys.

Two changes:

1. **`/strategies/new/page.tsx:152-191`** — `presetToEntryRules` outputs each leaf as `{ kind: "condition", indicator, operator, value, params }` and the wrapping group as `{ kind: "group", logic: "AND", conditions: [...] }`. ~10 lines of mechanical edits.
2. **`editor-view.tsx:140`** — `buildUpdateBody`'s inline serializer adds `kind: "condition"` to each rule and `kind: "group"` to the wrapping group. ~5 lines.

**Verification**: against the **current** backend (pre-Phase-A), Pydantic's default `Extra.ignore` drops the unknown `kind` field and validation passes. So this PR is observably a no-op until Phase A merges. After Phase A, every payload from psx-ui already has the canonical shape and strict validation passes.

This is the cheapest possible safety mechanism for the order-of-deploy problem.

**Done when**: build green, smoke test on `/strategies/new` and `/strategies/[id]` editor against current production backend confirms no regression.

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
export function newId(prefix: "c" | "g"): CondId;  // crypto.randomUUID() prefixed (e.g. "c-9b3f...")
export function findNode(root: ConditionGroup, id: CondId): ConditionNode | null;
export function findParent(root: ConditionGroup, id: CondId): ConditionGroup | null;
export function insertChild(root: ConditionGroup, parentId: CondId, child: ConditionNode, index?: number): ConditionGroup;
export function removeNode(root: ConditionGroup, id: CondId): ConditionGroup;
export function replaceNode(root: ConditionGroup, id: CondId, next: ConditionNode): ConditionGroup;
export function depth(root: ConditionGroup): number;
export function leafCount(root: ConditionGroup): number;
export function hasAnyLeaf(root: ConditionGroup): boolean;  // Save-time validation (Gap 20)
```

All ops are **immutable** (return a new tree). Trees are small (bounded by user authoring, hundreds of nodes max), so structural sharing is unnecessary — full clones per edit are fine.

**ID generation** uses `crypto.randomUUID()` (available in modern browsers and Node ≥19) prefixed with `c-` or `g-` for debug-readability in React DevTools (e.g., `g-9b3f7c2e-...`). IDs are assigned once at `fromBackend` time and persist for the lifetime of the editor session; they are NOT serialized to the backend (Gap 12).

### B2. Hydrate / serialize

```ts
// Tolerate both legacy (no `kind`) and new (with `kind`) shapes
export function fromBackend(rules: EntryRulesResponse): ConditionGroup;
export function toBackend(root: ConditionGroup): EntryRulesPayload;
```

`fromBackend` walks the input, treats any node with a `logic` key as a group and any node with `indicator` as a leaf, and assigns the `kind` discriminator + a fresh client-side `id` to each. `toBackend` strips client-only `id`s and emits `{ kind, logic, conditions }` for groups and `{ kind, indicator, operator, value, params }` for leaves. The backend's read-time normalizer is the safety net — even if we ever forget `kind` on the wire, the backend backfills it before validation.

Unit-test the round-trip: every existing strategy fixture round-trips byte-for-byte.

### B3. Editor state swap

In `editor-view.tsx`:

- Replace `rules: RuleNode[]` + `logic` with `tree: ConditionGroup` (the root).
- Replace `setRules` / `setLogic` callsites with tree mutations via the helpers from B1.
- `selection` becomes `{ kind: "condition" | "group" | "execution"; id: CondId } | null`.
- `handleAddCondition` becomes `handleAddCondition(parentId)` — appends to a specific group. The temporary corner pill keeps calling it with `parentId = root.id` for now.
- `handleDeleteRule` becomes `handleDeleteNode(id)` — removes any node, cascades children.
- **`buildUpdateBody` at `editor-view.tsx:140`** — currently emits `{ entry_rules: { conditions: { logic, conditions: rules.map(r => r.cond) } } }`. Rewrite to call `toBackend(tree)` (Gap 11). The function's exported test surface stays — just the body changes.
- **Frontend types in `psx-ui/app/lib/api/strategies.ts`** updated: `SingleCondition` gains `kind: "condition"`; new `ConditionGroup` interface with `kind: "group"`, `logic`, `conditions: Array<SingleCondition | ConditionGroup>`; `EntryRules.conditions` and `ExitRules.conditions` retyped accordingly (Gap 8).
- The flat-list canvas keeps rendering by **flattening** the tree: walk leaves left-to-right and lay them out as today. The gate visual derives from `tree.logic`. **Visually nothing changes** — Phase C is the visual rewrite.

### B4. Done when

- [ ] All existing strategies hydrate, edit, save, and round-trip identically
- [ ] Build / lint / typecheck green
- [ ] `npm run build` succeeds (15/15 pages)
- [ ] **Smoke scenarios pass on `/strategies/6`** (Gap 26): edit name, add condition, edit existing condition, delete condition, duplicate condition, toggle gate AND/OR, Save Draft, Deploy, Pause, navigate to /backtest with auto-run, return to editor — all behaviors identical to pre-Phase-B
- [ ] **`/strategies/new` wizard** still creates strategies successfully (its flat output rides the backend normalizer)

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

**Vertical centering of group gates** (Gap 15): with mixed-height children, `gateY = (firstChildCenterY + lastChildCenterY) / 2`. NOT the bounding-box center — that visually skews the gate toward the heaviest child when one branch is much taller than the others. Computed during the same top-down placement pass.

**Wire routing** (Gap 14): simple Bezier curves for v1 (`C controlX1 y1 controlX2 y2 endX endY`), with control points anchored to `midX = sourceX + 80`. At depth ≥3 occasional crossings between sibling-group boxes may occur — accepted as a v1 trade-off; source/target are always unambiguous from arrow direction. Revisit with orthogonal/Manhattan routing if real authored strategies look bad.

### C2. Group rendering

New component `<GroupBox>`:
- Rounded rectangle (`borderRadius: 14`)
- **Default state** (Gap 16): `border: 1px dashed T.outlineFaint`, `background: T.surfaceLow + "40"`
- **Hover state**: `border: 1px solid T.outlineVariant`
- **Selected state**: `border: 1.5px solid T.primaryLight` + outer glow (`boxShadow: 0 0 0 4px T.primary + "20"`)
- Top-left label: small uppercase `GROUP · AND` / `GROUP · OR` in `T.fontMono, fontSize: 10, color: T.text3`
- Click anywhere on the box border → selects the group → opens GroupDrawer (Phase E)
- **Empty non-root group** (Gap 17): renders a small centered `+` placeholder (28px, `T.text3`) inside the box — no copy. Distinct from root-empty placeholder which has full instructional copy.

### C3. Wires

- Leaf condition → containing group's gate: existing dashed Bezier (`Connector` component already exists)
- Group's gate → containing parent's gate: solid Bezier in `T.primaryLight`
- Root gate → ExecNode: solid (today's wire, unchanged)

### C4. Selection ergonomics

- Click a leaf → select condition → open ConditionDrawer (existing)
- Click a group's box border OR its gate glyph → both select the group → open GroupDrawer (Phase E placeholder; for now just shows logic toggle). One selection target per group, not two (Gap 13).
- Click empty canvas → clear selection (existing)

### C5. Done when

- [ ] Strategies with no nested groups render visually identical to today
- [ ] Manually constructed depth-2 strategy (built via direct state mutation in dev) renders correctly with boxed inner group, inner gate, wires
- [ ] Manually constructed depth-5 strategy renders without layout overlap
- [ ] Pan/zoom still works at all depths
- [ ] Group hover and selected states visible
- [ ] **Smoke scenarios** (Gap 26): visit `/strategies/6` (existing depth-1 strategy), confirm pixel-near-identical rendering to pre-Phase-C
- [ ] **Docs updated**: brief mention of `<GroupBox>` in `psx-ui/FRONTEND.md` if it exists (Gap 25)

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

Each slot is positioned absolutely in canvas coords using the same auto-layout pass that Phase C computed. The `+` is small (16px), `T.surface3` background, `T.text3` color.

**Reveal behavior** (Gap 19):
- **Desktop / pointer**: hover-reveal (opacity 0 → 1 within 80px of pointer)
- **Touch viewport**: always-visible at full opacity. Detection via `(hover: none) and (pointer: coarse)` media query — same hook used elsewhere in the app.

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
- **Picker positioning** (Gap 18): popover renders 4px below the clicked `+` by default; if it would overflow the canvas viewport bottom, flip up; if it would overflow right, anchor to the right edge of the `+`. Reuse the same anchoring logic the existing Combobox dropdown uses.
- **Keyboard nav**: `↑/↓` cycles options, `Enter` accepts, `Esc` dismisses. `→` on "Empty group" opens the AND/OR submenu.

### D3. Remove the corner pill

Delete `<AddPill onClick={onAddCondition}>condition</AddPill>` at `editor-view.tsx:1412`. Delete `AddPill` if no other callers (verify with grep). The empty-canvas case is handled by Phase D's wrap-empty placeholder.

### D4. Empty-state UX + save validation

When `tree.children.length === 0`, the root group's box renders the wrap-empty placeholder with copy: *"Click `+` to add your first condition or group."*

**Save-time validation** (Gap 20): the existing check `rules.length > 0` is replaced with `hasAnyLeaf(tree)`, which recursively walks groups and returns `true` iff at least one leaf condition exists somewhere in the tree. If `false`, Save is blocked with the toast "A strategy needs at least one condition" (existing copy). Backend's root-level validator catches this independently.

### D5. Done when

- [ ] All authoring of new conditions and groups happens via inline `+`
- [ ] Corner `AddPill` is gone (component removed if no other callers)
- [ ] Newly created empty groups auto-prompt for first child
- [ ] Picker auto-flips when near canvas edges
- [ ] Touch viewports show always-visible `+` slots
- [ ] Keyboard nav across picker options works
- [ ] Save validation walks the tree (block save when no leaves)
- [ ] **Smoke scenarios** (Gap 26): build a depth-3 tree from scratch via inline `+` only; save; reload; tree matches. Build a depth-1 tree (no nested groups) the same way; behaviorally identical to today.

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
    - **Logic-mismatch confirmation** (Gap 21): if `this.logic !== parent.logic`, opens a `<UngroupConfirmModal>` that shows the BEFORE and AFTER expressions in plain English. Example: BEFORE = *"Trade when X **OR** (Y **AND** Z)"*, AFTER = *"Trade when X **OR** Y **OR** Z"*. Cancel is the default focus. The destructive Ungroup confirm button is right-positioned (not primary-styled) so muscle-memory `Enter` doesn't fire it. If `this.logic === parent.logic`, ungroup proceeds without a modal (no semantic change). Power-user intent is respected; semantic change is made unmissable.
  - **Delete** — removes the group and all descendants. Confirmation modal if it has 2+ children. Disabled if this is the root and removing it would leave the strategy with zero conditions (root must always exist; can be empty though).

**No undo history in v1** (Gap 22). Destructive ops (Delete with N children, Ungroup with semantic shift) are gated by confirmation modals or disabled outright. Soft-delete at the strategy level is the safety net for "I deleted everything by accident."

### E2. Keyboard

- `Delete` / `Backspace` on a selected group → opens delete confirmation
- `Escape` → close drawer (existing)
- (Stretch) `Cmd/Ctrl+G` → wrap selection in a new group. **Out of scope for v1** (decision #2: no wrap-selection flow).

### E3. Validation

- Strategy must save with at least one leaf condition somewhere in the tree (existing rule, generalized).
- Empty groups are allowed during authoring but flagged with a soft warning on Save: *"Group 'X' is empty and will always evaluate to true."* Backend already treats empty groups as `True` (Phase A), so this is a UX hint, not a hard error.

### E4. Done when

- [ ] All group operations (logic toggle, ungroup, delete) work and persist
- [ ] Logic-mismatch ungroup is properly blocked + tooltipped
- [ ] Cascade delete works to arbitrary depth
- [ ] Empty-group warning surfaces on Save (does not block, just informs)
- [ ] Keyboard Delete on selected group → confirm modal
- [ ] **Smoke scenarios** (Gap 26): build a depth-3 tree, ungroup the inner group, save, reload — tree shape matches expected flattening. Delete the inner group with children — descendants gone.

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
| **B.0** | `psx-ui` | `app/strategies/new/page.tsx` (presetToEntryRules), `app/strategies/[id]/editor-view.tsx` (buildUpdateBody) | None visible — payloads now include `kind`, current backend ignores it |
| **A** | `psxDataPortal` | `schemas/strategy.py`, `services/backtesting/condition_evaluator.py`, alembic migration, tests | None visible — backend now accepts nested trees with strict validation, all clients already speak the new shape |
| **B** | `psx-ui` | `lib/strategy/tree.ts` (new), `editor-view.tsx`, `lib/api/strategies.ts` (types) | None visible — internal model swap |
| **C** | `psx-ui` | `editor-view.tsx`, new `<GroupBox>` component | Visual: existing strategies look identical, but the canvas now correctly renders nested trees if hand-built |
| **D** | `psx-ui` | `editor-view.tsx` | Authoring: corner pill replaced with inline `+` everywhere |
| **E** | `psx-ui` | `editor-view.tsx`, new `GroupDrawer` | Group rename / ungroup / cascade delete |

Each phase is independently shippable. Stop after any phase = working product, just less complete.

---

## Gap audit (2026-04-27)

Surfaced after grepping the actual code on both sides. Items marked **[FIX]** are folded into the relevant phase below; items marked **[DECIDE]** need a yes/no from you before the affected phase starts; items marked **[ACCEPT]** are deliberate non-goals worth naming so we don't pretend they're handled.

### Schema / backend

1. **[FIX]** **Recursion depth ceiling.** "Arbitrary depth" still needs a hard validation cap to prevent (a) accidental infinite trees from a buggy client, (b) Python's default 1000-frame recursion limit blowing up the evaluator. Add `max_depth=32` (more than any sane user authors) at schema-validate time. See **A1**.
2. **[FIX]** **Pydantic forward-ref resolution.** The recursive `Union["ConditionGroup", SingleCondition]` requires `ConditionGroup.model_rebuild()` after class definition. Without it, runtime validation fails with an unresolved-forward-ref error. See **A1** — already in the code sketch but worth calling out.
3. **[FIX]** **Server-side "at least one leaf" validation.** Today the rule is enforced in the editor's `handleDeleteRule`. With trees, "at least one leaf" must be checked at the schema layer too — a strategy of all-empty-groups would `evaluate_entry_rules → True` and fire trades on every bar. Add a model validator in `EntryRules`. See **A1**.
4. **[FIX]** **Empty `conditions: []` must remain valid at any depth.** Authoring flow lets users create an empty group and fill it. The schema must accept `{kind: group, logic: AND, conditions: []}` (root rejects this only via the rule above; non-root empty groups are fine). Pydantic default allows it; add an explicit test.
5. **[FIX]** **API-level error-shape tests.** POST /strategies and PUT /strategies/{id} with malformed nested trees should return 422 with a path that points at the bad node (e.g., `entry_rules.conditions.conditions.1.conditions.0.indicator`). Add to **A4**.
6. **[FIX]** **Rules live ONLY on `strategies` table.** Verified: bots reference `strategy_id` and read rules through the strategy at runtime — they don't snapshot. Backtests likewise don't snapshot rules. Migration scope is just `strategies.entry_rules` + `strategies.exit_rules`. See **A3** — confirmed correct.
7. **[FIX]** **Migration concurrency under Railway deploys.** Railway runs Alembic as the release command before swapping traffic, so reads/writes to `strategies` during the migration are negligible. Document this assumption in **A3** so anyone running the migration locally knows the order.
8. **[FIX]** **OpenAPI auto-regenerates; frontend types are hand-rolled.** FastAPI's `/openapi.json` will reflect the new schema automatically (Swagger UI on `/docs` validates this). The hand-written types in `psx-ui/app/lib/api/strategies.ts` (`SingleCondition`, `ConditionGroup`, `EntryRules`, `ExitRules`) need updating in **B1** — explicit list added below.
9. **[FIX]** **`backend/BACKEND.md` documentation.** Per project-level CLAUDE.md, schema/endpoint changes must update BACKEND.md. Added to **A5** done-when.

### Frontend / state

10. **[RESOLVED → (b)]** **`/strategies/new` wizard's `presetToEntryRules` (`new/page.tsx:152-191`)** is updated to emit `kind` discriminators. Decision: drop the normalizer entirely; legacy data is transformed by the data migration; new clients all emit the canonical shape. Cleaner mental model, fewer code paths, no two-shape compatibility logic. **Order-of-deploy matters**: frontend update ships first (no-op on current backend since Pydantic ignores unknown fields by default), then Phase A backend ships with strict validation. See **A1** + **B3**.
11. **[FIX]** **`buildUpdateBody` at `editor-view.tsx:140`.** The current serializer returns `{ entry_rules: { conditions: { logic, conditions: rules.map(r => r.cond) } } }` (flat). Phase B must rewrite this to walk the tree. Added to **B3**.
12. **[FIX]** **ID generation.** Plan said `newId(prefix)` but didn't spec it. Use `crypto.randomUUID()` (server-and-client-safe, prefixed for debug-readability). Stable across re-renders by living in tree state, regenerated once at `fromBackend` time. Added to **B1**.
13. **[FIX]** **Selection model edge case.** Clicking a group's gate glyph vs the group's box — does the gate have its own selection? Spec: clicking either selects the parent group (one selection target per group, not two). Logic is toggleable from the GroupDrawer (Phase E) and from a small click-affordance on the gate itself. Added to **C4** + **E1**.

### Canvas / layout

14. **[RESOLVED → simple Bezier, no special routing]** Gate consolidation makes this a non-issue: each group emits **one** wire from its gate, not many. The only crossings that can occur are wire-on-wire (two siblings' single output wires intersecting on their way to a parent gate) — these are normal in node graphs and unambiguous. Box-on-wire crossings — the actually-confusing kind — don't happen with the auto-layout. Simple Bezier curves throughout. Added to **C1**.
15. **[FIX]** **Vertical centering of group gates with mixed-height children.** Define explicitly: gate Y = midpoint of (first child's center) and (last child's center), not bounding-box center. With one short leaf and one tall nested group as children, this puts the gate visually between them rather than skewed toward the heavy child. Added to **C1**.
16. **[FIX]** **Group visual states.** Spec: default (`T.outlineFaint` dashed border), hover (`T.outlineVariant` solid), selected (`T.primaryLight` solid + soft glow). Added to **C2**.
17. **[FIX]** **Non-root empty group rendering.** Plan covered root-empty placeholder copy; non-root empty groups need a smaller `+` placeholder centered in the box (no copy — too noisy at depth). Added to **C2** + **D4**.

### Inline `+` / authoring

18. **[FIX]** **Picker positioning auto-flip.** When a `+` is near the canvas viewport edge, the picker popover must flip up/right to stay in-bounds. Added to **D2**.
19. **[RESOLVED → (a)]** **Mobile / touch behavior for inline `+`.** Always-visible at full opacity on touch viewports (detected via `(hover: none) and (pointer: coarse)`). Busier canvas on phones is preferable to invisible-controls. Added to **D1**.
20. **[FIX]** **Save-time validation walks the tree.** Today the validator is `rules.length > 0`. Phase D must replace this with a recursive "exists at least one leaf in the tree" check. Added to **D4**.

### Group editing

21. **[RESOLVED → (b)]** **Ungroup with logic mismatch.** Confirmation modal (not block) — respects power-user intent to deliberately flatten a sub-expression. The modal must communicate the semantic change concretely: shows the BEFORE expression in plain English (e.g., *"Trade when X **OR** (Y **AND** Z)"*), the AFTER expression (*"Trade when X **OR** Y **OR** Z"*), Cancel is the default focus, and the destructive Ungroup confirm button is right-positioned (not primary) so muscle-memory `Enter` doesn't fire it. Users who know what they're doing can confirm with intent; users who don't will see the actual change before clicking through. Added to **E1**.
22. **[ACCEPT]** **No undo history in v1.** Destructive ops (delete group with N children, ungroup with semantic shift) are gated by confirmations. Adding undo means lifting an event log into editor state — meaningful work, deferred. Soft-delete at the strategy level remains the safety net. Documented in **E1**.

### Cross-cutting

23. **[FIX]** **Recursion perf smoke test.** One perf check on a depth-5 / 30-leaf tree against a 12-month backtest of 100 stocks — confirm wall time doesn't regress more than 10% vs the same logic flattened to DNF. Added to **A4**.
24. **[FIX]** **Cache invalidation.** Redis `get_cache()` is used for backtest jobs (`f"backtest_job:{job_id}"`) — no caching of strategy rules themselves. No invalidation needed. Confirmed in **A3**.
25. **[FIX]** **Per-phase doc updates.** Each phase's done-when now includes specific BACKEND.md / FRONTEND.md / schemas-README.md entries. Spelled out in each phase below.
26. **[FIX]** **Per-phase smoke-test scenarios.** Each phase done-when now lists the specific user-facing flows that must still work. Spelled out below.
27. **[ACCEPT]** **Accessibility v1.** Minimum: every interactive element has `aria-label`, focus-visible rings via global CSS already cover keyboard focus. Tab-across-canvas-nodes and screen-reader announcements for tree edits are out of scope for v1.
28. **[ACCEPT]** **Telemetry / product signals on tree depth.** No event logging in v1. Adding it later is purely additive.

### Strategy import (separate flow)

29. **[NO-OP]** The list-page JSON import (`strategies-view.tsx:112`) imports into in-memory client state only — never POSTs to the backend. So legacy-import shapes don't go through the schema. No changes needed there.

---

## Resolved questions (2026-04-27)

1. **JSON encoding** — **discriminator field** `kind: "group" | "condition"` on every node. Pydantic v2 uses `Field(discriminator="kind")` for direct dispatch (no trial-and-error union resolution, faster, validation errors point at the right schema). TypeScript mirrors with a discriminated union so `switch (node.kind)` gets compile-time exhaustiveness. Self-describing JSON — any tooling inspecting stored rules can see node type at a glance. Future-proof: adding a third node type later (`kind: "preset"`, `kind: "macro"`) doesn't require disambiguation hacks. Legacy strategies (which lack `kind`) get backfilled at read time by a one-line normalizer in the strategies router (`kind = "group"` if payload has `logic`, else `"condition"`); on next save the normalized JSON persists. Cost: ~18 bytes per node in stored JSON, negligible.
2. **Group name field** — deferred. Groups have only `kind + logic + conditions[]` in v1. If users start authoring deep trees and want labels for legibility, adding an optional `name: string | null` later is purely additive (no migration, no UI breakage).
3. **Wide trees** — pan + zoom is the v1 answer. Deep/wide trees that exceed the viewport are pannable just like today's canvas. No collapse / minimap / fit-to-viewport features in v1.
