// "📖 Explain This Diagram" (right-click a node from an instantiated library
// pattern/template, or the same option in its details panel — see
// canvas.js#openNodeContextMenu and panel/detailsPanel.js) — a deterministic,
// offline, per-template counterpart to core/diagramDescription.js's whole-
// canvas summary: what this specific template is, what each of its own
// components is/does (every component in the library already carries a
// curated `description` — data/schema.js#c — that nothing surfaced to the
// user before this), and a step-by-step read of how it flows. Pure/DOM-free
// — `resolveDef(defId)` is injected rather than imported, same pattern as
// diagramDescription.js, so this stays independently unit-testable.
import { sideAnchor } from './geometry.js';

function nodeLabel(node) {
  return node.text?.trim() || node.shape || 'Unnamed component';
}

/**
 * @param {object[]} nodes every node sharing the instantiation's
 *   `patternInstanceId` (caller gathers these — see modals/groupExplanationModal.js)
 * @param {object[]} edges every edge with both ends among `nodes`
 * @param {(defId: string) => {name?: string, description?: string}|null} resolveDef
 * @param {{name?: string, icon?: string, description?: string}|null} patternDef
 *   the original library pattern's own def (resolveDef(sourcePatternId)) —
 *   null for a group whose source pattern def can no longer be resolved
 *   (e.g. a custom component that was since deleted); the rest of the
 *   explanation still renders, just without this curated header.
 * @returns {{title: string, headerDescription: string, isSequenceDiagram: boolean,
 *   components: {name: string, description: string}[], flowLines: string[]}}
 */
export function buildGroupExplanation(nodes, edges, resolveDef, patternDef) {
  const isSequenceDiagram = nodes.length > 0 && nodes.every((n) => n.shape === 'lifeline');
  const title = patternDef?.name || (isSequenceDiagram ? 'Sequence diagram' : 'Component group');
  const headerDescription = patternDef?.description || '';

  const components = nodes.map((n) => {
    const def = n.defId ? resolveDef(n.defId) : null;
    return { name: nodeLabel(n), description: def?.description || '' };
  });

  let flowLines;
  if (isSequenceDiagram) {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const messages = edges
      .filter((e) => nodesById.has(e.from) && nodesById.has(e.to))
      .map((e) => ({
        edge: e,
        y: sideAnchor(nodesById.get(e.from), e.fromSide, e.fromOffset ?? 0.5).y,
      }))
      .sort((a, b) => a.y - b.y);
    flowLines = messages.map(({ edge }, i) => {
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      const label = edge.label ? ` — ${edge.label}` : '';
      return `${i + 1}. ${nodeLabel(from)} → ${nodeLabel(to)}${label}`;
    });
  } else {
    flowLines = edges.map((e) => {
      const from = nodes.find((n) => n.id === e.from);
      const to = nodes.find((n) => n.id === e.to);
      const names = `${from ? nodeLabel(from) : 'unknown'} → ${to ? nodeLabel(to) : 'unknown'}`;
      return e.label ? `${names} ("${e.label}")` : names;
    });
  }

  return { title, headerDescription, isSequenceDiagram, components, flowLines };
}
