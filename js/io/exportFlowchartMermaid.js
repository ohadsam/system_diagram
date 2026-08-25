// Converts the *whole* canvas (every node/edge, not scoped to a sequence-
// diagram group) into Mermaid `flowchart` text — a different export target
// than io/exportSequenceMermaid.js, which only ever covers one sequence-
// diagram group's lifelines/messages. Pure/DOM-free; the caller
// (modals/exportDiagramModal.js) writes the result to the clipboard.
// Best-effort, not a lossless round-trip: Mermaid's classic node shapes are
// a small fixed set, so several of this app's shapes (note, rows, lifeline,
// cloud) fall back to the closest visual approximation rather than having
// their own syntax.
function esc(text) {
  return String(text ?? '').replace(/\r?\n/g, ' ').replace(/"/g, "'").trim();
}

/** Wraps a label in the bracket pair Mermaid's classic flowchart syntax
 * uses for each node shape — see https://mermaid.js.org/syntax/flowchart.html
 * "Node shapes". Shapes with no direct Mermaid equivalent (note, rows,
 * lifeline) fall back to the plain rectangle. */
function shapeBrackets(node) {
  const label = esc(node.rows?.length ? [node.text, ...node.rows].filter(Boolean).join('<br/>') : node.text) || 'Component';
  switch (node.shape) {
    case 'rounded': return `("${label}")`;
    case 'circle': return `(("${label}"))`;
    case 'diamond': return `{"${label}"}`;
    case 'cylinder': return `[("${label}")]`;
    case 'hexagon': return `{{"${label}"}}`;
    case 'cloud': return `(["${label}"])`; // stadium — closest built-in shape to a cloud
    default: return `["${label}"]`; // rect, note, rows, lifeline
  }
}

/** Solid+arrow -> `-->`, solid+no-arrow -> `---`, dashed/dotted (either
 * dash style collapses to Mermaid's one non-solid line type) with/without
 * an arrowhead -> `-.->`/`-.-`. */
function arrowFor(edge) {
  const dotted = edge.dash === 'dashed' || edge.dash === 'dotted';
  const hasArrow = edge.endArrow !== 'none';
  if (dotted) return hasArrow ? '-.->' : '-.-';
  return hasArrow ? '-->' : '---';
}

/**
 * @param {{nodes: object[], edges: object[]}} diagram the whole canvas —
 *   typically `{nodes: state.nodes, edges: state.edges}`.
 * @returns {string} Mermaid `flowchart` source.
 */
export function buildFlowchartMermaid({ nodes, edges }) {
  const lines = ['flowchart LR'];
  const idFor = new Map();
  nodes.forEach((n, i) => idFor.set(n.id, `N${i + 1}`));

  nodes.forEach((n) => {
    const id = idFor.get(n.id);
    lines.push(`    ${id}${shapeBrackets(n)}`);
  });

  for (const edge of edges) {
    const fromId = idFor.get(edge.from);
    const toId = idFor.get(edge.to);
    if (!fromId || !toId) continue;
    const arrow = arrowFor(edge);
    const label = esc(edge.label);
    lines.push(label ? `    ${fromId} ${arrow}|${label}| ${toId}` : `    ${fromId} ${arrow} ${toId}`);
  }

  return lines.join('\n');
}
