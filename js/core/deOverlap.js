// Pure "push apart, never reorder" position fix for canvas/canvas.js#applyAutoSpacingFix
// (the "🧭 Auto-arrange" suggestion banner — see io/crowdingWatcher.js/
// core/crowdingDetect.js). Deliberately NOT core/autoLayout.js's
// computeAutoLayout: that's a topological/barycenter re-layout that can and
// does reorder nodes based on graph structure — exactly what this feature
// must avoid, since the whole point is fixing *spacing* while leaving the
// user's own left-to-right/top-to-bottom arrangement alone. Instead this
// runs the same "sort/keep current order, walk pairs, push apart by the
// shortfall between required and actual gap" technique already proven by
// core/labelSpacing.js#spreadNodesForLabels and
// core/sequenceDiagram.js#distributeLifelineColumns, just generalized to
// arbitrary 2D bounding-box pairs instead of one axis.
import { rectsIntersect } from './geometry.js';

const MAX_ITERATIONS = 60;

/** The real minimum gap between two axis-aligned, non-overlapping rects —
 * 0 (or negative, folded to 0 by the caller) along whichever axis they
 * still overlap on, the straight-line distance otherwise. */
function rectGap(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  return Math.max(dx, dy);
}

/** Pushes every pair of nodes whose current gap is below `targetGap` apart
 * until it's exactly `targetGap` (or until `MAX_ITERATIONS` runs out on a
 * particularly tangled input) — nodes already spaced `targetGap` or more
 * apart are never touched at all. A real overlap (rectsIntersect true) is
 * just the extreme end of the same rule: its "gap" is deeply negative, so
 * it's always below any positive `targetGap` and gets separated the same
 * way, with no special-casing needed.
 *
 * Preserves order by construction: each iteration only ever moves two
 * overlapping/too-close nodes apart along whichever axis needs the least
 * total movement to clear that pair, splitting the move evenly and always
 * pushing each one further in the direction it already leans (the one
 * further left moves further left, etc.) — never far enough to leapfrog
 * past a third node in one step. Bounded by `MAX_ITERATIONS` so a
 * pathological input (e.g. many nodes stacked exactly on the same point)
 * can't loop forever; any leftover overlap after that many passes is left
 * for a future run rather than degrading into an infinite loop.
 *
 * @param {{id:string,x:number,y:number,w:number,h:number}[]} nodes
 * @param {number} targetGap minimum acceptable edge-to-edge gap, in px
 * @returns {Map<string,{x:number,y:number}>} nodeId -> new top-left
 *   position, for only the nodes that actually needed to move
 */
export function computeDeOverlapPositions(nodes, targetGap) {
  if (nodes.length < 2 || !(targetGap > 0)) return new Map();
  const positions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const dims = new Map(nodes.map((n) => [n.id, { w: n.w, h: n.h }]));
  const ids = nodes.map((n) => n.id);
  const pad = targetGap / 2;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let movedAny = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const aId = ids[i];
        const bId = ids[j];
        const aPos = positions.get(aId);
        const bPos = positions.get(bId);
        const aDim = dims.get(aId);
        const bDim = dims.get(bId);
        // Each rect padded by half the target gap on every side, so two
        // rects whose *padded* boxes still intersect are exactly the pairs
        // currently closer together than `targetGap` (or truly overlapping).
        const aRect = { x: aPos.x - pad, y: aPos.y - pad, w: aDim.w + pad * 2, h: aDim.h + pad * 2 };
        const bRect = { x: bPos.x - pad, y: bPos.y - pad, w: bDim.w + pad * 2, h: bDim.h + pad * 2 };
        if (!rectsIntersect(aRect, bRect)) continue;

        const overlapX = Math.min(aRect.x + aRect.w, bRect.x + bRect.w) - Math.max(aRect.x, bRect.x);
        const overlapY = Math.min(aRect.y + aRect.h, bRect.y + bRect.h) - Math.max(aRect.y, bRect.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        movedAny = true;

        const aCenterX = aPos.x + aDim.w / 2;
        const bCenterX = bPos.x + bDim.w / 2;
        const aCenterY = aPos.y + aDim.h / 2;
        const bCenterY = bPos.y + bDim.h / 2;
        // Push apart along whichever axis needs the smaller total move to
        // clear this one pair — and always in the direction each one
        // already leans relative to the other, so their relative order
        // along that axis never flips.
        if (overlapX < overlapY) {
          const dir = aCenterX <= bCenterX ? -1 : 1;
          const half = overlapX / 2;
          positions.set(aId, { x: aPos.x + dir * half, y: aPos.y });
          positions.set(bId, { x: bPos.x - dir * half, y: bPos.y });
        } else {
          const dir = aCenterY <= bCenterY ? -1 : 1;
          const half = overlapY / 2;
          positions.set(aId, { x: aPos.x, y: aPos.y + dir * half });
          positions.set(bId, { x: bPos.x, y: bPos.y - dir * half });
        }
      }
    }
    if (!movedAny) break;
  }

  const updates = new Map();
  for (const n of nodes) {
    const p = positions.get(n.id);
    if (Math.round(p.x) !== Math.round(n.x) || Math.round(p.y) !== Math.round(n.y)) {
      updates.set(n.id, p);
    }
  }
  return updates;
}

export { rectGap };
