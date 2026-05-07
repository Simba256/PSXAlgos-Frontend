// Layered (Sugiyama-style) auto-layout for the strategy condition tree.
//
// Every node gets a `level` = depth from root (root = 0). X is derived
// purely from level: each level has its own column, with the root gate
// at the rightmost column and the deepest leaves at the leftmost. This
// matches how a logic-gate / circuit diagram is conventionally drawn —
// inputs flow left-to-right through gates toward the output.
//
// Y is assigned top-down by recursive packing: each child's subtree
// occupies a vertical band of `subtreeHeight(child)` and siblings are
// stacked with `GAP` between bands. The gate of a populated group sits
// at the vertical midpoint of its children's pin Ys (so wires fan in
// symmetrically).
//
// Each group also gets a single "add input" slot attached to its gate
// — a wide always-visible "+ Add condition" button. There is exactly
// one slot per group; clicking it appends a new child to that group.
// This replaces the Phase D between/end/empty slot variants with a
// per-gate authoring affordance, which makes the binding explicit:
// you're adding an input to *this* gate, not somewhere on a column rail.
//
// The root gate's X is fixed (`ROOT_GATE_X`) so the output column
// (ExecNode + OutputPins, which derive their X from `rootOriginX`)
// doesn't drift with tree depth — deeper trees push leaves further
// left instead.

import type {
  ConditionGroup,
  ConditionLeaf,
  ConditionNode,
} from "./tree";

export const NODE_W = 200;
export const NODE_H = 108;
export const GAP = 12;
export const GATE_W = 104;
export const GATE_H = 76;
export const GROUP_PAD = 18;
export const GROUP_LABEL_H = 22;

// Layered layout constants. COLUMN_PITCH is the horizontal distance
// between two adjacent column centers; deeper levels are placed
// `COLUMN_PITCH` further to the left of their parent. NODE_W + COLUMN_GAP
// keeps a constant `COLUMN_GAP` between a leaf's right edge and the
// parent gate's left edge (where the wire connects).
export const COLUMN_GAP = 80;
export const COLUMN_PITCH = NODE_W + COLUMN_GAP;

// Per-group "add input" slot. One per group, attached to the gate so
// the user understands "this slot adds an input to this gate".
export const ADD_SLOT_W = 140;
export const ADD_SLOT_H = 32;
export const ADD_SLOT_GAP = GAP;

// Anchor: root gate sits at this X regardless of tree depth. Output
// column (Exec/Backtest/Live/Automate) anchors off `rootOriginX` so it
// stays stable; deep trees just extend leftward into negative X if
// needed (canvas is pannable).
export const ROOT_GATE_X = 410;
// Top of the canvas content. Leaves and gates are placed downward from
// here.
export const ROOT_CHILD_Y = 40;

export interface LeafLayout {
  kind: "condition";
  id: string;
  node: ConditionLeaf;
  x: number;
  y: number;
  w: number;
  h: number;
  pinX: number;
  pinY: number;
  parentGateId: string;
  level: number;
}

export interface GroupLayout {
  kind: "group";
  id: string;
  node: ConditionGroup;
  // Group's bounding box (used for the dashed `<GroupBox>` wrapper).
  // Wraps every descendant's visual + this group's own gate + the
  // add-slot button. Non-root groups also include GROUP_PAD margin and
  // GROUP_LABEL_H for the "GROUP · AND/OR" label.
  x: number;
  y: number;
  w: number;
  h: number;
  isRoot: boolean;
  showBox: boolean;
  showGate: boolean;
  children: NodeLayout[];
  // Gate position. Right-aligned within the group's column band
  // (gateX = leafColumnX + NODE_W - GATE_W) so the gate sits where the
  // wire would naturally land coming in from the leaf's right pin.
  gateX: number;
  gateY: number;
  // Outgoing pin (right side of the gate, or single-child's pin if
  // the gate is hidden).
  pinX: number;
  pinY: number;
  parentGateId: string | null;
  level: number;
  // Add-slot center. Always present (every group, including empty,
  // gets one).
  addSlotCx: number;
  addSlotCy: number;
}

export type NodeLayout = LeafLayout | GroupLayout;

// Subtree vertical extent in pixels. For populated groups the slot is
// always reserved below the children so siblings don't collide with
// it — even when the gate (and visually the slot) sit between children
// vertically, we keep the bounding band predictable.
function subtreeHeight(node: ConditionNode): number {
  if (node.kind === "condition") return NODE_H;
  const n = node.children.length;
  if (n === 0) {
    // Empty group: a placeholder row + the add-slot stacked below it.
    return NODE_H + ADD_SLOT_GAP + ADD_SLOT_H;
  }
  let sum = 0;
  for (const c of node.children) sum += subtreeHeight(c);
  sum += GAP * (n - 1);
  // Reserve the slot below the children so the next sibling never
  // overlaps the slot. The slot itself renders at the bottom of the
  // children band (see `place`).
  return sum + ADD_SLOT_GAP + ADD_SLOT_H;
}

// Column X for a given level. Level 0 (root) sits at ROOT_GATE_X minus
// the leaf-column-to-gate offset; deeper levels are progressively
// further left.
function columnLeftX(level: number): number {
  // Leaves at level L should have their LEFT edge at this X. Their
  // right edge sits at columnLeftX(L) + NODE_W. The parent gate at
  // level L-1 has its LEFT edge at columnLeftX(L) + COLUMN_PITCH +
  // (NODE_W - GATE_W) — i.e., ROOT_GATE_X for level 1, which is what
  // we want.
  // Solve so that gate at level 0 lands at ROOT_GATE_X:
  //   gateLeftX(0) = columnLeftX(0) + NODE_W - GATE_W = ROOT_GATE_X
  //   columnLeftX(0) = ROOT_GATE_X - NODE_W + GATE_W
  // For level L: shift left by L * COLUMN_PITCH.
  return ROOT_GATE_X - NODE_W + GATE_W - level * COLUMN_PITCH;
}

function place(
  node: ConditionNode,
  startY: number,
  parentGateId: string | null,
  level: number,
): NodeLayout {
  const colX = columnLeftX(level);

  if (node.kind === "condition") {
    return {
      kind: "condition",
      id: node.id,
      node,
      x: colX,
      y: startY,
      w: NODE_W,
      h: NODE_H,
      pinX: colX + NODE_W,
      pinY: startY + NODE_H / 2,
      parentGateId: parentGateId ?? "",
      level,
    };
  }

  // Group node.
  const childCount = node.children.length;
  const showGate = childCount > 1;
  const isRoot = level === 0;
  // Gate is right-aligned within the node-width column band so the
  // gate's left edge sits at the same X for every level (consistent
  // wire entry point).
  const gateLeftX = colX + NODE_W - GATE_W;

  // Empty group: a placeholder row plus the slot below it. No gate
  // (nothing to gate yet); the slot is the sole authoring path.
  if (childCount === 0) {
    const placeholderY = startY;
    const gateY = placeholderY + NODE_H / 2;
    const slotCx = gateLeftX + GATE_W / 2;
    // Slot sits directly below where the gate glyph would render so the
    // affordance reads as "add an input to *this* gate".
    const slotCy = gateY + GATE_H / 2 + ADD_SLOT_GAP + ADD_SLOT_H / 2;
    let minX = colX;
    let maxX = gateLeftX + GATE_W;
    let minY = placeholderY;
    let maxY = slotCy + ADD_SLOT_H / 2;
    minX = Math.min(minX, slotCx - ADD_SLOT_W / 2);
    maxX = Math.max(maxX, slotCx + ADD_SLOT_W / 2);
    if (!isRoot) {
      minX -= GROUP_PAD;
      maxX += GROUP_PAD;
      minY -= GROUP_LABEL_H + GROUP_PAD;
      maxY += GROUP_PAD;
    }
    return {
      kind: "group",
      id: node.id,
      node,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      isRoot,
      showBox: !isRoot,
      showGate: false,
      children: [],
      gateX: gateLeftX,
      gateY,
      pinX: gateLeftX + GATE_W,
      pinY: gateY,
      parentGateId,
      level,
      addSlotCx: slotCx,
      addSlotCy: slotCy,
    };
  }

  // Children inherit the current group's id as their parent gate
  // target. When this group's gate is hidden (n=1) the child wires
  // straight up to the grandparent's gate.
  const childParentGate = showGate ? node.id : parentGateId ?? "";

  // Place children top-down, packing by subtree height.
  let cy = startY;
  const placedChildren: NodeLayout[] = [];
  for (const child of node.children) {
    placedChildren.push(place(child, cy, childParentGate, level + 1));
    cy += subtreeHeight(child) + GAP;
  }

  // Gate Y: midpoint between first and last child's pin Y so wires
  // fan in symmetrically. For single-child groups (gate hidden) we
  // still compute a reasonable gateY for slot placement.
  let gateY: number;
  if (placedChildren.length === 1) {
    gateY = placedChildren[0].pinY;
  } else {
    const firstY = placedChildren[0].pinY;
    const lastY = placedChildren[placedChildren.length - 1].pinY;
    gateY = (firstY + lastY) / 2;
  }

  // Add-slot: just below the gate glyph (AND/OR text), horizontally
  // centered on the gate. The user reads it as "add an input to this
  // gate" because it's visually attached to the gate. For tall groups
  // the slot lands mid-tree (between the children that flank the gate
  // vertically) but stays inside the gate's column band, so it doesn't
  // overlap any sibling subtree horizontally.
  const slotCx = gateLeftX + GATE_W / 2;
  const slotCy = gateY + GATE_H / 2 + ADD_SLOT_GAP + ADD_SLOT_H / 2;

  // Outgoing pin: gate right edge if visible, else the single child's
  // own pin (wire passes straight through the hidden gate).
  let pinX: number;
  let pinY: number;
  if (showGate) {
    pinX = gateLeftX + GATE_W;
    pinY = gateY;
  } else {
    pinX = placedChildren[0].pinX;
    pinY = placedChildren[0].pinY;
  }

  // Bounding box for the GroupBox visual: wraps every descendant +
  // this group's gate + slot. Min/max walk over placed children's
  // already-computed bounding boxes (nested groups already wrap their
  // descendants).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of placedChildren) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + c.w > maxX) maxX = c.x + c.w;
    if (c.y + c.h > maxY) maxY = c.y + c.h;
  }
  // Gate (visible or hidden — slot still attaches to gate column).
  minX = Math.min(minX, gateLeftX);
  maxX = Math.max(maxX, gateLeftX + GATE_W);
  if (showGate) {
    minY = Math.min(minY, gateY - GATE_H / 2);
    maxY = Math.max(maxY, gateY + GATE_H / 2);
  }
  // Slot.
  minX = Math.min(minX, slotCx - ADD_SLOT_W / 2);
  maxX = Math.max(maxX, slotCx + ADD_SLOT_W / 2);
  minY = Math.min(minY, slotCy - ADD_SLOT_H / 2);
  maxY = Math.max(maxY, slotCy + ADD_SLOT_H / 2);
  if (!isRoot) {
    minX -= GROUP_PAD;
    maxX += GROUP_PAD;
    minY -= GROUP_LABEL_H + GROUP_PAD;
    maxY += GROUP_PAD;
  }

  return {
    kind: "group",
    id: node.id,
    node,
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    isRoot,
    showBox: !isRoot,
    showGate,
    children: placedChildren,
    gateX: gateLeftX,
    gateY,
    pinX,
    pinY,
    parentGateId,
    level,
    addSlotCx: slotCx,
    addSlotCy: slotCy,
  };
}

export function layoutTree(root: ConditionGroup): GroupLayout {
  return place(root, ROOT_CHILD_Y, null, 0) as GroupLayout;
}

// Walks a placed layout and yields every leaf in DFS order. Used by
// the canvas for rendering CondNodes.
export function walkLeaves(root: GroupLayout): LeafLayout[] {
  const out: LeafLayout[] = [];
  const visit = (n: NodeLayout) => {
    if (n.kind === "condition") out.push(n);
    else for (const c of n.children) visit(c);
  };
  for (const c of root.children) visit(c);
  return out;
}

// Walks a placed layout and yields every nested (non-root) group in
// DFS order. Used by the canvas for rendering GroupBoxes and gates.
export function walkGroups(root: GroupLayout): GroupLayout[] {
  const out: GroupLayout[] = [];
  const visit = (n: NodeLayout) => {
    if (n.kind === "group") {
      out.push(n);
      for (const c of n.children) visit(c);
    }
  };
  for (const c of root.children) visit(c);
  return out;
}

// One slot per group (root included). The slot inserts a new child at
// the END of the group's children list (`index = group.children.length`),
// which matches the per-gate "add input to this gate" affordance.
export interface InsertionSlot {
  parentId: string;
  index: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  // True when the group has no children yet — the picker copy switches
  // to a more inviting placeholder ("Click + to add your first
  // condition or group").
  isEmpty: boolean;
}

export function collectSlots(root: GroupLayout): InsertionSlot[] {
  const slots: InsertionSlot[] = [];
  const visit = (g: GroupLayout) => {
    slots.push({
      parentId: g.id,
      index: g.children.length,
      cx: g.addSlotCx,
      cy: g.addSlotCy,
      w: ADD_SLOT_W,
      h: ADD_SLOT_H,
      isEmpty: g.children.length === 0,
    });
    for (const c of g.children) {
      if (c.kind === "group") visit(c);
    }
  };
  visit(root);
  return slots;
}

// Reflects every X coordinate of an already-placed layout about a vertical
// axis at `axisX`. The reflected layout still reads top-to-bottom but flows
// left-to-right (children right of root) instead of right-to-left, which is
// what the Phase 4b mirrored exit tree needs — same recursive packing as the
// entry tree, just with the wire-flow direction reversed.
//
// Reflection rules:
//   • Point coords (pinX, addSlotCx)            → 2*axisX - x
//   • Left-edge of width-w box (node.x)         → 2*axisX - x - w
//   • Left-edge of GATE_W box (gateX)           → 2*axisX - x - GATE_W
//
// `parentGateId`, `level`, `id`, `node`, and the y/h bands pass through
// untouched — only horizontal geometry flips. The result is a plain
// GroupLayout the canvas can render alongside the entry layout.
export function mirrorLayout(layout: GroupLayout, axisX: number): GroupLayout {
  const flipPoint = (x: number) => 2 * axisX - x;
  const flipBoxX = (x: number, w: number) => 2 * axisX - x - w;
  const visit = (n: NodeLayout): NodeLayout => {
    if (n.kind === "condition") {
      return {
        ...n,
        x: flipBoxX(n.x, n.w),
        pinX: flipPoint(n.pinX),
      };
    }
    return {
      ...n,
      x: flipBoxX(n.x, n.w),
      gateX: flipBoxX(n.gateX, GATE_W),
      pinX: flipPoint(n.pinX),
      addSlotCx: flipPoint(n.addSlotCx),
      children: n.children.map(visit),
    };
  };
  return visit(layout) as GroupLayout;
}

// Total bounding box in canvas coords. Walks every descendant and
// includes the root's own gate + slot. Used to size the SVG wire layer
// and ensure the world layer is large enough for the tree at any depth.
export function layoutBounds(root: GroupLayout): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = root.gateX;
  let minY = root.y;
  let maxX = root.gateX + GATE_W;
  let maxY = root.y + root.h;
  const visit = (n: NodeLayout) => {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
    if (n.kind === "group") {
      for (const c of n.children) visit(c);
    }
  };
  for (const c of root.children) visit(c);
  // Root's add-slot may extend past root.h since root has no
  // GROUP_PAD wrapping.
  maxY = Math.max(maxY, root.addSlotCy + ADD_SLOT_H / 2);
  return { minX, minY, maxX, maxY };
}
