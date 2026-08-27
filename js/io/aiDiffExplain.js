// "Explain this diff with AI" — narrates a structural diff
// (core/diagramDiff.js) between two diagram snapshots in plain language,
// for modals/diagramCompareModal.js. Same honest "prepare & hand off, no
// API key" mechanism as every other AI feature here (see docs/SPEC.md
// 4.12/4.13) — this one just doesn't need an apply/patch step afterward,
// since the whole point is reading the answer, not feeding it back into
// the project.
const DIFF_SUMMARY_LIMIT = 8000;

function nodeLabel(node) {
  return node?.text?.trim() || node?.shape || 'Component';
}

function edgeLabel(edge, allNodesById) {
  const from = allNodesById.get(edge.from);
  const to = allNodesById.get(edge.to);
  return `${from ? nodeLabel(from) : '?'} → ${to ? nodeLabel(to) : '?'}${edge.label ? ` ("${edge.label}")` : ''}`;
}

/** Turns a computeDiagramDiff() result into a compact, plain-language bullet
 * list — the same projection modals/diagramCompareModal.js already renders
 * on screen, just as text instead of DOM rows. */
export function summarizeDiffForPrompt(diff, allNodesById) {
  const lines = [];
  for (const n of diff.addedNodes) lines.push(`+ added component: ${nodeLabel(n)}`);
  for (const n of diff.removedNodes) lines.push(`- removed component: ${nodeLabel(n)}`);
  for (const c of diff.changedNodes) lines.push(`~ changed component "${nodeLabel(c.after)}": ${c.changedFields.join(', ')}`);
  for (const e of diff.addedEdges) lines.push(`+ added connector: ${edgeLabel(e, allNodesById)}`);
  for (const e of diff.removedEdges) lines.push(`- removed connector: ${edgeLabel(e, allNodesById)}`);
  for (const c of diff.changedEdges) lines.push(`~ changed connector "${edgeLabel(c.after, allNodesById)}": ${c.changedFields.join(', ')}`);
  return lines.join('\n');
}

export function buildDiffExplainPrompt({ diff, leftLabel, rightLabel, allNodesById }) {
  const summary = summarizeDiffForPrompt(diff, allNodesById);
  const lines = [];
  lines.push(`Here is a structural diff of a system design diagram, from "${leftLabel}" to "${rightLabel}":`);
  lines.push('```');
  lines.push(summary.length > DIFF_SUMMARY_LIMIT ? summary.slice(0, DIFF_SUMMARY_LIMIT) + '\n/* truncated */' : summary || '(no changes)');
  lines.push('```');
  lines.push('');
  lines.push('Explain this change in a short, plain-language paragraph — what it likely accomplishes (a new capability, a fix, a refactor, scaling up, etc.), and call out anything that looks risky or worth double-checking (e.g. a removed connector that isn\'t obviously replaced by another path). Keep it to a few sentences.');
  return lines.join('\n');
}
