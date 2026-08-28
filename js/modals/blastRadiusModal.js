// "🎯 Blast Radius" — right-click a component to see what else would be
// affected if it failed, using core/blastRadius.js's pure edge traversal.
// No AI involved (complementary to "🤖 AI Design Review" and the
// deterministic Check Diagram lint) — just this diagram's own edges,
// read as "`from` depends on `to`" the same way core/diagramLint.js's
// client-straight-to-database check already assumes.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { computeBlastRadius } from '../core/blastRadius.js';
import { centerOn } from '../canvas/viewport.js';

function selectAndCenter(nodeIds) {
  const state = store.getState();
  const nodes = state.nodes.filter((n) => nodeIds.includes(n.id));
  if (!nodes.length) return;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  centerOn((minX + maxX) / 2, (minY + maxY) / 2);
  store.select(nodeIds, []);
}

function buildNodeList(title, hint, nodeIds, nodesById, api) {
  const section = el('div', { class: 'blast-radius-section' });
  section.appendChild(el('h3', { text: `${title} (${nodeIds.length})` }));
  section.appendChild(el('p', { class: 'blast-radius-section-hint', text: hint }));
  if (!nodeIds.length) {
    section.appendChild(el('p', { class: 'blast-radius-empty', text: 'None.' }));
    return section;
  }
  const list = el('div', { class: 'blast-radius-list' });
  for (const nodeId of nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    list.appendChild(el('button', {
      type: 'button',
      class: 'blast-radius-item',
      text: `${node.icon || '▪️'} ${node.text || 'Component'}`,
      onClick: () => { selectAndCenter([nodeId]); api.close(); },
    }));
  }
  section.appendChild(list);
  return section;
}

export function openBlastRadiusModal(startNodeId) {
  const state = store.getState();
  const startNode = state.nodes.find((n) => n.id === startNodeId);
  if (!startNode) return;
  const result = computeBlastRadius(state.nodes, state.edges, startNodeId);
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const allAffectedIds = [...new Set([...result.downstreamNodeIds, ...result.upstreamNodeIds])];

  openModal({
    title: `🎯 Blast Radius: ${startNode.text || 'Component'}`,
    className: 'blast-radius-modal',
    render: (body, api) => {
      clear(body);
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: `If "${startNode.text || 'this component'}" fails, here's everything reachable from it by following connectors — not a guess, just this diagram's own graph.`,
      }));

      if (!allAffectedIds.length) {
        body.appendChild(el('p', { class: 'blast-radius-empty', text: "This component isn't connected to anything else — nothing else would be affected." }));
        return;
      }

      body.appendChild(buildNodeList(
        '⬇️ Depends on this',
        "These stop getting what they need — this component connects out to them and can't anymore.",
        result.downstreamNodeIds, nodesById, api,
      ));
      body.appendChild(buildNodeList(
        '⬆️ Calls into this',
        'Their connections into this component start failing.',
        result.upstreamNodeIds, nodesById, api,
      ));

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', {
        type: 'button', class: 'btn', text: '🎯 Highlight all on canvas',
        onClick: () => { selectAndCenter([startNodeId, ...allAffectedIds]); api.close(); },
      }));
      body.appendChild(actions);
    },
  });
}
