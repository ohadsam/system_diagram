// A deterministic, offline, plain-language description of a diagram's
// structure — the accessible/non-AI counterpart to "Explain this diagram
// with AI" (io/aiReview.js#buildExplainPrompt). Useful for a screen-reader
// user (the canvas itself is a large tree of positioned divs/SVG, not
// something a screen reader can meaningfully summarize on its own), or for
// anyone who just wants a quick text readout instead of AI or reading the
// canvas visually. Pure/DOM-free — `resolveDef(defId)` is injected rather
// than imported directly, same pattern as core/diagramLint.js, so this
// stays independently unit-testable.
function nodeLabel(node) {
  return node.text?.trim() || node.shape || 'Unnamed component';
}

function categoryLabelFor(node, resolveDef) {
  const def = node.defId ? resolveDef(node.defId) : null;
  return def?.categoryId || null;
}

/**
 * @param {object[]} nodes @param {object[]} edges
 * @param {(defId: string) => {categoryId?: string}|null} resolveDef
 * @returns {{summary: string, categoryLines: string[], connectionLines: string[], isolatedLines: string[]}}
 */
export function buildDiagramDescription(nodes, edges, resolveDef) {
  if (!nodes.length) {
    return { summary: 'This diagram is empty — no components have been added yet.', categoryLines: [], connectionLines: [], isolatedLines: [] };
  }

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const isLifeline = nodes.some((n) => n.shape === 'lifeline');

  const summary = isLifeline
    ? `This is a sequence diagram with ${nodes.length} lifeline${nodes.length === 1 ? '' : 's'} and ${edges.length} message${edges.length === 1 ? '' : 's'}.`
    : `This diagram has ${nodes.length} component${nodes.length === 1 ? '' : 's'} and ${edges.length} connection${edges.length === 1 ? '' : 's'}.`;

  const countsByCategory = new Map();
  for (const node of nodes) {
    const cat = categoryLabelFor(node, resolveDef) || 'Other';
    countsByCategory.set(cat, (countsByCategory.get(cat) || 0) + 1);
  }
  const categoryLines = Array.from(countsByCategory.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cat, count]) => `${cat}: ${count}`);

  const connectionLines = edges.map((e) => {
    const from = nodesById.get(e.from);
    const to = nodesById.get(e.to);
    const names = `${from ? nodeLabel(from) : 'unknown'} → ${to ? nodeLabel(to) : 'unknown'}`;
    return e.label ? `${names} ("${e.label}")` : names;
  });

  const connectedIds = new Set();
  for (const e of edges) { connectedIds.add(e.from); connectedIds.add(e.to); }
  const isolatedLines = nodes.filter((n) => !connectedIds.has(n.id)).map((n) => nodeLabel(n));

  return { summary, categoryLines, connectionLines, isolatedLines };
}
