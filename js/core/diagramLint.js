// A small, deterministic (non-AI) set of structural checks over the
// current diagram's graph — complementary to the AI Design Review
// (io/aiReview.js), which needs an external LLM and a human to read its
// reply. These are cheap, always-available, low-false-positive checks:
// textbook anti-patterns most engineers would immediately recognize,
// not a general-purpose architecture linter (that's a much bigger,
// far more opinionated project than this one attempts).
// Pure/DOM-free — `resolveDef(defId)` is injected rather than imported
// directly, so this stays unit-testable without data/index.js or
// io/customComponents.js (which touch localStorage) in the loop.

const GATEWAY_NAME_RE = /load balancer|api gateway|reverse proxy/i;

function edgesTouching(edges, nodeId) {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @param {object[]} replicationPairs project.replicationPairs (may be empty/undefined)
 * @param {(defId: string) => {categoryId?: string, name?: string}|null} resolveDef
 * @returns {{id: string, severity: 'warning', message: string, nodeIds: string[]}[]}
 */
export function computeDiagramLint(nodes, edges, replicationPairs, resolveDef) {
  const findings = [];
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const defFor = (node) => (node ? resolveDef(node.defId) : null);

  // 1. A "Client & Frontend" component connected directly to a "Databases"
  // component, with no service/API layer in between — bypasses business
  // logic/auth/validation, and couples the client to the schema directly.
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    const fromCat = defFor(fromNode)?.categoryId;
    const toCat = defFor(toNode)?.categoryId;
    const isClientDbPair = (fromCat === 'client' && toCat === 'databases') || (fromCat === 'databases' && toCat === 'client');
    if (isClientDbPair) {
      findings.push({
        id: `client-to-db-${edge.id}`,
        severity: 'warning',
        message: `"${fromNode.text}" connects directly to "${toNode.text}" — a client talking straight to a database usually means no service layer to enforce business logic, validation, or access control.`,
        nodeIds: [fromNode.id, toNode.id],
      });
    }
  }

  // 2. A component with zero connections while the rest of the diagram is
  // wired up — easy to miss (a box dragged in and forgotten).
  if (edges.length > 0) {
    for (const node of nodes) {
      // Sequence-diagram elements have their own conventions, and the
      // "Group / Container" shape is purely a visual boundary box you drop
      // *behind* other components (see data/categories/shapes.js#shape-group)
      // — it's never meant to have an edge of its own, so it's not an
      // "orphan" in the sense this check means to catch.
      if (node.shape === 'lifeline' || node.fragmentType || node.defId === 'shape-group') continue;
      if (edgesTouching(edges, node.id).length === 0) {
        findings.push({
          id: `orphan-${node.id}`,
          severity: 'warning',
          message: `"${node.text}" isn't connected to anything else in the diagram.`,
          nodeIds: [node.id],
        });
      }
    }
  }

  // 3. A replication pair (explicitly modeled redundant instances — see
  // core/replication.js) with no load balancer/gateway routing traffic to
  // either side — only fires when the user already used the replication
  // feature, so this is a confident signal, not a guess about intent.
  for (const pair of replicationPairs || []) {
    const memberIds = new Set((pair.members || []).flatMap((m) => [m.a, m.b]).filter(Boolean));
    if (!memberIds.size) continue;
    const hasGateway = [...memberIds].some((id) =>
      edges.some((e) => e.to === id && GATEWAY_NAME_RE.test(defFor(nodesById.get(e.from))?.name || ''))
    );
    if (!hasGateway) {
      const names = [...memberIds].map((id) => nodesById.get(id)?.text).filter(Boolean);
      findings.push({
        id: `unrouted-replicas-${pair.id}`,
        severity: 'warning',
        message: `The replicated instances (${names.join(', ')}) have no load balancer or API gateway routing traffic to them.`,
        nodeIds: [...memberIds],
      });
    }
  }

  return findings;
}
