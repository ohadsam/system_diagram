// "If this component fails, what else is affected?" — a pure graph
// traversal over the diagram's own edges, no AI involved (complementary to
// core/diagramHealth.js's static lint score and canvas.js's Flow
// Simulation, which animates normal-case data flow rather than failure
// impact). An edge `from -> to` is read as "`from` depends on `to`", the
// same directional convention core/diagramLint.js's client-straight-to-
// -database check already assumes — so failing `to` affects both:
//   - "downstream": nodes reachable by walking edges FORWARD from the
//     target (things it calls/feeds) — they stop receiving whatever the
//     target normally sends them.
//   - "upstream": nodes reachable by walking edges BACKWARD into the
//     target (things that call/depend on it) — their calls to the target
//     start failing.
// Both directions are genuinely "affected", so the UI (modals/
// blastRadiusModal.js) shows both rather than picking one.

function buildAdjacency(edges, direction) {
  const adjacency = new Map();
  for (const edge of edges) {
    const from = direction === 'forward' ? edge.from : edge.to;
    const to = direction === 'forward' ? edge.to : edge.from;
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ edgeId: edge.id, nodeId: to });
  }
  return adjacency;
}

function traverse(adjacency, startNodeId) {
  const visitedNodeIds = new Set([startNodeId]);
  const edgeIds = new Set();
  const queue = [startNodeId];
  while (queue.length) {
    const current = queue.shift();
    for (const { edgeId, nodeId } of adjacency.get(current) || []) {
      edgeIds.add(edgeId);
      if (!visitedNodeIds.has(nodeId)) {
        visitedNodeIds.add(nodeId);
        queue.push(nodeId);
      }
    }
  }
  visitedNodeIds.delete(startNodeId);
  return { nodeIds: [...visitedNodeIds], edgeIds };
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @param {string} startNodeId the component being analyzed as "if this fails"
 * @returns {{startNodeId: string, downstreamNodeIds: string[], upstreamNodeIds: string[], edgeIds: string[]}}
 */
export function computeBlastRadius(nodes, edges, startNodeId) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (!nodeIds.has(startNodeId)) {
    return { startNodeId, downstreamNodeIds: [], upstreamNodeIds: [], edgeIds: [] };
  }
  const downstream = traverse(buildAdjacency(edges, 'forward'), startNodeId);
  const upstream = traverse(buildAdjacency(edges, 'backward'), startNodeId);
  const edgeIds = new Set([...downstream.edgeIds, ...upstream.edgeIds]);
  return {
    startNodeId,
    downstreamNodeIds: downstream.nodeIds,
    upstreamNodeIds: upstream.nodeIds,
    edgeIds: [...edgeIds],
  };
}
