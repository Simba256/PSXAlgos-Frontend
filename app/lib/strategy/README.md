# Strategy condition-tree helpers

In-memory recursive model for the strategy editor's condition tree, plus the
hydrate/serialize bridge to the wire shape in `@/lib/api/strategies`.

## Why two shapes?

- **Wire shape** (`@/lib/api/strategies::ConditionGroup`/`SingleCondition`) —
  what the backend persists. Keys: `kind`, `logic`, `conditions`, `indicator`,
  `operator`, `value`, `params`. No client identity.
- **In-memory shape** (`./tree::ConditionGroup`/`ConditionLeaf`) — what the
  editor manipulates. Wraps each node with a stable `id` (UUID-prefixed)
  so React keys and selection state survive edits, and renames `conditions`
  → `children` to keep the boundary explicit.

IDs are generated at hydrate time (`fromBackend`) and never round-trip — the
serializer (`toBackend`) strips them.

## Helpers

| Function | Purpose |
|---|---|
| `newId(prefix)` | Stable client-side id (`c-<uuid>` / `g-<uuid>`). |
| `findNode(root, id)` | DFS lookup. |
| `findParent(root, id)` | Returns the group whose `children` contains `id`. |
| `insertChild(root, parentId, child, index?)` | Immutable insert. |
| `removeNode(root, id)` | Immutable removal; cascades children. |
| `replaceNode(root, id, next)` | Immutable substitution. |
| `setGroupLogic(root, id, logic)` | Toggles a group's AND/OR. |
| `ungroupAt(root, id)` | Replaces a group with its children in the parent (Phase E). Root is a no-op — root cannot be ungrouped. |
| `flattenLeaves(root)` | DFS leaf-only walk. |
| `depth(root)` | Max nesting depth (1-indexed). |
| `leafCount(root)` / `hasAnyLeaf(root)` | Save-time validation. |
| `countEmptyGroups(root)` | Number of non-root groups with zero children — used by Phase E save-time soft warning. |
| `fromBackend(wireGroup)` | Wire → in-memory; tolerates missing `kind`. |
| `toBackend(root)` | In-memory → wire (strict, with `kind` everywhere). |
| `normalizeWireGroup(group)` | Recursively re-emit a wire group with `kind`. |

All mutating helpers are immutable (return a new tree). Trees are bounded by
user authoring, so structural sharing would be premature — full clones per
edit are simpler and fast enough.

## Depth limit

`MAX_CONDITION_DEPTH = 32` — mirrors the backend constant in
`backend/app/schemas/strategy.py`. Update both together if it ever moves.

## Preset chips (SB10 + SB3 + SB2 + SB7)

The strategy editor surfaces a row of preset chips above the expression input
that one-tap-insert pre-validated compositions over the indicator vocabulary.
The catalog lives at `app/components/strategy-editor/expression/expression-input.tsx`
as the module-scope `PRESET_CHIPS: readonly PresetChip[]`. Each entry carries
a stable `id` (used as React key and reserved for future analytics), a short
chip-friendly `label`, a single-line tooltip `description`, the `expression`
text the chip inserts at the caret, and `matchKeys` — lowercased prefix-match
keys the autocomplete dropdown uses to surface the preset alongside indicator
suggestions.

| Preset id | Source | Inserted expression | Industry parity |
|---|---|---|---|
| `atr-percent` | SB10 | `atr_percent` | TradingView `ta.atr / close * 100` |
| `distance-atr` | SB10 | `(close_price - sma_50) / atr` | Distance in ATR units (TrendSpider, Composer) |
| `bb-percent-b` | SB10 | `bb_percent_b` | TradingView `ta.bbpercent` |
| `bb-bandwidth` | SB10 | `(bb_upper - bb_lower) / bb_middle` | Bollinger Bandwidth (Bollinger Bands official) |
| `relative-volume` | SB3 | `volume / volume_sma_20` | Trade Ideas RelVol; Finviz "Volume / Avg Volume"; TradingView `volume / ta.sma(volume, 20)` |
| `dollar-volume` | SB3 | `close_price * volume` | TradingView `close * volume`; Bloomberg `PX_VOLUME_TRADED` |
| `donchian-breakout` | SB2 | `close > highest(high, 20)[1]` | Pine `close > ta.highest(high, 20)[1]`; canonical Donchian-channel breakout |
| `donchian-breakdown` | SB2 | `close < lowest(low, 20)[1]` | Pine `close < ta.lowest(low, 20)[1]`; canonical Donchian breakdown |
| `previous-close` | SB2 | `close[1]` | Pine `close[1]`; single-bar lookback (yesterday's close) |
| `monday-only` | SB7 | `dayofweek` | Pine `dayofweek == 1` (ISO Monday=1); TradingView screener "Day of week" filter |
| `max-entries-per-day` | SB7 | `entries_today` | Streak / Tradetron `entry_count_today`; TrendSpider "Max N signals per day"; Pine analogue `strategy.opentrades` |
| `cooldown-5-bars` | SB7 | `bars_since_entry` | Pine `ta.barssince(strategy.position_size != 0)`; per-symbol cooldown — most common quality filter in retail backtests |

SB3 also extends the indicator vocabulary itself — `KNOWN_INDICATORS` in
`expression.ts` adds `"volume_sma_20"` so the bare ref typechecks against the
parser's whitelist. The matching backend column is persisted (NUMERIC(20, 2),
20-bar rolling mean of daily volume — see `backend/BACKEND.md`'s
`TechnicalIndicator` row and ADR-009's SB3 extension note); the parser is
unchanged because `volume_sma_20` matches the existing `IDENT` regex and
routes through `Indicator(name)` enum lookup.

Threshold guidance (e.g. relvol > 1.5 = unusual interest, > 3 = stalking-horse;
dollar volume > 10M PKR = liquid name) is **tooltip-only** — the outer
`SingleCondition.value` stays user-supplied. The chip only inserts the LHS
expression; the user fills in the operator + threshold via the existing
condition-drawer surface. Same convention as SB10.

The `matchKeys: [..., "volume"]` on the SB3 `relative-volume` preset shares
its string with the bare-indicator wire name, so typing `volume` surfaces
both the raw series and the ratio preset. This is intentional for v1; drop
the entry from `matchKeys` if field-testing reveals confusion (SB3.b
candidate).

### SB2 — indexed history (`series[N]` + 4 history fns)

SB2 (2026-05-16) extends the grammar with the **historical reference layer**.
The TS Pratt parser at `app/lib/strategy/expression.ts` mirrors the backend
Python verbatim — same tokens, same binding powers, same error reason codes
— so the editor's instant-feedback parse matches what the server will accept.

| Addition | Shape | Notes |
|---|---|---|
| `SubscriptNode` | `{type: "subscript", series, offset}` | Postfix `series[N]`. Source `close[1]` parses to `Subscript(series=IndicatorRef(close), offset=Const(1))`. In SB2.0 `offset` must be a positive-integer constant; dynamic offsets are reserved for SB2.b. |
| `highest(series, N)` | `FunctionCall` | Rolling max over the last N bars. Length `N` must be a positive-integer literal. |
| `lowest(series, N)` | `FunctionCall` | Rolling min, same arity rules as `highest`. |
| `barssince(cond)` | `FunctionCall` | Bars since `cond` was last True (Pine `na` if never). The `cond` arg accepts a comparison-op tree (`rsi > 70`) — the only place SB2's `cmp_allowed` flag flips on inside the validator walk. |
| `valuewhen(cond, expr)` | `FunctionCall` | Value of `expr` at the bar `cond` was last True. Two-arg only in SB2.0 (Pine's `occurrence=N` third arg deferred to SB2.b). |

Lexer change: `[` is added to the operator set; the parser registers a postfix
led-handler at atom precedence so `close_price[1]` binds tighter than unary
minus (`-close[1]` parses as `-(close[1])`). `MATH_FN_NAMES` is extended with
the four history fn names; the existing function-call snippet path in
`<ExpressionInput>` autocomplete surfaces them with a "history" hint label
(via the new `MATH_FN_HINTS` map) instead of the generic "math fn" so the
dropdown reads like a real screener.

The three SB2 preset chips (above) ship in a "Historical context" mini-strip
appended to the `PRESET_CHIPS` array AFTER SB3's two volume entries. The
Donchian chips deliberately use the `[1]` shift on `highest`/`lowest` so the
breakout/breakdown is judged against the **prior** bar's rolling max/min —
matching Pine's `close > ta.highest(high, 20)[1]` convention. The same-bar
form (`close > highest(high, 20)`) is mathematically degenerate (OHLC
invariant: today's close cannot exceed today's high), and the tester
confirmed our evaluator correctly never fires the degenerate form across the
50-bar Donchian fixture.

Round-trip parity: every SB2 expression (`close > highest(high, 20)`,
`close[1]`, `barssince(rsi > 70)`, `valuewhen(rsi > 70, close_price)`)
round-trips exactly through `tryParseExpression` → `expressionToSource` →
`tryParseExpression` (string-equality stable across re-parses). Cross-system
verified: TS parser → AST JSON → Python deserialize → `_eval_expr` against
a real `pd.DataFrame` OHLC fixture matches `df.high.rolling(20).max()` for
every bar in a 50-bar window (under-warm bars return None on both sides).

SB2 reason codes (mirrored from backend, surfaced by the editor's inline
diagnostics): `subscript_offset_not_static`, `highest_lowest_length_invalid`,
`math_fn_arity`. Dossier:
`docs/design_call_dossiers/SB2_indexed_history_2026-05-16.md` (psxDataPortal).

### SB7 — calendar & cooldown filters (`dayofweek`, `entries_today`, `bars_since_entry`)

SB7 (2026-05-16) extends the indicator vocabulary with three **bare-identifier
tokens** that resolve at evaluator time against the current bar's date and the
per-strategy entry-signal ledger. No grammar change — the tokens slot into the
existing `IndicatorRefNode` path and compose with the standard comparison
operators on `SingleCondition.operator` (e.g. `dayofweek == 1`,
`entries_today < 2`, `bars_since_entry > 5`).

| Token | Range | Semantics | Pine analogue |
|---|---|---|---|
| `dayofweek` | 1–7 (Mon=1, Sun=7) | ISO weekday of the current bar's `trade_date` (matches Python `datetime.isoweekday()` and Pine v5 `dayofweek.monday=1` constants). PSX trades Mon–Fri so values 1–5 are the meaningful entries. | `dayofweek` (Pine v5 ISO alignment) |
| `entries_today` | 0…N | Count of entry signals fired *today, this strategy, this symbol*. Excludes the current bar's own pending signal (the ledger records AFTER evaluation, so a "max 2 per day" rule can't paradoxically block itself). | `strategy.opentrades` (closest analogue) |
| `bars_since_entry` | 0…N or `None` | Bars between the current bar and the most-recent entry on *this symbol*. `None` (≡ "never fired in the loaded window") propagates as a missing leaf — the outer condition short-circuits to `False`. | `ta.barssince(strategy.position_size != 0)` |

Three new preset chips ride alongside (table above): `monday-only` inserts
`dayofweek`, `max-entries-per-day` inserts `entries_today`,
`cooldown-5-bars` inserts `bars_since_entry`. Per the SB10/SB3/SB2
convention each chip inserts the LHS expression only — the user wires the
outer indicator + operator + threshold via the existing condition-drawer
surface. The chip `description` tooltips spell out the full canonical
pair (`dayofweek == 1`, `entries_today < 2`, `bars_since_entry > 5`).

Autocomplete: the three tokens are added to `KNOWN_INDICATORS` in
`expression.ts`, so the existing suggestion loop in `expression-input.tsx`
surfaces them automatically — typing `day` → `dayofweek`, `entries` →
`entries_today`, `bars` → both `barssince` (SB2 math fn) and
`bars_since_entry` (SB7 indicator), function-call hints first then
indicators.

Display labels (in `editor-view.tsx::formatIndicator`): `dayofweek` →
"Day of week", `entries_today` → "Entries today", `bars_since_entry` →
"Bars since last entry". The canvas-leaf chips show the friendly label
while the expression input + canonical serialization keep the wire name.

Calendar tokens that *defer* (no SB7.0 wire entries — would always read 0
on a daily bar): `hour`, `minute`, `is_first_session_bar`,
`is_last_session_bar`, `bar_of_day`. These ship in SB7.b alongside the
intraday data layer. Dossier:
`docs/design_call_dossiers/SB7_calendar_cooldown_2026-05-16.md` (psxDataPortal).

## `./layout.ts` — layered (logic-graph) auto-layout

Every node gets a `level` = depth from root (root=0, root.children=1, …) and
its X is derived purely from level: each level has its own column with the
root gate at the rightmost column and the deepest leaves at the leftmost.
This matches how a logic-gate / circuit diagram is conventionally drawn —
inputs flow left-to-right through gates toward the output.

| Function | Purpose |
|---|---|
| `layoutTree(root)` | Place every node. Recursive top-down Y packing by `subtreeHeight`; X derived from `level` via `columnLeftX`. Returns a `GroupLayout` with `(x, y, w, h)` for the bounding box, `gateX/Y` for the gate glyph, and `addSlotCx/Cy` for the per-gate add-input slot. |
| `walkLeaves(root)` | DFS leaf walk over the placed layout — used to render `<CondNode>`s. |
| `walkGroups(root)` | DFS walk over nested (non-root) groups — used to render `<GroupBox>`es and per-group gate buttons. |
| `collectSlots(root)` | One slot per group (root included). The slot inserts a new child at the END of that group's children list. |
| `layoutBounds(root)` | Tight bounding box of the placed tree, for SVG sizing and the canvas `fit` button. |

Constants: `NODE_W=200, NODE_H=108, GAP=12, GROUP_PAD=18, GROUP_LABEL_H=22,
GATE_W=104, GATE_H=76, COLUMN_GAP=80, COLUMN_PITCH=280, ADD_SLOT_W=140,
ADD_SLOT_H=32, ADD_SLOT_GAP=12, ROOT_GATE_X=410, ROOT_CHILD_Y=40`. The
gate glyph (`<GateGlyph size={GATE_W * 0.5}>`) is sized at half the box
width so the italic AND/OR text sits comfortably inside the gate
rectangle instead of spilling out.

### Layered layout invariants

- **Root gate is anchored.** `ROOT_GATE_X = 410` regardless of tree depth.
  Deep trees grow leftward into negative X (canvas is pannable; `fit`
  recenters). The output column (ExecNode + OutputPins) anchors off
  `root.gateX + GATE_W`, so it stays at a stable canvas position
  independent of the tree.
- **Same column for siblings.** A group's children all sit at level
  `parent.level + 1`, which means they share a column X. Their Y
  positions stack vertically by `subtreeHeight(child) + GAP`.
- **Gate position follows children.** A populated group's gate Y is the
  midpoint of its first and last child's pin Y, so wires fan in
  symmetrically. The gate is right-aligned within the column band
  (`gateX = leafColumnX + NODE_W - GATE_W`) so its left edge is at the
  same X across every level — wires entering the gate from the left
  arrive at a consistent X.
- **Single-child groups hide their gate.** `showGate = childCount > 1`.
  The single child wires straight to the grandparent's gate via
  `parentGateId` redirection, identical to the pre-layered behavior.
- **GroupBox wraps the actual bounding box.** Each non-root group
  computes its `(x, y, w, h)` from min/max over all descendants + its
  own gate + add-slot, then pads by `GROUP_PAD` and reserves
  `GROUP_LABEL_H` on top for the `GROUP · AND/OR` label. Box outlines
  reflect the real visual extent rather than a fixed column.
- **Add-slot is per-gate.** Every group (root, populated, empty) has
  exactly one slot, positioned **directly below the gate glyph** (one
  `ADD_SLOT_GAP` gap below the gate's bottom edge), horizontally
  centered on the gate. For tall groups this lands the slot mid-tree
  (between the children that flank the gate vertically) — that's
  intentional: the slot reads as "add an input to *this* gate". It
  stays inside the gate's column band, so it never overlaps a sibling
  subtree horizontally. Always-visible — no proximity-reveal, no
  between-sibling slots.
