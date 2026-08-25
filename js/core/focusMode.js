// Pure "spotlight" set computation for Focus Mode (see canvas/canvas.js's
// applyFocusDimming) — everything else on the canvas gets a `.dimmed` CSS
// class rather than being hidden, so the rest of the diagram stays visible
// as context, just visually de-emphasized.

/**
 * @param {string[]} selectedNodeIds
 * @param {{id:string, from:string, to:string}[]} edges
 * @returns {{nodeIds: Set<string>, edgeIds: Set<string>}} every node/edge
 *   that should stay at full opacity: the selection itself, every node
 *   directly connected to it by an edge, and every edge touching a
 *   selected node. An edge between two *neighbors* (neither endpoint
 *   actually selected) is not included — only the selection's own direct
 *   connections count as "in the spotlight".
 */
export function computeFocusedIds(selectedNodeIds, edges) {
  const selected = new Set(selectedNodeIds);
  const nodeIds = new Set(selected);
  const edgeIds = new Set();
  for (const e of edges) {
    if (selected.has(e.from) || selected.has(e.to)) {
      nodeIds.add(e.from);
      nodeIds.add(e.to);
      edgeIds.add(e.id);
    }
  }
  return { nodeIds, edgeIds };
}
