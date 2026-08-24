// "🔍" zoom-in / drill-down view for a sequence-diagram group (see
// canvas.js#getSequenceDiagramGroups) — read-only by default (a static
// snapshot, not the live interactive canvas), with an explicit "Edit"
// button for the one flow that actually needs to change something (see
// canvas/subDiagramEdit.js), and a "Pin" toggle that docks the same
// read-only snapshot in a small panel on the right instead of a modal.
//
// The snapshot reuses node.js/connector.js's own DOM builders directly
// rather than a second hand-rolled renderer — they're plain functions that
// take a node/edge object and build/update its element, no store coupling
// in the render path itself. The whole preview sits under
// `pointer-events: none` (css/canvas.css) so this stays genuinely
// read-only: those builders *do* wire up their own click/dblclick/select
// handlers internally (shared with the real canvas — see node.js/
// connector.js's module-level `handlers`), and disabling pointer events is
// what keeps them from ever firing here instead of carving out a parallel,
// inert copy of every one of those handlers.
import { openModal } from './modal.js';
import { el, clear, svgEl } from '../utils/dom.js';
import * as store from '../core/store.js';
import { createNodeEl, updateNodeEl } from '../canvas/node.js';
import { createEdgeEl, updateEdgeEl } from '../canvas/connector.js';
import { computeMessageSequenceNumbers } from '../canvas/canvas.js';
import { enterSubDiagramEdit } from '../canvas/subDiagramEdit.js';
import { buildSequenceMermaid } from '../io/exportSequenceMermaid.js';
import { showToast } from '../utils/toast.js';

const PAD = 48;
const MAX_PREVIEW_W = 860;
const MAX_PREVIEW_H = 520;

const pinnedGroupIds = new Set();
const pinnedPanels = new Map(); // groupId -> { panel, unsubscribe }
let pinHost = null;

window.addEventListener('sdb:open-subdiagram', (e) => openSubDiagramModal(e.detail.groupId));

export function openSubDiagramModal(groupId) {
  if (pinnedGroupIds.has(groupId)) {
    pinnedPanels.get(groupId)?.panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  let unsub = null;
  openModal({
    title: '🔍 Sequence Diagram',
    className: 'subdiagram-modal',
    onClose: () => unsub?.(),
    render: (body, api) => {
      const rerender = () => renderModalBody(body, api, groupId);
      unsub = store.subscribe('change', rerender);
      rerender();
    },
  });
}

function renderModalBody(body, api, groupId) {
  clear(body);
  body.appendChild(el('p', {
    class: 'modal-hint',
    text: 'A read-only zoomed-in view. Use "Edit" to change it — your edits save back to the main diagram when you\'re done.',
  }));

  const preview = el('div', { class: 'subdiagram-preview' });
  renderGroupSnapshot(preview, groupId);
  body.appendChild(preview);

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', {
    type: 'button', class: 'btn', text: '📋 Copy as Mermaid',
    title: 'Copy this sequence diagram as Mermaid sequenceDiagram text',
    onClick: async () => {
      const state = store.getState();
      const nodes = state.nodes.filter((n) => n.groupId === groupId);
      if (!nodes.length) return;
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges = state.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
      const text = buildSequenceMermaid({ nodes, edges, allNodes: state.nodes });
      await navigator.clipboard.writeText(text);
      showToast('Mermaid text copied to clipboard.', 'success', 2000);
    },
  }));
  actions.appendChild(el('button', {
    type: 'button', class: 'btn', text: '📌 Pin to side panel',
    onClick: () => { pinGroup(groupId); api.close(); },
  }));
  actions.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: '✏️ Edit',
    onClick: () => { api.close(); enterSubDiagramEdit(groupId); },
  }));
  actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Close', onClick: () => api.close() }));
  body.appendChild(actions);
}

/** Renders a static, non-interactive snapshot of one group's nodes+edges
 * into `container`, scaled to fit within a fixed preview area. Shared by
 * both the modal and a pinned panel — exported so io/exportImage.js could
 * reuse it too, but export actually reuses the *real* canvas capture
 * technique instead (see canvas.js#hideExcept) for pixel-perfect fidelity
 * with the main PNG/PDF export; this renderer is for the interactive
 * preview only. */
export function renderGroupSnapshot(container, groupId) {
  clear(container);
  const state = store.getState();
  const nodes = state.nodes.filter((n) => n.groupId === groupId);
  if (!nodes.length) {
    container.appendChild(el('p', { class: 'modal-hint', text: 'This sequence diagram no longer exists — its lifelines were deleted or ungrouped.' }));
    return;
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = state.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const contentW = maxX - minX + PAD * 2;
  const contentH = maxY - minY + PAD * 2;
  const scale = Math.min(1, MAX_PREVIEW_W / contentW, MAX_PREVIEW_H / contentH);

  const shiftedNodes = nodes.map((n) => ({ ...n, x: n.x - minX + PAD, y: n.y - minY + PAD }));
  const shiftedById = new Map(shiftedNodes.map((n) => [n.id, n]));

  const viewport = el('div', { class: 'subdiagram-snapshot-viewport' });
  viewport.style.width = `${Math.min(contentW * scale, MAX_PREVIEW_W)}px`;
  viewport.style.height = `${Math.min(contentH * scale, MAX_PREVIEW_H)}px`;

  const scaled = el('div', { class: 'subdiagram-snapshot-scaled' });
  scaled.style.width = `${contentW}px`;
  scaled.style.height = `${contentH}px`;
  scaled.style.transform = `scale(${scale})`;

  const nodeLayer = el('div', { class: 'node-layer' });
  const edgeLayer = svgEl('svg', { class: 'edge-layer', width: contentW, height: contentH });
  scaled.appendChild(edgeLayer);
  scaled.appendChild(nodeLayer);

  for (const n of shiftedNodes) {
    const nodeEl = createNodeEl(n);
    updateNodeEl(nodeEl, n, { selected: false });
    nodeLayer.appendChild(nodeEl);
  }

  const seqNumbers = computeMessageSequenceNumbers(edges, shiftedById);
  for (const edge of edges) {
    const fromNode = shiftedById.get(edge.from);
    const toNode = shiftedById.get(edge.to);
    if (!fromNode || !toNode) continue;
    const edgeEl = createEdgeEl(edge);
    updateEdgeEl(edgeEl, edge, fromNode, toNode, { allNodes: shiftedNodes, sequenceNumber: seqNumbers.get(edge.id) ?? null });
    edgeLayer.appendChild(edgeEl);
  }

  viewport.appendChild(scaled);
  container.appendChild(viewport);
}

function getPinHost() {
  if (!pinHost) {
    pinHost = el('div', { class: 'subdiagram-pin-host' });
    document.body.appendChild(pinHost);
  }
  return pinHost;
}

function pinGroup(groupId) {
  if (pinnedGroupIds.has(groupId)) return;
  pinnedGroupIds.add(groupId);

  const panel = el('div', { class: 'subdiagram-pin-panel' });
  const header = el('div', { class: 'subdiagram-pin-header' });
  header.appendChild(el('span', { class: 'subdiagram-pin-title', text: '🔍 Sequence Diagram' }));
  header.appendChild(el('button', {
    type: 'button', class: 'btn btn-icon', text: '✏️', title: 'Edit this sequence diagram', 'aria-label': 'Edit this sequence diagram',
    onClick: () => { unpinGroup(groupId); enterSubDiagramEdit(groupId); },
  }));
  header.appendChild(el('button', {
    type: 'button', class: 'btn btn-icon', text: '✕', title: 'Unpin', 'aria-label': 'Unpin this sequence diagram',
    onClick: () => unpinGroup(groupId),
  }));
  panel.appendChild(header);

  const body = el('div', { class: 'subdiagram-pin-body' });
  panel.appendChild(body);
  getPinHost().appendChild(panel);

  const rerender = () => renderGroupSnapshot(body, groupId);
  const unsub = store.subscribe('change', rerender);
  rerender();
  pinnedPanels.set(groupId, { panel, unsub });
}

function unpinGroup(groupId) {
  const entry = pinnedPanels.get(groupId);
  if (!entry) return;
  entry.unsub();
  entry.panel.remove();
  pinnedPanels.delete(groupId);
  pinnedGroupIds.delete(groupId);
}
