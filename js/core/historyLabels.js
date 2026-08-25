// Auto-generated, human-readable labels for undo/redo history entries — see
// modals/historyTimelineModal.js. Reuses core/diagramDiff.js (already
// proven for version comparison) rather than requiring every single
// store.dispatch() call site across the app to carry its own manually-
// authored label, which would be an invasive, error-prone change touching
// dozens of unrelated modules. Pure, DOM-free.
import { computeDiagramDiff, isDiagramDiffEmpty } from './diagramDiff.js';

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function describeNodeChanges(changedNodes) {
  const fields = new Set(changedNodes.flatMap((c) => c.changedFields));
  const only = (...allowed) => [...fields].every((f) => allowed.includes(f));
  if (only('x', 'y')) return `Moved ${plural(changedNodes.length, 'component')}`;
  if (only('w', 'h')) return `Resized ${plural(changedNodes.length, 'component')}`;
  if (only('fill', 'stroke', 'strokeWidth', 'shape')) return `Restyled ${plural(changedNodes.length, 'component')}`;
  return `Edited ${plural(changedNodes.length, 'component')}`;
}

/**
 * @param {{nodes: object[], edges: object[]}} prevSnapshot
 * @param {{nodes: object[], edges: object[]}} nextSnapshot
 * @returns {string} a short label like "Added 1 component" or "Moved 2 components, added 1 connector"
 */
export function describeHistoryStep(prevSnapshot, nextSnapshot) {
  const diff = computeDiagramDiff(prevSnapshot, nextSnapshot);
  if (isDiagramDiffEmpty(diff)) return 'No changes';

  const parts = [];
  if (diff.addedNodes.length) {
    parts.push(diff.addedNodes.length === 1 && diff.addedNodes[0].text
      ? `Added "${diff.addedNodes[0].text}"`
      : `Added ${plural(diff.addedNodes.length, 'component')}`);
  }
  if (diff.removedNodes.length) parts.push(`Deleted ${plural(diff.removedNodes.length, 'component')}`);
  if (diff.changedNodes.length) parts.push(describeNodeChanges(diff.changedNodes));
  if (diff.addedEdges.length) parts.push(`Added ${plural(diff.addedEdges.length, 'connector')}`);
  if (diff.removedEdges.length) parts.push(`Deleted ${plural(diff.removedEdges.length, 'connector')}`);
  if (diff.changedEdges.length) parts.push(`Edited ${plural(diff.changedEdges.length, 'connector')}`);
  return parts.join(', ');
}
