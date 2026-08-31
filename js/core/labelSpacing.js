// "🔤 Fix Text Display" (Tools dropdown, see canvas.js#fixTextDisplay) for a
// regular (non-sequence-diagram) canvas — a labeled edge whose two endpoint
// nodes sit closer together than its (now-wrapped, see core/labelWrap.js)
// label actually needs visually collides with one or both nodes. This
// nudges the two endpoints directly apart along the line between their
// centers, splitting the shortfall evenly, and leaves everything else
// (routing, unrelated nodes) untouched — a targeted fix, not a re-layout.
import { estimateWrappedBlockSize, DEFAULT_LABEL_MAX_WIDTH } from './labelWrap.js';

const LABEL_CLEARANCE_PX = 16;

/**
 * @param {object[]} nodes @param {object[]} edges
 * @returns {Map<string, {x:number, y:number}>} nodeId -> new top-left
 *   position, for only the nodes that actually needed to move. A node
 *   referenced by more than one adjusted edge accumulates every nudge it's
 *   part of, applied in edge-array order.
 */
export function spreadNodesForLabels(nodes, edges) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const positions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  for (const edge of edges) {
    if (!edge.label) continue;
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (!fromNode || !toNode || fromNode.id === toNode.id) continue;

    const required = estimateWrappedBlockSize(edge.label, DEFAULT_LABEL_MAX_WIDTH).width + LABEL_CLEARANCE_PX * 2;
    const a = positions.get(fromNode.id);
    const b = positions.get(toNode.id);
    const fromCx = a.x + fromNode.w / 2;
    const fromCy = a.y + fromNode.h / 2;
    const toCx = b.x + toNode.w / 2;
    const toCy = b.y + toNode.h / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;
    const dist = Math.hypot(dx, dy) || 1;
    const shortfall = required - dist;
    if (shortfall <= 0) continue;

    const ux = dx / dist;
    const uy = dy / dist;
    const half = shortfall / 2;
    a.x -= ux * half;
    a.y -= uy * half;
    b.x += ux * half;
    b.y += uy * half;
  }

  const updates = new Map();
  for (const n of nodes) {
    const p = positions.get(n.id);
    if (p.x !== n.x || p.y !== n.y) updates.set(n.id, { x: p.x, y: p.y });
  }
  return updates;
}
