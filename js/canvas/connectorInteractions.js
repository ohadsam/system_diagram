// Drag-from-a-node's-connection-point-to-another-node gesture that creates
// a new edge. The in-progress line is a throwaway SVG element, not project
// state, so nothing is dispatched to the store until the gesture succeeds.
import * as store from '../core/store.js';
import { createEdge } from '../core/project.js';
import { svgEl } from '../utils/dom.js';
import { screenToCanvas } from './viewport.js';
import { sideAnchor, closestSide, straightPath } from '../core/geometry.js';
import { focusEdge } from './canvas.js';

let draftLayer = null;
let magicModeActive = false;

export function initConnectorInteractions(svg) {
  draftLayer = svg;
}

/** Arms/disarms "Magic Arrow" mode — see toolbar.js's 🪄 toggle. While
 * active, the next connector drawn gets `routing: 'magic'` instead of the
 * usual default. */
export function setMagicMode(active) {
  magicModeActive = active;
}

export function isMagicModeActive() {
  return magicModeActive;
}

export function beginConnectFromNode(nodeId, side, e) {
  const fromNode = store.getState().nodes.find((n) => n.id === nodeId);
  if (!fromNode || !draftLayer) return;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const a = sideAnchor(fromNode, side);

  const draft = svgEl('path', { class: 'edge-draft', fill: 'none' });
  draftLayer.appendChild(draft);

  let targetNodeId = null;
  let hoveredEl = null;

  const onMove = (ev) => {
    const p = screenToCanvas(ev.clientX, ev.clientY);
    draft.setAttribute('d', straightPath(a, p));

    const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
    const nodeElUnder = elUnder?.closest?.('.node');
    const candidateId = nodeElUnder && nodeElUnder.dataset.nodeId !== nodeId ? nodeElUnder.dataset.nodeId : null;

    if (hoveredEl && hoveredEl !== nodeElUnder) hoveredEl.classList.remove('connect-target');
    if (candidateId) {
      nodeElUnder.classList.add('connect-target');
      hoveredEl = nodeElUnder;
    } else {
      hoveredEl = null;
    }
    targetNodeId = candidateId;
  };

  const onUp = (ev) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    draft.remove();
    hoveredEl?.classList.remove('connect-target');

    if (targetNodeId) {
      const toNode = store.getState().nodes.find((n) => n.id === targetNodeId);
      const dropPoint = screenToCanvas(ev.clientX, ev.clientY);
      const toSide = toNode ? closestSide(toNode, dropPoint) : 'left';
      const edge = createEdge(nodeId, targetNodeId, { fromSide: side, toSide, ...(magicModeActive ? { routing: 'magic' } : {}) });
      store.dispatch((d) => {
        d.edges.push(edge);
      });
      store.select([], [edge.id]);
      focusEdge(edge.id);
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
