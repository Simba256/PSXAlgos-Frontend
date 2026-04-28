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
| `flattenLeaves(root)` | DFS leaf-only walk (Phase B canvas uses this). |
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

## `./layout.ts` — auto-layout for the canvas

Phase C's two-pass layout algorithm. `layoutTree(root)` returns a parallel
`GroupLayout` / `LeafLayout` tree with absolute pixel coordinates: `(x, y)`
on every node, plus per-group `gateX`/`gateY` and outgoing-pin coordinates.

| Function | Purpose |
|---|---|
| `layoutTree(root)` | Bottom-up size + top-down place. Anchors root at `(ROOT_CHILD_X, ROOT_CHILD_Y)` so depth-1 trees match the pre-Phase-C canvas pixel-for-pixel at the gate. |
| `walkLeaves(root)` | DFS leaf walk over the placed layout — used to render `<CondNode>`s. |
| `walkGroups(root)` | DFS walk over nested (non-root) groups — used to render `<GroupBox>`es and per-group gate buttons. |
| `collectSlots(root)` | Phase D: every group's insertion slots (`between`, `end`, or `empty`) in canvas coords — drives the inline `+` authoring UI. |
| `layoutBounds(root)` | Tight bounding box of the placed tree, for SVG sizing. |

Constants: `NODE_W=200, NODE_H=108, GAP=12, GROUP_PAD=18, GROUP_LABEL_H=22,
GATE_W=68, GATE_H=68, INNER_HGAP=80, ROOT_HGAP=170, SLOT_SIZE=16,
END_SLOT_W=140, END_SLOT_H=32, END_SLOT_OFFSET=12, EMPTY_SLOT_W=140,
EMPTY_SLOT_H=108`.

Single-child groups (n=1) hide their gate; the only child's wire is routed
through the box directly to the grandparent's gate. The root never renders
a box — its gate sits at the same canvas position the pre-Phase-C global
gate occupied (`x ≈ 410` for a depth-1 tree).

### Slot variants (`collectSlots`)

- **`between`** — `(children.length - 1)` slots, each centered in the
  vertical gap between two adjacent children. `SLOT_SIZE` (16px) round
  pip; cursor-proximity reveal (opacity = 1 − dist/80px) so dense trees
  don't get cluttered. Inserts at `index = i + 1`.
- **`end`** — one wide button (`END_SLOT_W` × `END_SLOT_H` = 140×32) sitting
  one full `END_SLOT_OFFSET` (= `GAP`) below the last child. **Always
  visible** — this is the primary discoverability path for "add another
  condition", so it doesn't hide behind hover-reveal. Inserts at
  `index = children.length`.
- **`empty`** — one wider placeholder centered where the first child
  would land, emitted only when the group has zero children. Always
  visible at full opacity; the editor adds the *"Click + to add your
  first condition or group"* copy when this is the root group.
