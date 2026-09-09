// Pure detector behind the proactive "this looks crowded — auto-arrange
// it?" nudge (io/crowdingWatcher.js, hints/crowdingSuggestionBanner.js,
// canvas/canvas.js#applyAutoSpacingFix). Two independent signals, both
// resolved by the *same* `targetGap` threshold so detection and the fix
// agree exactly on "how close is too close":
//
//  1. Real overlap — two node boxes actually intersect. Always flagged,
//     regardless of diagram size or style.
//  2. Uneven spacing — a node sits far closer to its nearest neighbor than
//     the diagram's *own* typical (median) nearest-neighbor gap, the way a
//     component freshly dropped right next to an existing one would, while
//     everything else already has generous breathing room. Only checked
//     once there are enough nodes for "the rest of the diagram" to mean
//     anything (see MIN_NODES_FOR_UNEVEN_CHECK), and only once the
//     diagram's own median gap clears UNEVEN_MEDIAN_FLOOR_PX — a diagram
//     that's uniformly tight *by design* (a dense grid of small icons) has
//     nothing to be "uneven" relative to, so it's never flagged just for
//     being consistently snug.
//
// Deliberately node-geometry only (a sticky note, title, or plain shape are
// all just nodes with x/y/w/h, so "texts" are already covered) — arrow/
// connector *path* overlap is a much harder routing problem this doesn't
// attempt; a labeled edge whose two endpoints are too close for the label
// to fit is a separate, already-solved concern (see
// core/labelSpacing.js#spreadNodesForLabels), folded in as a second signal
// by whichever caller wires this up rather than duplicated here.
//
// An `animationOnly` node (core/project.js#createNode) is invisible on the
// normal editing canvas whenever this watcher would actually run (see
// canvas.js#isAnimationOnlyVisible) — including it would nudge about
// clutter nobody can currently see, so it's excluded unconditionally.
import { rectsIntersect } from './geometry.js';
import { rectGap } from './deOverlap.js';

export const MIN_BREATHING_GAP_PX = 16;
export const UNEVEN_SPACING_RATIO = 0.3;
export const UNEVEN_MEDIAN_FLOOR_PX = 40;
const MIN_NODES_FOR_UNEVEN_CHECK = 4;

/** @param {{id:string,x:number,y:number,w:number,h:number,animationOnly?:boolean}[]} rawNodes
 * @returns {null|{affectedNodeIds:string[], targetGap:number}} null if the
 *   diagram doesn't currently look crowded; otherwise every node involved
 *   in an overlap or an unevenly-tight gap, plus the gap (px) a fix should
 *   aim for — the same threshold this function itself used to decide. */
export function detectCrowding(rawNodes) {
  const nodes = rawNodes.filter((n) => !n.animationOnly);
  if (nodes.length < 2) return null;

  const overlappingIds = new Set();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (rectsIntersect(nodes[i], nodes[j])) {
        overlappingIds.add(nodes[i].id);
        overlappingIds.add(nodes[j].id);
      }
    }
  }

  let unevenIds = new Set();
  let targetGap = MIN_BREATHING_GAP_PX;
  if (nodes.length >= MIN_NODES_FOR_UNEVEN_CHECK) {
    const nearestGaps = nodes.map((n) => {
      let min = Infinity;
      for (const other of nodes) {
        if (other.id === n.id) continue;
        const gap = rectsIntersect(n, other) ? 0 : rectGap(n, other);
        if (gap < min) min = gap;
      }
      return { id: n.id, gap: min };
    });
    const sorted = [...nearestGaps].map((g) => g.gap).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median >= UNEVEN_MEDIAN_FLOOR_PX) {
      const threshold = median * UNEVEN_SPACING_RATIO;
      targetGap = Math.max(MIN_BREATHING_GAP_PX, threshold);
      for (const { id, gap } of nearestGaps) {
        if (gap < threshold) unevenIds.add(id);
      }
    }
  }

  const affectedNodeIds = new Set([...overlappingIds, ...unevenIds]);
  if (!affectedNodeIds.size) return null;
  return { affectedNodeIds: [...affectedNodeIds], targetGap };
}
