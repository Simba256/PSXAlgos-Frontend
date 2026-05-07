# Hybrid Exits (Option C) — Frontend Reference

> Last updated: 2026-05-07
> Backend ADR: `psxDataPortal/docs/ARCHITECTURE.md` ADR-008
> Implementation plan: `psxDataPortal/docs/EXITS_IMPLEMENTATION_PLAN.md`
> Decision rationale: `psxDataPortal/docs/research/EXITS_DECISION_SYNTHESIS.md`

This doc is the canonical reference for the `psx-ui` side of Option C: how the four scalar exit guardrails (`stop_loss_pct`, `take_profit_pct`, `trailing_stop_pct`, `max_holding_days`) flow between the strategy editor (where defaults are authored), the deploy/backtest forms (where they're inherited or overridden), and the backtest result page (where the run-time snapshot is attributed back to its source).

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

- `[exit, setExit]` writable state holds `exit_rules.conditions` (the signal-based exit tree — round-trips through the same condition-tree machinery as entries).
- `[riskDefaults, setRiskDefaults]` holds `exit_rules.default_risk` keyed off `initialStrategy.exit_rules?.default_risk ?? {}`. `handleRiskDefaultsChange(next)` wraps `setRiskDefaults` + `setDirty(true)` so typing in the node lights up the save toolbar.
- `buildUpdateBody(name, tree, exit, riskDefaults)` writes both branches on every save. `default_risk` is sent as the full object including nulls, so blanking a field cleanly clears the strategy default.
- The three OutputPins that previously fan'd out from the entry root were removed in Phase 4 along with the `outNY` connector math; the `StatusStrip` now carries that navigation role from outside the graph.
- Right-side parallel mirror exit-tree authoring (the second `<ConditionTree>` instance) was deferred to a Phase 4b follow-up — the layout module's `ROOT_GATE_X` anchor is single-root by design and a mirrored layout requires either a `mirror` flag in `layoutTree` or a coordinate post-processor. Today the canvas paints a single root → entry tree on the left and the `RiskDefaultsNode` pin on the right; round-trip of `exit_rules.conditions` is preserved in state for when the right-side authoring lands.
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

---

## Verification

- `tsc --noEmit` clean across all phases.
- `npm run build` succeeds (36 routes — `/api/strategies/[id]/apply-default-risk` registered, no warnings).
- `psx-ui` has no test runner today (`npm run lint` is just `tsc --noEmit`); component-level tests for `InheritableField` (3 states) and submit-shape integration tests are flagged as a stand-alone follow-up that needs a Jest/Vitest setup first.
