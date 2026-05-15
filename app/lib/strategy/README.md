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

## Preset chips (SB10 + SB3)

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
