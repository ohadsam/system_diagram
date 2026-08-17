// Pure, DOM-free layered ("Sugiyama-style", simplified) auto-layout for the
// whole canvas — computes new top-left positions for every node based on
// edge direction (from -> to), so a source flows into its dependents
// top-to-bottom, one row ("rank") per hop from the nearest root. No DOM/
// store access, so it's unit-testable in plain Node — see
// canvas.js#autoArrangeAll for where the result actually gets applied.
//
// Deliberately not a full production Sugiyama solve (iterative median
// ordering, dummy nodes for long edges, etc.) — a single barycenter
// ordering pass is enough to keep obviously-related chains roughly
// aligned instead of shuffled arbitrarily, without the added complexity.
// Grouped nodes (`groupId`) are laid out independently like any other
// node — auto-layout only rewrites position, group membership/move-
// together behavior is unaffected.

const LAYER_GAP_Y = 140;
const NODE_GAP_X = 60;
const START_X = 80;
const START_Y = 80;
const MAX_ROW_WIDTH = 1800;

/**
 * @param {{id:string,x:number,y:number,w:number,h:number}[]} nodes
 * @param {{from:string,to:string}[]} edges
 * @returns {Map<string,{x:number,y:number}>} new top-left position per node id
 */
export function computeAutoLayout(nodes, edges) {
  const positions = new Map();
  if (!nodes.length) return positions;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map(nodes.map((n) => [n.id, []]));
  const incomingFrom = new Map(nodes.map((n) => [n.id, []]));
  const remainingIncoming = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to) continue;
    outgoing.get(e.from).push(e.to);
    incomingFrom.get(e.to).push(e.from);
    remainingIncoming.set(e.to, remainingIncoming.get(e.to) + 1);
  }

  // Rank assignment: longest path from any "source" (no incoming edges),
  // via Kahn's-algorithm-style topological processing — each node's rank
  // becomes one more than the deepest predecessor already placed, so a
  // multi-hop chain always flows strictly downward. Ties (same rank)
  // resolved by original node order, which keeps the result predictable
  // rather than depending on Set/Map iteration quirks.
  const rank = new Map();
  const visited = new Set();
  let frontier = nodes.filter((n) => remainingIncoming.get(n.id) === 0).map((n) => n.id);
  let currentRank = 0;
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      rank.set(id, currentRank);
      for (const toId of outgoing.get(id)) {
        remainingIncoming.set(toId, remainingIncoming.get(toId) - 1);
        if (remainingIncoming.get(toId) === 0 && !visited.has(toId)) next.push(toId);
      }
    }
    frontier = next;
    currentRank += 1;
  }
  // Cycle fallback: a node that's part of a cycle (or only fed by one)
  // never reaches remainingIncoming === 0 above and is left unranked —
  // append it one rank below the deepest rank seen so far instead of
  // hanging/crashing on a non-DAG graph.
  const deepestRank = rank.size ? Math.max(...rank.values()) : -1;
  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, deepestRank + 1);
  }

  const layers = [];
  for (const n of nodes) {
    const r = rank.get(n.id);
    (layers[r] ||= []).push(n.id);
  }

  // Single barycenter pass: reorder each layer (after the first) by the
  // average within-layer position of its own predecessors in the layer
  // above, so a node's horizontal spot tends to line up under whatever
  // feeds into it.
  const order = new Map();
  (layers[0] || []).forEach((id, i) => order.set(id, i));
  for (let r = 1; r < layers.length; r += 1) {
    const layer = layers[r];
    if (!layer) continue;
    const scored = layer.map((id, i) => {
      const known = incomingFrom.get(id).map((p) => order.get(p)).filter((v) => v !== undefined);
      const score = known.length ? known.reduce((a, b) => a + b, 0) / known.length : i + 1000;
      return { id, score };
    });
    scored.sort((a, b) => a.score - b.score);
    scored.forEach(({ id }, i) => order.set(id, i));
    layers[r] = scored.map((s) => s.id);
  }

  // Position: each layer becomes one or more rows (a layer wider than
  // MAX_ROW_WIDTH wraps into sub-rows, most relevant for many disconnected
  // root nodes landing in rank 0 together — e.g. a diagram with few/no
  // edges yet), laid out top-to-bottom; nodes within a row spread
  // left-to-right using each node's own w/h rather than a fixed grid cell.
  let y = START_Y;
  for (const layer of layers) {
    if (!layer || !layer.length) continue;
    const rowNodes = layer.map((id) => byId.get(id));
    const subRows = [];
    let subRow = [];
    let subRowWidth = 0;
    for (const n of rowNodes) {
      const advance = n.w + NODE_GAP_X;
      if (subRow.length && subRowWidth + advance > MAX_ROW_WIDTH) {
        subRows.push(subRow);
        subRow = [];
        subRowWidth = 0;
      }
      subRow.push(n);
      subRowWidth += advance;
    }
    if (subRow.length) subRows.push(subRow);

    for (const row of subRows) {
      const rowHeight = Math.max(...row.map((n) => n.h));
      let x = START_X;
      for (const n of row) {
        positions.set(n.id, { x, y: y + (rowHeight - n.h) / 2 });
        x += n.w + NODE_GAP_X;
      }
      y += rowHeight + LAYER_GAP_Y;
    }
  }

  return positions;
}
