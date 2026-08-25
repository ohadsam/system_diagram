// Pure structural diff between two `{nodes, edges}` content snapshots — used
// to compare two saved diagram versions, or a saved version against the
// live canvas (see modals/diagramCompareModal.js). Compares by id: a
// version is always a snapshot of THIS SAME project's own nodes/edges, so
// ids stay stable across snapshots taken at different points in time,
// which is what makes an id-based diff meaningful — comparing two entirely
// unrelated projects (unrelated id spaces) would not produce a useful diff
// this way, and isn't what this is for. Pure/DOM-free.

const NODE_COMPARE_FIELDS = [
  'x', 'y', 'w', 'h', 'shape', 'fill', 'stroke', 'strokeWidth', 'text', 'fontSize',
  'textAlign', 'textPosition', 'icon', 'iconVisible', 'notes', 'labels', 'rows', 'monthlyCost',
];
const EDGE_COMPARE_FIELDS = [
  'from', 'to', 'fromSide', 'toSide', 'routing', 'color', 'width', 'dash',
  'startArrow', 'endArrow', 'label', 'labelPosition', 'notes',
];

function fieldsDiffer(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function diffEntities(oldList, newList, fields) {
  const oldById = new Map(oldList.map((e) => [e.id, e]));
  const newById = new Map(newList.map((e) => [e.id, e]));
  const added = newList.filter((n) => !oldById.has(n.id));
  const removed = oldList.filter((o) => !newById.has(o.id));
  const changed = [];
  for (const n of newList) {
    const o = oldById.get(n.id);
    if (!o) continue;
    const changedFields = fields.filter((f) => fieldsDiffer(o[f], n[f]));
    if (changedFields.length) changed.push({ id: n.id, before: o, after: n, changedFields });
  }
  return { added, removed, changed };
}

/**
 * @param {{nodes: object[], edges: object[]}} oldContent
 * @param {{nodes: object[], edges: object[]}} newContent
 * @returns {{addedNodes, removedNodes, changedNodes, addedEdges, removedEdges, changedEdges}}
 *   `changedNodes`/`changedEdges` entries are `{id, before, after, changedFields}`.
 */
export function computeDiagramDiff(oldContent, newContent) {
  const nodeDiff = diffEntities(oldContent.nodes || [], newContent.nodes || [], NODE_COMPARE_FIELDS);
  const edgeDiff = diffEntities(oldContent.edges || [], newContent.edges || [], EDGE_COMPARE_FIELDS);
  return {
    addedNodes: nodeDiff.added,
    removedNodes: nodeDiff.removed,
    changedNodes: nodeDiff.changed,
    addedEdges: edgeDiff.added,
    removedEdges: edgeDiff.removed,
    changedEdges: edgeDiff.changed,
  };
}

export function isDiagramDiffEmpty(diff) {
  return !(
    diff.addedNodes.length || diff.removedNodes.length || diff.changedNodes.length
    || diff.addedEdges.length || diff.removedEdges.length || diff.changedEdges.length
  );
}
