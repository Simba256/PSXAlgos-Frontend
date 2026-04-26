# Strategy Editor Wiring Plan

> Created: 2026-04-26
> Status: Planned — awaiting approval before implementation
> Scope: Make `/strategies/[id]` actually persist to the backend. Lifts the ADR-9 §2 deferral.
> Sibling: `BACKEND_WIRING_PLAN.md` (Phase 3.2c shipped a *display-only* editor).

---

## Why this exists

The user reported: *"I am on the graph and I changed symbol and saved for a node but it didn't persist."* The investigation confirmed the report — and revealed that **the entire editor is decoupled from the backend** by design (ADR-9 §2). The header shows "saved just now" without a network call; per-node Save buttons fire a toast and nothing else. This plan lifts that deferral end-to-end.

This document is the contract for that work: what's true today, what changes, in what order, and what's deliberately out of scope.

---

## Current state — what's wired vs. what's pretend

**Wired.**
- `app/strategies/[id]/page.tsx:28` — server fetches `getStrategy(jwt, id)`, hands `initialStrategy` to the client view.
- `editor-view.tsx:114-131` — `handleDeploy` PUTs `{status: ACTIVE|PAUSED}` via `/api/strategies/[id]`. Optimistic flip with rollback on error. **This is the only working write.**
- `lib/api/strategies.ts:215` — `updateStrategy()` accepts a full `StrategyUpdateBody`. Already typed, already imported in the route handler. **The save endpoint is fully wired; the canvas just doesn't call it.**
- `app/api/strategies/[id]/route.ts:56-78` — PUT proxy mints a fresh JWT from session and forwards. Production-ready.

**Pretend.**
- `editor-view.tsx:33-60` — the `CONDITIONS` map (RSI, Close, Volume, MACD) is **hardcoded**. The canvas does not read `initialStrategy.entry_rules.conditions` at all.
- `editor-view.tsx:101-108` — `handleSaveDraft` shows "Draft saved (local)". Comment admits *"Phase 3.2c defers full save: the canvas state is in-memory only"*.
- `editor-view.tsx:138-147` — `handleDrawerAction` fires only a toast. The "Save" button on every drawer is decorative.
- `ConditionDrawer` (`editor-view.tsx:1343`) — `op`, `period`, `timeframe`, `threshold`, `compareMode` live in local `useState` and never propagate up.
- `ExecutionDrawer` (`editor-view.tsx:1708`) — `direction`, `sizing`, `exits` purely local.
- `GroupDrawer` (`editor-view.tsx:2097`) — `combinator` purely local. The "OR group" is a static SVG decoration.
- The "saved just now" header label updates `savedAt = Date.now()` regardless of whether anything was sent.

---

## Backend constraints that shape the design

### 1. The schema is flat. The picture is nested.

`backend/app/schemas/strategy.py:131-141` defines:

```python
class ConditionGroup(BaseModel):
    logic: ConditionLogic = ConditionLogic.AND  # AND or OR — single value
    conditions: List[SingleCondition]            # flat list

class EntryRules(BaseModel):
    conditions: ConditionGroup                   # exactly one group
```

**Single level. No nesting.** No `ConditionGroup.groups: List[ConditionGroup]`.

The canvas paints a *nested* shape: `(RSI AND Close-filter AND OR-group(Volume, MACD))`. That structure cannot be expressed in the current schema. The wizard's `presetToEntryRules` (`strategies/new/page.tsx:152-191`) only ever emits flat single-condition lists, confirming the contract.

**Consequence**: Either we drop the nested OR-group from the canvas (pick A), or we extend the backend schema with recursive `ConditionGroup.groups` and migrate the evaluator + stored rules (pick B). **Pick A. Pick B is real backend work and out of scope for "wire the editor."**

### 2. Indicator vocabulary is enum-scoped, not parametric.

`schemas/strategy.py:26-77` — `Indicator` is a fixed enum: `rsi`, `sma_20`, `sma_50`, `sma_200`, `ema_12`, `ema_26`, `macd`, `macd_signal`, `bb_upper`, `bb_lower`, etc.

The drawer's free-text "Period: 14 bars" works for `rsi` (one enum, period is informational) but doesn't generalize:
- **SMA** — period is baked in. "Period 50" means switching enum from `sma_20` to `sma_50`. There is no `sma_100`.
- **EMA** — same. `ema_12` and `ema_26` are the only valid choices.

**Consequence**: The drawer's "Period" input must be a **dropdown of valid enum variants for the selected indicator**, not a free integer. Or hidden when the indicator has only one variant.

### 3. `Timeframe` does not exist.

The drawer shows "Timeframe: 1D". There is no timeframe field anywhere in the schema. The whole strategy assumes daily bars.

**Consequence**: Hide the field. Surfacing "1D" implies the user could pick "1H" — a lie.

### 4. Direction is long-only.

`schemas/strategy.py:248-249` — `side: str = "BUY"  # Always BUY for long-only`.

The ExecutionDrawer's Long/Short/Either toggle is decorative.

**Consequence**: Hide direction. (Or display as static "Long only" with no toggle.)

### 5. Exit signal as separate tree — not in schema.

`ExitRules` has scalar fields (`stop_loss_pct`, `take_profit_pct`, `trailing_stop_pct`, `max_holding_days`) and an optional `conditions: ConditionGroup`. The drawer's "Exit signal: separate tree" toggle gestures at the latter, but the canvas has no separate tree; only entry has nodes.

**Consequence**: Hide the "Exit signal" exit row. Add later if/when an exit-conditions canvas is built.

---

## Design decisions

These get an ADR (ADR-10). They are not relitigated mid-implementation.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Flat condition list, single AND/OR gate.** Drop the nested OR-group visual. | Matches schema. Picture honesty over apparent expressiveness. |
| 2 | **Save model: explicit "Save draft" button only.** Drawer Save → applies to local state, marks dirty. Header Save Draft → PUTs to backend. | One checkpoint per round-trip. Avoids per-keystroke chatter and partial-save races. Matches existing affordance. |
| 3 | **Hide schema-less UI:** Direction, Exit signal toggle, Timeframe field. | Shipping fields the backend can't honor is worse than shipping nothing. |
| 4 | **Indicator parameter → enum picker, not free integer.** SMA period → dropdown of `[20, 50, 200]`. RSI period → static label. | Free integers create save errors with no path to success. |
| 5 | **Inline name edit in header.** Click to edit `<h1>{name}</h1>`. Persists via Save Draft. | The wizard sets a default name (`RSI Bounce v1`) the user has no way to change. |
| 6 | **Two PRs.** PR-1 = phases 1–4 (round-trip existing rules). PR-2 = phases 5–7 (CRUD + indicator picker). | Keeps PR-1 mergeable in one review cycle. PR-2 builds on a verified-live foundation. |

See ADR-10 in `PRE_AUTH_DECISIONS.md` for full rationale.

---

## Phased plan

All phases live in `app/strategies/[id]/editor-view.tsx` and `app/strategies/[id]/page.tsx` unless noted. Tests added next to existing patterns; no new test framework.

### PR-1 — Round-trip existing rules

#### Phase 1 · Lift state, hydrate from `initialStrategy`

**Goal**: Replace the hardcoded `CONDITIONS` map with state derived from `initialStrategy`.

**Changes**:
- Delete `CONDITIONS` (`editor-view.tsx:33-60`) and `CondMeta` (line 23-31).
- Add types in the same file:
  ```ts
  type RuleId = string;  // stable across edits — start with `r${index}`, gen new on add
  interface RuleNode { id: RuleId; cond: SingleCondition; }
  ```
- New top-level state in `EditorView`:
  ```ts
  const [rules, setRules] = useState<RuleNode[]>(() =>
    initialStrategy.entry_rules.conditions.conditions.map((c, i) => ({
      id: `r${i}`, cond: c,
    }))
  );
  const [logic, setLogic] = useState<ConditionLogic>(
    initialStrategy.entry_rules.conditions.logic
  );
  const [exit, setExit] = useState<ExitRules>(initialStrategy.exit_rules);
  const [sizing, setSizing] = useState<PositionSizing>(initialStrategy.position_sizing);
  const [name, setName] = useState(initialStrategy.name);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  ```
- Update `Canvas` signature to accept `rules`, `logic`, and `selection` so node ids match `RuleNode.id`.
- Render N `CondNode`s in a column (programmatic Y position: `40 + i * 120`).
- Programmatically draw connectors: one curve per rule from its right-pin to the gate's left-pin. Drop the hardcoded SVG paths.
- Drop `GroupBox` and the nested `OR group` GateGlyph. Replace with a single central GateGlyph driven by `logic`. Make the gate clickable to toggle AND/OR (mark dirty).

**Risk**: Connectors are hand-tuned bezier paths. A naive rewrite may look ugly. Mitigation: pick a fixed elbow style (horizontal-out, vertical-in, horizontal-in) and verify visually before merge.

**Done when**: Canvas renders N nodes for any strategy where `entry_rules.conditions.conditions.length === N`. Loading `/strategies/5` shows whatever conditions actually exist on strategy 5, not a fixed RSI/Close/Volume/MACD picture.

---

#### Phase 2 · Make `ConditionDrawer` controlled

**Goal**: Drawer reads from a `SingleCondition`, edits flow back via `onApply`.

**Changes** (`editor-view.tsx:1343-1646`):
- New props:
  ```ts
  interface ConditionDrawerProps {
    cond: SingleCondition;
    indicators: string[];          // keys of IndicatorMeta.indicators
    onApply: (next: SingleCondition) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onClose: () => void;
  }
  ```
- Internal state seeded from `cond`. On Apply: build the next `SingleCondition`, call `onApply`, mark parent dirty, close drawer.
- **Map drawer fields → `SingleCondition`**:
  - Indicator picker (NEW; deferred to Phase 7 — for PR-1 the indicator is read-only, just displays `cond.indicator`).
  - Operator buttons → `cond.operator`. **Constrain set to backend's seven**: `>`, `>=`, `<`, `<=`, `==`, `crosses_above`, `crosses_below`. Drop the decorative `=`, `×↑`, `×↓`, `·` glyphs (they don't exist in `Operator` enum). Use friendly labels for the cross operators (`× ↑` for `crosses_above`, `× ↓` for `crosses_below`).
  - Compare mode (Constant | Indicator) → discriminator on `cond.value.type`.
  - Threshold input → `cond.value.value` when `value.type === "constant"`.
  - **Hide `period` and `timeframe` fields entirely in PR-1.** They will return as a constrained dropdown in PR-2 once the indicator picker exists.
  - Hide the "historical fit" mock stats block (lines 1593-1622).
- Drawer footer: keep Delete + Duplicate + Save layout. Save is now "Apply" semantically — saves to local editor state, not to backend.

**Done when**: Editing operator from `<` to `<=` and clicking Apply updates `rules[i].cond.operator`, marks `dirty=true`, and the canvas re-renders the node label.

---

#### Phase 3 · Make `ExecutionDrawer` controlled

**Goal**: Exec drawer reads from `exit` + `sizing`, edits flow back.

**Changes** (`editor-view.tsx:1708-1986`):
- New props:
  ```ts
  interface ExecutionDrawerProps {
    exit: ExitRules;
    sizing: PositionSizing;
    onApply: (nextExit: ExitRules, nextSizing: PositionSizing) => void;
    onClose: () => void;
  }
  ```
- **Map UI → schema**:
  - Sizing slider (0–100) → `position_sizing.value` (assumes `type === "fixed_percent"`; for now we only support that mode in the UI).
  - Stop loss row: parse `"5%"` → `5.0` → `exit_rules.stop_loss_pct`. Keep `null` when toggle is off.
  - Take profit → `take_profit_pct`. Same parsing rule.
  - Trailing stop → `trailing_stop_pct`. Same.
  - Max holding: parse `"21 days"` → `21` → `max_holding_days`.
  - **Hide Direction row** (long-only).
  - **Hide Exit signal row** (no canvas equivalent).
- Add input parsing helper:
  ```ts
  function parsePct(raw: string): number | null {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  function parseDays(raw: string): number | null {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  ```
- Validation: bound `pct` fields to `[0, 100]` (per backend `Field(ge=0, le=100)`).

**Done when**: Toggling stop loss off, applying, then saving draft results in `exit_rules.stop_loss_pct === null` in the backend response.

---

#### Phase 4 · Wire `handleSaveDraft` to PUT

**Goal**: Header "Save draft" button persists the editor state to the backend.

**Changes**:
- Add a pure serializer next to the component:
  ```ts
  function buildUpdateBody(
    name: string,
    rules: RuleNode[],
    logic: ConditionLogic,
    exit: ExitRules,
    sizing: PositionSizing,
  ): StrategyUpdateBody {
    return {
      name,
      entry_rules: { conditions: { logic, conditions: rules.map((r) => r.cond) } },
      exit_rules: exit,
      position_sizing: sizing,
    };
  }
  ```
  *Pure function — easy to unit-test (Phase 8).*
- Replace `handleSaveDraft` body:
  ```ts
  async function handleSaveDraft() {
    if (!dirty || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const body = buildUpdateBody(name, rules, logic, exit, sizing);
      const res = await fetch(`/api/strategies/${initialStrategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSavedAt(Date.now());
      setDirty(false);
      setSaveStatus("idle");
      setFlash("Saved");
    } catch (err) {
      setSaveStatus("error");
      setFlash(err instanceof Error ? err.message : "Save failed");
    }
  }
  ```
- Header (`editor-view.tsx:263+`) reads `dirty` + `saveStatus`:
  - `idle` + clean → "saved Xm ago"
  - `idle` + dirty → "unsaved changes" (warning color)
  - `saving` → "saving…"
  - `error` → "save failed — retry" (clickable to retry)
- Disable Save Draft button when `!dirty || saveStatus === "saving"`.

**Done when**: Loading `/strategies/5`, changing RSI's operator from `<` to `<=`, clicking Save Draft, refreshing → operator persists.

---

### PR-2 — CRUD, name edit, indicator picker

#### Phase 5 · CRUD on rules

**Goal**: Add, delete, duplicate conditions.

**Changes**:
- "+ condition" pill (`editor-view.tsx:787`) opens a fresh `ConditionDrawer` in **create mode**:
  - Default `cond`: `{ indicator: "rsi", operator: "<", value: { type: "constant", value: 50 } }`.
  - On Apply: append to `rules` with new id (`r${Date.now()}` to avoid collision with `r0..rN-1`).
  - Mark dirty.
- "+ group" pill: drop for now (matches "no nesting" decision). Replace with a "Toggle AND/OR" affordance on the gate, or just remove.
- Drawer Delete → `setRules((rs) => rs.filter(r => r.id !== id))`, close, mark dirty.
- Drawer Duplicate → clone with new id, append, mark dirty.
- Backend constraint: `entry_rules.conditions.conditions` requires at least one (`List[SingleCondition]` with no `min_length=0` but the backend evaluator will reject empty). Block delete if `rules.length === 1` — show toast "A strategy needs at least one condition".

**Done when**: Adding a new RSI condition, saving, refreshing → 2 rules persist.

---

#### Phase 6 · Inline name edit

**Goal**: Editable strategy name in the header.

**Changes** (`editor-view.tsx:263+` in `Header`):
- Replace `<h1>{name}</h1>` with a click-to-edit input (or `contenteditable` if simpler):
  - Display mode: large text (existing styling).
  - Edit mode: `<input>` with same styling, `onBlur` and Enter commit, Escape revert.
- `onChange` updates `name` state in parent and marks dirty.

**Done when**: Editing the name "RSI Bounce v1" → "Mean Reversion KSE-30", saving, refreshing → name persists.

---

#### Phase 7 · Indicator picker (uses `Combobox`)

**Goal**: Drawer can change which indicator a rule uses.

**Changes**:
- `page.tsx`: add `getIndicatorMeta()` to `Promise.all` (already typed at `lib/api/strategies.ts:237`; public endpoint, hourly ISR).
- Thread `indicators: IndicatorMeta` into `EditorView` → `ConditionDrawer`.
- In `ConditionDrawer` add a new top field "Indicator" using the existing `Combobox` atom:
  ```tsx
  <Combobox
    label="Indicator"
    value={indicator}
    onChange={(v) => { setIndicator(v); /* reset period to first valid for v */ }}
    options={indicatorOptions /* derived from IndicatorMeta */}
    placeholder="rsi"
    mono
  />
  ```
  `indicatorOptions` is `Object.values(meta.indicators).flat().map(i => ({ value: i, label: i, hint: groupOf(i) }))`.
- Re-introduce **Period** as a constrained selector:
  - For SMA: dropdown `[20, 50, 200]` mapping to `sma_20|sma_50|sma_200`.
  - For EMA: dropdown `[12, 26]`.
  - For RSI: static label `14` (single enum), no input.
  - For others (MACD, BB, ATR, ADX, etc.): hidden — period is baked in.
- Indicator-value autocomplete: when `compareMode === "Indicator"`, the value-side gets a Combobox over the same indicator list so users can pick `sma_200` instead of typing it.

**Done when**: Editing a rule from RSI to "close_price > sma_50", saving, refreshing → conditions reflect the change.

---

#### Phase 8 · Verification

- `/media/shared/personalProjects/psx-ui/app/node_modules/.bin/tsc -p /media/shared/personalProjects/psx-ui/app/tsconfig.json --noEmit` — clean.
- `cd /media/shared/personalProjects/psx-ui/app && npm run build` — clean. Page count unchanged (still `ƒ /strategies/[id]`).
- **Unit test the serializer** (`buildUpdateBody`) — round-trip identity:
  - Input: a known `StrategyResponse` (fixture).
  - Hydrate → serialize → JSON-stringify both `entry_rules`, `exit_rules`, `position_sizing` paths from input and from output. Assert deep-equal modulo numeric coercion (`5` vs `5.0`).
  - This catches every mapping regression for free.
  - Test runner: project has none today. Add the smallest possible setup — a `tests/` directory with a `node --test` script. (Or: skip the unit test and rely on browser smoke test only; acceptable for PR-1.)
- **Browser smoke**: load `/strategies/5`, edit op + threshold + sizing + name, save, refresh, verify all four persisted. Edit + close drawer without Apply → no dirty mark.
- Update `PROJECT_TRACKER.md` "Recently Completed".
- Update ADR-9 §2 to mark the deferral lifted (or leave the original ADR and add a "Lifted in ADR-10" footnote).

---

## File-by-file impact summary

| File | Phase | Change type |
|------|-------|-------------|
| `app/strategies/[id]/editor-view.tsx` | 1–7 | Rewrite ~70% — state lift, drawer signatures, save handler, CRUD, name edit |
| `app/strategies/[id]/page.tsx` | 7 | Add `getIndicatorMeta()` to `Promise.all` |
| `app/lib/api/strategies.ts` | — | No change |
| `app/api/strategies/[id]/route.ts` | — | No change (already supports PUT) |
| `app/components/atoms.tsx` | 7 | No change (re-uses existing `Combobox`) |
| `tests/editor-serializer.test.ts` | 8 | NEW (optional) |
| `PROJECT_TRACKER.md` | each PR | Update |
| `PRE_AUTH_DECISIONS.md` | now | Append ADR-10 |

---

## Out of scope (deliberate)

These appear in the editor UI today but require bigger changes to honor:

1. **Nested condition groups** (`OR group`, `XOR group`, group dissolve). Requires recursive schema + evaluator + migration of stored rules. Rejected per design decision 1.
2. **Per-condition timeframe** (1H, 1D, 1W). Requires multi-timeframe data pipeline. Schema-less today.
3. **Short / Either direction**. Requires shorting infrastructure in the backtest engine and broker integration.
4. **Exit signal as a separate canvas tree**. Requires a second canvas + serializer for `exit_rules.conditions`. Defer to a "v2" once entry-only is solid.
5. **Validation panel** (`Validate` button in the canvas footer). Currently fires a fake "Strategy is valid" toast — would need a real `POST /strategies/validate` endpoint that runs Pydantic validation without saving.
6. **Version history / restore** (`MOCK_VERSIONS` at `editor-view.tsx:256`). No backend version table. Strict v2 work.
7. **Historical-fit stat block in `ConditionDrawer`** ("47 fires / 252 days · 18.6% hit rate"). Decorative numbers. Would need a per-condition hit-rate query the backend doesn't have.

Each of these gets a one-line "deferred — see plan §Out of scope" in the editor when it's hidden, so they're discoverable later without git archaeology.

---

## Open questions (none currently — all decisions taken in ADR-10)

If a question arises mid-implementation that the ADR doesn't answer, **stop and ask** — do not silently relitigate.

---

## Lift triggers

This plan is the lift trigger for ADR-9 §2 ("editor canvas does not round-trip"). On merge of PR-1, the deferral is partially lifted (existing rules round-trip). On merge of PR-2, fully lifted.

ADR-9 §1 (wizard preset → entry_rules is starter conditions) remains as-is. The fix is "user refines in the editor afterwards" — which only becomes true once this plan ships.
