// Pure geometry for Figma-like "smart alignment" guides while dragging a
// node (or a multi-selection, treated as one bounding box) — see
// canvas/nodeInteractions.js#beginMove. No DOM, no store.

const X_KEYS = ['left', 'center', 'right'];
const Y_KEYS = ['top', 'center', 'bottom'];

function xKeys(box) {
  return { left: box.x, center: box.x + box.w / 2, right: box.x + box.w };
}

function yKeys(box) {
  return { top: box.y, center: box.y + box.h / 2, bottom: box.y + box.h };
}

/** Given the moving selection's bounding box and every other (static) box on
 * the canvas, finds the single closest x-alignment and single closest
 * y-alignment within `threshold` (independently — a drag can snap on both
 * axes at once, e.g. into a static node's exact center). Returns a `{dx,
 * dy}` offset to nudge the moving box onto that alignment (0 on an axis
 * with no match), plus every guide *line* that offset actually lines up
 * with — not just the one that produced the snap, so e.g. three components
 * already sharing a left edge all light up together, the way Figma's own
 * guides do. */
export function computeAlignmentGuides(movingBox, staticBoxes, threshold = 6) {
  const mx = xKeys(movingBox);
  const my = yKeys(movingBox);

  let bestX = null; // { dist, delta, pos }
  let bestY = null;

  for (const box of staticBoxes) {
    const sx = xKeys(box);
    const sy = yKeys(box);
    for (const mk of X_KEYS) {
      for (const sk of X_KEYS) {
        const delta = sx[sk] - mx[mk];
        const dist = Math.abs(delta);
        if (dist <= threshold && (!bestX || dist < bestX.dist)) bestX = { dist, delta, pos: sx[sk] };
      }
    }
    for (const mk of Y_KEYS) {
      for (const sk of Y_KEYS) {
        const delta = sy[sk] - my[mk];
        const dist = Math.abs(delta);
        if (dist <= threshold && (!bestY || dist < bestY.dist)) bestY = { dist, delta, pos: sy[sk] };
      }
    }
  }

  const dx = bestX ? bestX.delta : 0;
  const dy = bestY ? bestY.delta : 0;
  const snapped = { x: movingBox.x + dx, y: movingBox.y + dy, w: movingBox.w, h: movingBox.h };

  const verticalGuides = [];
  if (bestX) {
    for (const box of staticBoxes) {
      const sx = xKeys(box);
      if (X_KEYS.some((k) => Math.abs(sx[k] - bestX.pos) < 0.01)) {
        verticalGuides.push({
          x: bestX.pos,
          y1: Math.min(box.y, snapped.y),
          y2: Math.max(box.y + box.h, snapped.y + snapped.h),
        });
      }
    }
  }

  const horizontalGuides = [];
  if (bestY) {
    for (const box of staticBoxes) {
      const sy = yKeys(box);
      if (Y_KEYS.some((k) => Math.abs(sy[k] - bestY.pos) < 0.01)) {
        horizontalGuides.push({
          y: bestY.pos,
          x1: Math.min(box.x, snapped.x),
          x2: Math.max(box.x + box.w, snapped.x + snapped.w),
        });
      }
    }
  }

  return { dx, dy, verticalGuides, horizontalGuides };
}

/** Bounding box spanning every node in `nodes` — used to treat a
 * multi-selection drag as one rectangle for alignment purposes, the same
 * way a single node's own box is used. */
export function boundingBoxOf(nodes) {
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
