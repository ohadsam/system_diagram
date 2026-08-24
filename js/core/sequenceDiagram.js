// Pure layout math for the "Sequence Diagram" wizard (see
// modals/sequenceDiagramModal.js): turns a flat list of participant names
// into evenly-spaced lifeline rects, centered on a given point. No DOM/store
// access — see canvas/canvas.js#createSequenceDiagram for where the result
// actually becomes real nodes.
import { sideAnchor } from './geometry.js';

// Also reused by canvas.js#addLifelineToRight (the quick "add lifeline"
// context-menu action) so a manually-added participant lines up with the
// wizard's own spacing.
export const GAP = 220;
// Keeps a redistributed message's offset clear of a lifeline's own title
// box at the top and its very bottom end, same margin on both sides.
const OFFSET_MARGIN = 0.08;

/**
 * @param {string[]} names participant names, in left-to-right order
 * @param {number} centerX canvas-space x to center the whole row on
 * @param {number} centerY canvas-space y for the top of every lifeline
 * @param {{w:number,h:number}} size each lifeline's size
 * @returns {{text:string, x:number, y:number, w:number, h:number}[]}
 */
export function layoutLifelines(names, centerX, centerY, size) {
  const totalWidth = names.length > 0 ? (names.length - 1) * GAP + size.w : size.w;
  const startX = centerX - totalWidth / 2;
  return names.map((text, i) => ({
    text,
    x: startX + i * GAP,
    y: centerY,
    w: size.w,
    h: size.h,
  }));
}

/**
 * "Distribute evenly" (Tools dropdown, see canvas.js#distributeSequenceDiagram)
 * — part 1: re-spaces every lifeline currently on the canvas to the same
 * `GAP` the wizard itself uses, preserving their existing left-to-right
 * order (and each one's own y/height) rather than imposing the wizard's
 * layout wholesale. Returns a Map<nodeId, newX>; empty if fewer than 2
 * lifelines exist (nothing to redistribute).
 */
export function distributeLifelineColumns(nodes) {
  const lifelines = nodes.filter((n) => n.shape === 'lifeline').sort((a, b) => a.x - b.x);
  const updates = new Map();
  if (lifelines.length < 2) return updates;
  const startX = lifelines[0].x;
  lifelines.forEach((n, i) => updates.set(n.id, startX + i * GAP));
  return updates;
}

/**
 * "Distribute evenly" — part 2: re-spaces every message's height along its
 * lifeline(s), preserving the current top-to-bottom order (same order
 * canvas.js#computeMessageSequenceNumbers already derives and numbers) so
 * the redistribution never reshuffles *what happens when*, only how evenly
 * the gaps between events are spaced. A self-message (see connector.js
 * #selfLoopPath) contributes two independent points — its start and end
 * height both matter for the loop shape — everything else contributes one
 * shared point applied to both ends, since an ordinary message is drawn
 * horizontal. Returns Map<edgeId, {fromOffset?, toOffset?}>.
 */
export function distributeMessages(nodes, edges) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const events = [];
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (fromNode?.shape !== 'lifeline' || toNode?.shape !== 'lifeline') continue;
    const isSelf = edge.from === edge.to;
    events.push({ edgeId: edge.id, end: 'from', y: sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5).y });
    if (isSelf) {
      events.push({ edgeId: edge.id, end: 'to', y: sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5).y });
    }
  }
  events.sort((a, b) => a.y - b.y);

  const updates = new Map();
  const step = events.length > 1 ? (1 - 2 * OFFSET_MARGIN) / (events.length - 1) : 0;
  events.forEach((ev, i) => {
    const offset = events.length > 1 ? OFFSET_MARGIN + i * step : 0.5;
    const cur = updates.get(ev.edgeId) || {};
    cur[ev.end === 'from' ? 'fromOffset' : 'toOffset'] = offset;
    updates.set(ev.edgeId, cur);
  });
  // A non-self message only ever contributed a single 'from' event above —
  // mirror the same value onto toOffset so both ends land on one shared,
  // horizontal height.
  for (const [edgeId, upd] of updates) {
    const edge = edges.find((e) => e.id === edgeId);
    if (edge && edge.from !== edge.to && upd.toOffset == null) upd.toOffset = upd.fromOffset;
  }
  return updates;
}
