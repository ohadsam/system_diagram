// Shows a structural diff (core/diagramDiff.js) between two diagram
// content snapshots — reused by modals/versionHistoryModal.js for both
// "compare a saved version with the current canvas" and "compare two
// saved versions." Each diff item whose node id is in `liveNodeIds` (i.e.
// actually exists on the canvas right now) is clickable to jump to it —
// a removed node, or a node from a version-vs-version comparison where
// neither side is "now," has nothing on the live canvas to jump to, so
// those render as plain (non-interactive) rows instead.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { computeDiagramDiff, isDiagramDiffEmpty } from '../core/diagramDiff.js';
import { centerOn } from '../canvas/viewport.js';
import { openAiDiffExplainModal } from './aiDiffExplainModal.js';

function jumpToNode(nodeId) {
  const state = store.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  centerOn(node.x + node.w / 2, node.y + node.h / 2);
  store.select([nodeId], []);
}

function nodeLabel(node) {
  return node.text?.trim() || node.shape || 'Component';
}

function edgeLabel(edge, allNodesById) {
  const from = allNodesById.get(edge.from);
  const to = allNodesById.get(edge.to);
  const names = `${from ? nodeLabel(from) : '?'} → ${to ? nodeLabel(to) : '?'}`;
  return edge.label ? `"${edge.label}" (${names})` : names;
}

function buildSection(title, className) {
  const section = el('div', { class: 'diagram-compare-section' });
  section.appendChild(el('h3', { class: `diagram-compare-heading ${className}`, text: title }));
  return section;
}

function buildRow(text, nodeId, liveNodeIds, api) {
  const clickable = nodeId && liveNodeIds.has(nodeId);
  const row = el(clickable ? 'button' : 'div', {
    type: clickable ? 'button' : undefined,
    class: `diagram-compare-item${clickable ? ' is-clickable' : ''}`,
    text,
    onClick: clickable ? () => { jumpToNode(nodeId); api.close(); } : undefined,
  });
  return row;
}

/**
 * @param {object} opts
 * @param {string} opts.leftLabel @param {{nodes,edges}} opts.leftContent
 * @param {string} opts.rightLabel @param {{nodes,edges}} opts.rightContent
 */
export function openDiagramCompareModal({ leftLabel, leftContent, rightLabel, rightContent }) {
  const diff = computeDiagramDiff(leftContent, rightContent);
  const liveNodeIds = new Set(store.getState().nodes.map((n) => n.id));
  const allNodesById = new Map([...leftContent.nodes, ...rightContent.nodes].map((n) => [n.id, n]));

  openModal({
    title: 'Compare Versions',
    className: 'diagram-compare-modal',
    render: (body, api) => {
      body.appendChild(el('p', { class: 'modal-hint', text: `"${leftLabel}" → "${rightLabel}"` }));

      if (isDiagramDiffEmpty(diff)) {
        body.appendChild(el('p', { class: 'diagram-compare-empty', text: '✅ No differences between these two versions.' }));
        return;
      }

      body.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary diagram-compare-explain-btn', text: '💬 Explain this diff with AI',
        onClick: () => openAiDiffExplainModal({ diff, leftLabel, rightLabel, allNodesById }),
      }));

      if (diff.addedNodes.length) {
        const section = buildSection(`+ ${diff.addedNodes.length} component(s) added`, 'is-added');
        for (const n of diff.addedNodes) section.appendChild(buildRow(`${n.icon || '▪️'} ${nodeLabel(n)}`, n.id, liveNodeIds, api));
        body.appendChild(section);
      }
      if (diff.removedNodes.length) {
        const section = buildSection(`− ${diff.removedNodes.length} component(s) removed`, 'is-removed');
        for (const n of diff.removedNodes) section.appendChild(buildRow(`${n.icon || '▪️'} ${nodeLabel(n)}`, n.id, liveNodeIds, api));
        body.appendChild(section);
      }
      if (diff.changedNodes.length) {
        const section = buildSection(`✎ ${diff.changedNodes.length} component(s) changed`, 'is-changed');
        for (const c of diff.changedNodes) {
          section.appendChild(buildRow(`${c.after.icon || '▪️'} ${nodeLabel(c.after)} — ${c.changedFields.join(', ')}`, c.id, liveNodeIds, api));
        }
        body.appendChild(section);
      }
      if (diff.addedEdges.length) {
        const section = buildSection(`+ ${diff.addedEdges.length} connector(s) added`, 'is-added');
        for (const e of diff.addedEdges) section.appendChild(buildRow(edgeLabel(e, allNodesById), null, liveNodeIds, api));
        body.appendChild(section);
      }
      if (diff.removedEdges.length) {
        const section = buildSection(`− ${diff.removedEdges.length} connector(s) removed`, 'is-removed');
        for (const e of diff.removedEdges) section.appendChild(buildRow(edgeLabel(e, allNodesById), null, liveNodeIds, api));
        body.appendChild(section);
      }
      if (diff.changedEdges.length) {
        const section = buildSection(`✎ ${diff.changedEdges.length} connector(s) changed`, 'is-changed');
        for (const c of diff.changedEdges) {
          section.appendChild(buildRow(`${edgeLabel(c.after, allNodesById)} — ${c.changedFields.join(', ')}`, null, liveNodeIds, api));
        }
        body.appendChild(section);
      }
    },
  });
}
