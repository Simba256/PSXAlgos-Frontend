// Auto-layout for the condition-tree canvas.
//
// Two-pass: a bottom-up `size` pass computes each subtree's bounding box,
// then a top-down `place` pass assigns absolute (x, y) coordinates and the
// per-group gate position. Output is a parallel layout tree that the
// renderer walks once for box/leaf/gate placement and once for wire paths.
//
// The root is special: it never renders a box or label, and its children
// land at fixed canvas coordinates (NODE_X=40, NODE_Y0=40) so that flat
// (depth-1) strategies stay pixel-near-identical to the pre-Phase-C
// hand-tuned layout. Nested groups get the natural recursive geometry.
//
// Constants are tuned against the pre-Phase-C layout: ROOT_HGAP=170 places
// the root gate at x≈410 (matching the old `gateBlockX`); GAP=12 matches
// the old NODE_GAP - NODE_H spacing between siblings.

import type {
  ConditionGroup,
  ConditionLeaf,
  ConditionNode,
} from "./tree";

export const NODE_W = 200;
export const NODE_H = 108;
export const GAP = 12;
export const GROUP_PAD = 18;
export const GROUP_LABEL_H = 22;
export const GATE_W = 68;
export const GATE_H = 68;
export const INNER_HGAP = 80;
export const ROOT_HGAP = 170;
export const ROOT_CHILD_X = 40;
export const ROOT_CHILD_Y = 40;

// Phase D: between-sibling slot icon size. Stays small + hover-reveal so
// dense trees don't get visually cluttered with `+` buttons everywhere.
export const SLOT_SIZE = 16;
// Phase D follow-up: the end-slot is the discoverability path for
// "add another condition/group", so it renders as a wide always-visible
// button instead of the tiny hover-reveal pixel. One per group (after the
// last child); a depth-1 single-condition tree shows exactly one.
export const END_SLOT_W = 140;
export const END_SLOT_H = 32;
// Vertical breathing room between the last child and the end-slot button.
// Matches `GAP` so the slot sits one full sibling-gap below the node.
export const END_SLOT_OFFSET = GAP;
// Empty-group placeholder is a wider drop target so users have an obvious
// click area when a group has no children yet.
export const EMPTY_SLOT_W = 140;
export const EMPTY_SLOT_H = NODE_H;

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
}

export interface GroupLayout {
  kind: "group";
  id: string;
  node: ConditionGroup;
  x: number;
  y: number;
  w: number;
  h: number;
  isRoot: boolean;
  showBox: boolean;
  showGate: boolean;
  children: NodeLayout[];
  gateX: number;
  gateY: number;
  pinX: number;
  pinY: number;
  parentGateId: string | null;
}

export type NodeLayout = LeafLayout | GroupLayout;

interface Size {
  w: number;
  h: number;
}

// Max bounding box of a subtree rooted at `node`. Empty groups still claim
// a slot wide enough for an inline `+` placeholder (Phase D wires that to
// real insertion); for now the slot just keeps the layout from collapsing.
function size(node: ConditionNode, isRoot: boolean): Size {
  if (node.kind === "condition") return { w: NODE_W, h: NODE_H };
  const childCount = node.children.length;
  const hgap = isRoot ? ROOT_HGAP : INNER_HGAP;
  const showGate = childCount > 1;

  let inner: Size;
  if (childCount === 0) {
    inner = { w: NODE_W, h: NODE_H };
  } else {
    let maxW = 0;
    let sumH = 0;
    for (const child of node.children) {
      const sz = size(child, false);
      if (sz.w > maxW) maxW = sz.w;
      sumH += sz.h;
    }
    sumH += GAP * (childCount - 1);
    inner = { w: maxW, h: sumH };
  }

  const gateExtra = showGate ? hgap + GATE_W : 0;
  const innerW = inner.w + gateExtra;
  const innerH = inner.h;

  if (isRoot) {
    return { w: innerW, h: innerH };
  }
  return {
    w: innerW + 2 * GROUP_PAD,
    h: innerH + 2 * GROUP_PAD + GROUP_LABEL_H,
  };
}

function place(
  node: ConditionNode,
  frameX: number,
  frameY: number,
  isRoot: boolean,
  parentGateId: string | null,
): NodeLayout {
  if (node.kind === "condition") {
    return {
      kind: "condition",
      id: node.id,
      node,
      x: frameX,
      y: frameY,
      w: NODE_W,
      h: NODE_H,
      pinX: frameX + NODE_W,
      pinY: frameY + NODE_H / 2,
      parentGateId: parentGateId ?? "",
    };
  }

  const sz = size(node, isRoot);
  const childCount = node.children.length;
  const showGate = childCount > 1;
  const hgap = isRoot ? ROOT_HGAP : INNER_HGAP;

  const childInnerX = isRoot ? ROOT_CHILD_X : frameX + GROUP_PAD;
  const childInnerY = isRoot ? ROOT_CHILD_Y : frameY + GROUP_PAD + GROUP_LABEL_H;

  // Children inherit the current group's id as their parent gate target.
  // When this group's gate is hidden (n <= 1) we redirect them up to the
  // grandparent so the wire skips the empty gate.
  const childParentGate = showGate ? node.id : parentGateId ?? "";
  const placedChildren: NodeLayout[] = [];
  let cy = childInnerY;
  for (const child of node.children) {
    placedChildren.push(place(child, childInnerX, cy, false, childParentGate));
    const childSz = size(child, false);
    cy += childSz.h + GAP;
  }

  // Gate centerline. With mixed-height children, the (first + last) / 2
  // rule keeps the gate visually "between" the outermost branches rather
  // than being pulled toward the heaviest one (Gap 15 in the plan).
  let gateY: number;
  if (placedChildren.length === 0) {
    gateY = childInnerY + NODE_H / 2;
  } else if (placedChildren.length === 1) {
    const only = placedChildren[0];
    gateY =
      only.kind === "condition" ? only.pinY : (only as GroupLayout).pinY;
  } else {
    const first = placedChildren[0];
    const last = placedChildren[placedChildren.length - 1];
    const firstY =
      first.kind === "condition" ? first.pinY : (first as GroupLayout).pinY;
    const lastY =
      last.kind === "condition" ? last.pinY : (last as GroupLayout).pinY;
    gateY = (firstY + lastY) / 2;
  }

  // Gate sits to the right of the children column inside the group's pad.
  let maxChildRight = childInnerX;
  for (const c of placedChildren) {
    const r = c.x + c.w;
    if (r > maxChildRight) maxChildRight = r;
  }
  // Empty group: keep a placeholder width so the box doesn't collapse.
  if (placedChildren.length === 0) maxChildRight = childInnerX + NODE_W;
  const gateX = maxChildRight + hgap;

  // The group's outgoing pin is the gate when visible, otherwise the only
  // child's own outgoing pin (the wire passes straight through the box).
  // Empty groups expose their right-edge midpoint so layout stays valid.
  let pinX: number;
  let pinY: number;
  if (showGate) {
    pinX = gateX + GATE_W;
    pinY = gateY;
  } else if (placedChildren.length === 1) {
    const only = placedChildren[0];
    pinX = only.kind === "condition" ? only.pinX : (only as GroupLayout).pinX;
    pinY = only.kind === "condition" ? only.pinY : (only as GroupLayout).pinY;
  } else {
    pinX = isRoot ? frameX : frameX + sz.w;
    pinY = gateY;
  }

  return {
    kind: "group",
    id: node.id,
    node,
    x: frameX,
    y: frameY,
    w: sz.w,
    h: sz.h,
    isRoot,
    showBox: !isRoot,
    showGate,
    children: placedChildren,
    gateX,
    gateY,
    pinX,
    pinY,
    parentGateId,
  };
}

export function layoutTree(root: ConditionGroup): GroupLayout {
  // Root is anchored so its children land at (ROOT_CHILD_X, ROOT_CHILD_Y),
  // independent of frame coords. We pass (0, 0) as a placeholder and the
  // root branch in `place` ignores it.
  return place(root, 0, 0, true, null) as GroupLayout;
}

// Walks a placed layout and yields every leaf in DFS order. Used by the
// canvas for rendering CondNodes.
export function walkLeaves(root: GroupLayout): LeafLayout[] {
  const out: LeafLayout[] = [];
  const visit = (n: NodeLayout) => {
    if (n.kind === "condition") out.push(n);
    else for (const c of n.children) visit(c);
  };
  for (const c of root.children) visit(c);
  return out;
}

// Walks a placed layout and yields every nested (non-root) group in DFS
// order. Used by the canvas for rendering GroupBoxes and gates.
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

// Phase D: an authoring slot the user can click to insert a new child.
// `parentId` + `index` together describe where `insertChild` should drop
// the new node. `variant` lets the renderer choose between a small `+`
// (between/end) and a larger placeholder for empty groups.
export interface InsertionSlot {
  parentId: string;
  index: number;
  variant: "between" | "end" | "empty";
  // Center coordinates of the slot's interactive region. Renderer offsets
  // by half-size to position absolutely.
  cx: number;
  cy: number;
  // Slot box dimensions. `between`/`end` use SLOT_SIZE; `empty` uses the
  // wider EMPTY_SLOT_W/H so the click target matches the visual.
  w: number;
  h: number;
}

// Walks every group (including the root) in a placed layout and emits
// insertion slots: between every pair of adjacent children, after the last
// child, or — for empty groups — a single centered placeholder. Slot
// coordinates use the same canvas coords as `walkLeaves` / `walkGroups`,
// so the renderer can drop them straight into the world layer.
export function collectSlots(root: GroupLayout): InsertionSlot[] {
  const slots: InsertionSlot[] = [];

  const visit = (g: GroupLayout) => {
    const childInnerX = g.isRoot ? ROOT_CHILD_X : g.x + GROUP_PAD;
    const childInnerY = g.isRoot ? ROOT_CHILD_Y : g.y + GROUP_PAD + GROUP_LABEL_H;
    // Center the small `+` slots on the node column (children are aligned
    // left at childInnerX with width NODE_W).
    const slotCx = childInnerX + NODE_W / 2;

    if (g.children.length === 0) {
      // Empty group: a single large placeholder centered where the first
      // child would land.
      slots.push({
        parentId: g.id,
        index: 0,
        variant: "empty",
        cx: childInnerX + EMPTY_SLOT_W / 2,
        cy: childInnerY + EMPTY_SLOT_H / 2,
        w: EMPTY_SLOT_W,
        h: EMPTY_SLOT_H,
      });
    } else {
      // Between every adjacent pair: slot centered in the gap region.
      for (let i = 0; i < g.children.length - 1; i++) {
        const a = g.children[i];
        const b = g.children[i + 1];
        const cy = (a.y + a.h + b.y) / 2;
        slots.push({
          parentId: g.id,
          index: i + 1,
          variant: "between",
          cx: slotCx,
          cy,
          w: SLOT_SIZE,
          h: SLOT_SIZE,
        });
      }
      // End slot: a wide always-visible button sitting one full GAP below
      // the last child, so it reads as an "Add another" affordance rather
      // than visually attached to the node above it.
      const last = g.children[g.children.length - 1];
      slots.push({
        parentId: g.id,
        index: g.children.length,
        variant: "end",
        cx: slotCx,
        cy: last.y + last.h + END_SLOT_OFFSET + END_SLOT_H / 2,
        w: END_SLOT_W,
        h: END_SLOT_H,
      });
    }

    for (const c of g.children) {
      if (c.kind === "group") visit(c);
    }
  };

  visit(root);
  return slots;
}

// Total bounding box in canvas coords. Used to size the SVG wire layer
// and ensure the world layer is large enough for the tree at all depths.
export function layoutBounds(root: GroupLayout): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = ROOT_CHILD_X;
  let minY = ROOT_CHILD_Y;
  let maxX = root.gateX + GATE_W;
  let maxY = ROOT_CHILD_Y;
  const visit = (n: NodeLayout) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
    if (n.kind === "group") {
      maxX = Math.max(maxX, n.gateX + GATE_W);
      for (const c of n.children) visit(c);
    }
  };
  for (const c of root.children) visit(c);
  if (root.showGate) {
    maxX = Math.max(maxX, root.gateX + GATE_W);
  }
  // Every populated group renders an always-visible end-slot one full GAP
  // below its last child. Extend maxY so the world layer doesn't clip it.
  const visitForEndSlot = (g: GroupLayout) => {
    if (g.children.length > 0) {
      const last = g.children[g.children.length - 1];
      maxY = Math.max(maxY, last.y + last.h + END_SLOT_OFFSET + END_SLOT_H);
    }
    for (const c of g.children) {
      if (c.kind === "group") visitForEndSlot(c);
    }
  };
  visitForEndSlot(root);
  return { minX, minY, maxX, maxY };
}
