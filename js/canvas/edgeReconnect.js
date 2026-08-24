// Drag-to-reconnect gesture for an existing connector's endpoint — lets a
// message be re-timed to a different height, or moved to a different
// lifeline/node entirely, without deleting and redrawing it. Mirrors
// connectorInteractions.js's draft-line-while-dragging approach, but starts
// from an existing edge's fixed endpoint instead of a node's connection
// point, and only ever touches the endpoint actually being dragged — the
// other end's side/offset is left completely untouched.
//
// The two small handle circles live in their own overlay layer, stacked
// *above* .node-layer (see canvas/canvas.js), not as children of the edge's
// own <g> in .edge-layer — a handle sits exactly at the edge's anchor
// point, which for a node/lifeline is also exactly where that node's own
// connection-point hit-strip lives (css/node.css). Since .node-layer paints
// after .edge-layer, a handle living in the edge layer would silently lose
// every pointer hit-test to the node underneath it (confirmed by an earlier
// version of this feature: dragging the "handle" actually grabbed the
// node's connection point instead and drew a brand new edge). The overlay
// only ever holds handles for the currently-selected edge(s), so this never
// affects normal edge rendering or click-through elsewhere.
import * as store from '../core/store.js';
import { screenToCanvas } from './viewport.js';
import { sideAnchor, straightPath, computeAnchorOffset, closestSide } from '../core/geometry.js';
import { svgEl } from '../utils/dom.js';

let handleLayer = null;
const handleElements = new Map(); // `${edgeId}:${end}` -> circle el

export function initEdgeReconnect(layer) {
  handleLayer = layer;
}

/** Rebuilds the handle overlay for whichever edges are currently selected —
 * call after any store change and after any selection change. Cheap (a
 * couple of DOM nodes per selected edge) and idempotent. */
export function syncEdgeHandles(state, selection) {
  if (!handleLayer) return;
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const edgesById = new Map(state.edges.map((e) => [e.id, e]));
  const wanted = new Set();

  for (const edgeId of selection.edgeIds) {
    const edge = edgesById.get(edgeId);
    if (!edge) continue;
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (!fromNode || !toNode) continue;
    const a = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5);
    const b = sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5);
    placeHandle(edgeId, 'from', a, wanted);
    placeHandle(edgeId, 'to', b, wanted);
  }

  for (const [key, el] of handleElements) {
    if (!wanted.has(key)) {
      el.remove();
      handleElements.delete(key);
    }
  }
}

function placeHandle(edgeId, end, point, wanted) {
  const key = `${edgeId}:${end}`;
  wanted.add(key);
  let el = handleElements.get(key);
  if (!el) {
    el = svgEl('circle', {
      class: `edge-endpoint-handle edge-endpoint-${end}`,
      r: 6,
      'data-edge-id': edgeId,
      'aria-label': `Drag to reconnect the ${end === 'from' ? 'start' : 'end'} of this connector`,
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      beginReconnect(edgeId, end, e);
    });
    handleElements.set(key, el);
    handleLayer.appendChild(el);
  }
  el.setAttribute('cx', String(point.x));
  el.setAttribute('cy', String(point.y));
}

function beginReconnect(edgeId, end, e) {
  const state = store.getState();
  const edge = state.edges.find((x) => x.id === edgeId);
  if (!edge) return;
  e.currentTarget.setPointerCapture?.(e.pointerId);

  const fixedNodeId = end === 'from' ? edge.to : edge.from;
  const fixedNode = state.nodes.find((n) => n.id === fixedNodeId);
  if (!fixedNode) return;
  const fixedSide = end === 'from' ? edge.toSide : edge.fromSide;
  const fixedOffset = end === 'from' ? (edge.toOffset ?? 0.5) : (edge.fromOffset ?? 0.5);
  const fixedPoint = sideAnchor(fixedNode, fixedSide, fixedOffset);

  const draft = svgEl('path', { class: 'edge-draft', fill: 'none' });
  handleLayer.appendChild(draft);

  let targetNodeId = null;
  let hoveredEl = null;

  const onMove = (ev) => {
    const p = screenToCanvas(ev.clientX, ev.clientY);
    draft.setAttribute('d', straightPath(fixedPoint, p));

    const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
    const nodeElUnder = elUnder?.closest?.('.node');
    const candidateId = nodeElUnder ? nodeElUnder.dataset.nodeId : null;

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

    // Dropped on empty canvas (or nowhere valid) — leave the connector
    // exactly as it was rather than deleting/orphaning it; reconnecting
    // only ever happens by dropping on a real target.
    if (!targetNodeId) return;

    const movingNode = store.getState().nodes.find((n) => n.id === targetNodeId);
    if (!movingNode) return;
    const dropPoint = screenToCanvas(ev.clientX, ev.clientY);
    // A lifeline reconnecting to itself needs to exit the same side it
    // entered on (see connector.js#selfLoopPath) — any other target picks
    // whichever side of it the point was actually dropped nearest, same as
    // a fresh connector drawn onto that node would.
    const isSelf = targetNodeId === fixedNodeId;
    const movingSide = isSelf ? fixedSide : closestSide(movingNode, dropPoint);
    const movingOffset = computeAnchorOffset(movingNode, movingSide, dropPoint);

    store.dispatch((d) => {
      const ed = d.edges.find((x) => x.id === edgeId);
      if (!ed) return;
      if (end === 'from') {
        ed.from = targetNodeId;
        ed.fromSide = movingSide;
        ed.fromOffset = movingOffset;
      } else {
        ed.to = targetNodeId;
        ed.toSide = movingSide;
        ed.toOffset = movingOffset;
      }
    });
    store.select([], [edgeId]);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
