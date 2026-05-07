# Hybrid Exits (Option C) — Frontend Reference

> Last updated: 2026-05-07
> Backend ADR: `psxDataPortal/docs/ARCHITECTURE.md` ADR-008
> Implementation plan: `psxDataPortal/docs/EXITS_IMPLEMENTATION_PLAN.md`
> Decision rationale: `psxDataPortal/docs/research/EXITS_DECISION_SYNTHESIS.md`

This doc is the canonical reference for the `psx-ui` side of Option C: how the four scalar exit guardrails (`stop_loss_pct`, `take_profit_pct`, `trailing_stop_pct`, `max_holding_days`) flow between the strategy editor (where defaults are authored), the deploy/backtest forms (where they're inherited or overridden), and the backtest result page (where the run-time snapshot is attributed back to its source).

Phase 4b (2026-05-07) extended the canvas to also author the *signal-based* exit tree (`exit_rules.conditions`) — a parallel mirrored condition tree on the right side of the strategy editor — so users have a first-class authoring surface for exit signals (e.g. "RSI > 75 → exit") in addition to the four scalar guardrails.

---

## What ships on `psx-ui`

| Component | Path | Purpose |
|-----------|------|---------|
| `RiskDefaultsNode` | `app/components/strategy-editor/risk-defaults-node.tsx` | Pinned right-side scalar node on the strategy editor canvas. Authors the four `exit_rules.default_risk` fields. 220px wide, 2×2 grid of numeric inputs, percent fields capped 0–100 client-side, `max_holding_days` integer-only. Empty input → `null`. Exposes static `WIDTH` and `PIN_OFFSET_Y` so the canvas can compute connector geometry. Pinned, not draggable. |
| `StatusStrip` | `app/components/strategy-editor/status-strip.tsx` | Bottom-right pill that replaced the three OutputPins (Backtest / Live signals / Automate). Carries the same navigation role: Backtest segment links to `/backtest?strategy_id=N` (or `/backtest/new` when no run exists yet) and color-codes gain/loss; Deploy segment with `StatusDot` pulse when active links to `/signals`; optional Bot segment hidden until binding state is wired. Slides with the drawer (`right: drawerOpen ? 412 : 24`). |
| `InheritableField` | `app/components/inheritable-field.tsx` | Generic anchor-counter wrapper for any field that can inherit a strategy-level scalar default. Three states: (1) **no default** → plain editable input (passes through); (2) **inheriting / ghost** (default exists, form value `null`) → read-only input showing the strategy default as ghost placeholder, "Inheriting · 5%" pill in primary tint, "Override" link, focus implicitly enters override mode; (3) **overridden** (form value non-null) → editable input with "Overridden" pill and "Reset to default" link that re-nulls the field. Used by both bot-create and backtest-run forms. |
| `InheritanceWarningModal` | `app/components/strategy-editor/inheritance-warning-modal.tsx` | Per-bot picker that opens when `PUT /strategies/{id}` returns an `inheritance_warnings` block. Renders a diff strip (old → new for each changed field, primary tint on the new value), a running counter, bulk "All inherit / All snapshot" toggles, and a per-bot row with status badge + which fields the bot inherits + a two-button radiogroup (`Inherit new` / `Snapshot old`). Default for every bot is `Inherit new`; snapshot is opt-in per bot. On submit, posts to `apply-default-risk` with two disjoint id lists. Cancel leaves the strategy edit committed but skips the propagate/snapshot decision (every affected bot keeps inheriting, with an explicit toast so the user knows). |
| `EffectiveRiskPanel` | inline in `app/app/backtest/backtest-view.tsx` | Read-only attribution panel on the backtest result page. Renders four rows (Stop loss / Take profit / Trailing / Max hold), each with value + source tag (`OVERRIDE` primary tint, `DEFAULT` text, `INACTIVE` text3). Reads `result.run_config?.effective_risk` (the frozen Phase 2 snapshot). Older results predating the snapshot render a neutral "snapshot not recorded for this run" dashed-border placeholder. Placement: right column above the existing `deploy?` Ribbon. |

---

## Where each component is wired

### Strategy editor canvas

`app/app/strategies/[id]/editor-view.tsx`:

- `[tree, setTree]` holds the entry-rules condition tree; `[exitTree, setExitTree]` holds `exit_rules.conditions` (signal-based exits) as a real authoring tree on the right side of the canvas. Both are seeded via `fromBackend(...)`, both round-trip through the same condition-tree machinery (`@/lib/strategy/tree`), and both are mutated by the same `handleAddCondition` / `handleAddGroup` / `handleSetGroupLogic` / `handleUngroupGroup` / `handleDeleteGroup` / `handleDuplicateNode` / `handleDeleteNode` family — each handler now takes a trailing `source: SelSource` ("entry" | "exit") and routes through `treeFor(source)` to pick the right setter.
- `[exit]` is retained for any non-conditions / non-default_risk metadata in `exit_rules`. `setExit` isn't called today (no UI mutates that surface) — `buildUpdateBody` spreads `exit` for passthrough fields and re-derives `conditions` from `exitTree` on every save.
- `[riskDefaults, setRiskDefaults]` holds `exit_rules.default_risk` keyed off `initialStrategy.exit_rules?.default_risk ?? {}`. `handleRiskDefaultsChange(next)` wraps `setRiskDefaults` + `setDirty(true)` so typing in the node lights up the save toolbar.
- `buildUpdateBody(name, tree, exit, exitTree, riskDefaults)` writes the entry tree, exit tree, and risk defaults on every save. `conditions: hasAnyLeaf(exitTree) ? toBackend(exitTree) : null` — an empty exit tree wires `null` rather than a structurally empty group (which the backend would otherwise interpret as "always True → exit on every bar"). `default_risk` is sent as the full object including nulls, so blanking a field cleanly clears the strategy default.
- The three OutputPins that previously fan'd out from the entry root were removed in Phase 4 along with the `outNY` connector math; the `StatusStrip` now carries that navigation role from outside the graph.
- **Mirrored exit-tree layout (Phase 4b)**: `mirrorLayout(layout, axisX)` (in `@/lib/strategy/layout`) is a coordinate post-processor that flips X coordinates of an already-placed `GroupLayout` about a vertical axis. We compute `EXIT_ROOT_GATE_X = outputX + RiskDefaultsNode.WIDTH + RISK_TO_EXIT_GAP` and derive `mirrorAxisX` so the exit root gate's left edge lands at `EXIT_ROOT_GATE_X`. The mirror flips leaf x, gate x, pin x, and add-slot cx — so the resulting layout reads top-to-bottom but flows left-to-right (root on the left, leaves on the right) instead of right-to-left. The wire bezier in `pushWire` uses `Math.sign(to.x - from.x)` to compute the control-point offset so mirrored wires curve toward their parent gate rather than overshooting outward.
- **Selection scoped per tree**: `Selection = { kind, id, source: "entry"|"exit" } | null`. `onSelect(kind, id, source)`, `isSelected(kind, id, source)`, and the `selectedLeaf` / `selectedGroup` derivation all consult `selection.source` via `treeFor(...)` to look up nodes from the right tree. The Drawer (`ConditionDrawer` / `GroupDrawer`) is unchanged — it just receives the right node + handlers wired against the right setter.
- **Two `BranchLabel`s** ("ENTRY" / "EXIT") sit above each root gate so the two `AND` glyphs aren't read as one continuous structure. Pinned nodes/labels are rendered above the SVG wire layer.
- **Validation asymmetry**: the entry tree must have ≥1 leaf to save (`hasAnyLeaf(tree)` blocks save with the standard flash). The exit tree may be emptied — "no signal-based exits, rely on risk defaults" is a valid configuration. `performDeleteGroup` and `handleDeleteNode` enforce this asymmetry by short-circuiting only when `source === "entry"`.
- `performSave` snapshots `initialStrategy.exit_rules?.default_risk` BEFORE the PUT (the response carries only a sliced view of old values inside `inheritance_warnings.old_values`, so we keep the full pre-save default for the apply-default-risk call), then opens the `InheritanceWarningModal` when `inheritance_warnings.affected_bots.length > 0`. Autosave (`silent: true`) suppresses the modal so a background save never pops UI under the user mid-keystroke.

### Bot create wizard

`app/app/bots/new/page.tsx`:

- The strategy-fetch effect captures `s.exit_rules?.default_risk` into the wizard's `StrategyPreview` shape and threads it through `<UniverseAndRiskFields strategyDefaults={...} />`.
- The right-rail `Preview` panel surfaces effective values via an `eff()` resolver that mirrors the backend (`override ?? strategyDefault ?? null`); inherited values render in `T.text3` with a "· inherited" suffix so the user sees the actual cap that'll apply at run time.

### Backtest run form

`app/app/backtest/new/backtest-new-view.tsx`:

- `useEffect` on `strategyId` issues `GET /api/strategies/{id}` and stores `default_risk` in `strategyDefaults` state.
- When the strategy authored a default for a field, the form's existing override is null'd out so the field starts in inherit / ghost (anchor-counter — preset `RISK_DEFAULTS` of 5% stop / 5 positions no longer rubber-stamps when a strategy default exists).
- The four exit-risk fields render as `<InheritableField>`; `max_concurrent_positions` stays a plain `RiskField` (not part of `default_risk`).
- `RunRail.riskLabel` folds inheritance: each segment computes `override ?? strategyDefault` and prefixes inherited segments with `↳ ` so the rail communicates both the effective cap and its source.

### Shared form component

`app/components/universe-and-risk-fields.tsx`:

- Optional `strategyDefaults?: DefaultRisk | null` prop. The four exit-risk inputs render as `<InheritableField>` when defaults are passed, fall back to plain `NumberInput` otherwise.
- Wire-level submit shape unchanged — both pages already preserved `null` for blank fields, so inheritance falls through to the backend resolver at run time without any payload changes; the frontend doesn't need to know which fields inherit.

### Backtest result page

`app/app/backtest/backtest-view.tsx`:

- `EffectiveRiskPanel` reads `result.run_config?.effective_risk` and renders the four rows. Source-color UX: `T.primaryLight` for explicit overrides (eye-grab the "what did I change?"), `T.text` for defaults (the run honored what the strategy authored), `T.text3` for inactive (faded so absence is visible but not noisy). The source uppercase tag uses `T.primaryLight` only for "override" — the eye is drawn only to user-driven changes.

---

## API surface — `app/lib/api/strategies.ts`

| Type | Shape | Phase |
|------|-------|-------|
| `DefaultRisk` | `{ stop_loss_pct?: number\|null, take_profit_pct?: number\|null, trailing_stop_pct?: number\|null, max_holding_days?: number\|null }` | 4 |
| `ExitRules` | extended with `default_risk?: DefaultRisk \| null` | 4 |
| `RiskField` | union: `"stop_loss_pct" \| "take_profit_pct" \| "trailing_stop_pct" \| "max_holding_days"` | 6 |
| `InheritanceWarningBot` | `{ id, name, status, inherited_fields: RiskField[] }` | 6 |
| `InheritanceWarning` | `{ changed_fields: RiskField[], old_values, new_values, affected_bots: InheritanceWarningBot[] }` | 6 |
| `StrategyUpdateResponse` | extended with optional `inheritance_warnings: InheritanceWarning \| null` | 6 |
| `ApplyDefaultRiskRequest` | `{ propagate_to_bot_ids: number[], snapshot_bot_ids: number[], changed_fields: RiskField[], old_default_risk: DefaultRisk \| null }` | 6 |
| `ApplyDefaultRiskResponse` | `{ propagated_count: number, snapshotted_count: number }` | 6 |
| `applyDefaultRisk(jwt, id, body)` | client wrapper for `POST /api/strategies/[id]/apply-default-risk` | 6 |
| `EffectiveRiskSource` | union: `"explicit" \| "default" \| "none"` | 7 |
| `EffectiveRiskResolution` | `{ value: number \| null, source: EffectiveRiskSource }` | 7 |
| `EffectiveRiskSnapshot` | `{ stop_loss_pct: …, take_profit_pct: …, trailing_stop_pct: …, max_holding_days: … }` (each `EffectiveRiskResolution`) | 7 |
| `BacktestRunConfig` | `{ effective_risk?: EffectiveRiskSnapshot \| null }` — deliberately narrow, only `effective_risk` typed; other run_config keys exist on the wire but encoding them now would invite drift | 7 |
| `BacktestResultResponse` | extended with optional `run_config: BacktestRunConfig \| null` | 7 |

These mirror the Pydantic schemas in `psxDataPortal/backend/app/schemas/strategy.py:530-611` — field names and bounds are kept identical so a backend rename would be caught by `tsc --noEmit`.

## Proxy routes — `app/app/api/strategies/[id]/`

- `route.ts` (PUT) — unchanged; `updateStrategy` returns the full backend response so `inheritance_warnings` passes through verbatim once the response type covers it.
- `apply-default-risk/route.ts` (POST, new in Phase 6) — auths via NextAuth + signs backend JWT, parses body, forwards to backend, bubbles `ApiError` as `{error, detail}` with the original status.

---

## Why these patterns

The non-obvious UX decisions, with research pointers:

1. **`InheritableField` ghost text + Override link, not pre-filled values.** NN/g default-acceptance research: prefilled defaults get rubber-stamped ~70%+ of the time. Rendering the strategy default as ghost placeholder forces override to be an active decision rather than a passive accept.
2. **Per-bot picker modal default = `Inherit new`.** The strategy edit was the user's stated intent. The safe default is to let it propagate; snapshot is opt-in. Cancel = "every affected bot keeps inheriting" (same outcome as accepting the default for all bots), with a toast so the user knows what happened.
3. **`EffectiveRiskPanel` reads from snapshot, never re-resolves.** A backtest result is a frozen artifact. If the strategy default changes after the run, the result is unaffected — re-running is the user's responsibility. Reading from `run_config.effective_risk` keeps attribution stable; re-resolving against the live strategy would silently mutate the result page over time.
4. **`StatusStrip` outside the graph.** The original OutputPins coupled status display to canvas geometry; adding the right-side risk-defaults pin made that geometry untenable. The strip preserves the at-a-glance feedback users actually use (last backtest %, deploy state) without competing with the new node for canvas real estate.
5. **Mirrored exit tree, not a separate "exits panel".** The condition-tree authoring affordance — leaves, groups, AND/OR gates, inline `+` slots — is identical to the entry tree. Building a separate panel-style editor would have meant duplicating the picker, drawer, layout machinery, etc., just to get the same UX. The mirror approach reuses every existing component: the only new code is `mirrorLayout` (a 25-line coordinate flip) and source-routed mutation handlers. Two trees on the same canvas also makes the asymmetry visible — a strategy with rich entry conditions and an empty exit tree reads as "uses default exits" at a glance.
6. **No central wire from exit tree to RiskDefaultsNode.** The risk caps apply to both entry- and exit-driven trades, but visually wiring both roots to the same pin would clutter the canvas without communicating new information. Entry tree → Risk caps stays as the single visible connector (the existing Phase 4 wire); the exit tree stands alone on the right as a parallel signal source.

---

## Verification

- `tsc --noEmit` clean across all phases (including 4b).
- `npm run build` succeeds (36 routes — `/api/strategies/[id]/apply-default-risk` registered, no warnings).
- `psx-ui` has no test runner today (`npm run lint` is just `tsc --noEmit`); component-level tests for `InheritableField` (3 states), `mirrorLayout` (coordinate-flip correctness), and submit-shape integration tests are flagged as a stand-alone follow-up that needs a Jest/Vitest setup first.
