// Drag-to-add/move manual connector waypoints (see core/project.js's
// `edge.waypoints` and canvas/connector.js#buildEdgePath). Mirrors
// edgeReconnect.js's approach closely: small handles live in their own
// overlay layer (shared with edgeReconnect's endpoint handles — both are
// initialized with the same `edgeHandleLayer`, see canvas/canvas.js),
// stacked above .node-layer so a handle never loses a pointer hit-test to
// whatever node happens to sit underneath it.
//
// Two kinds of handle, both only shown for the currently-selected edge(s):
//  - A small square at each existing waypoint — drag to move it, right-click
//    to remove it.
//  - A smaller, fainter circle at the midpoint of each segment (including
//    the segment(s) touching a plain anchor, not just between two existing
//    waypoints) — dragging it inserts a brand-new waypoint there and
//    immediately continues the drag from it, the same "grab a midpoint to
//    bend the line" gesture most diagram tools use.
import * as store from '../core/store.js';
import { screenToCanvas } from './viewport.js';
import { sideAnchor } from '../core/geometry.js';
import { svgEl } from '../utils/dom.js';

let handleLayer = null;
const waypointElements = new Map(); // `${edgeId}:${index}` -> rect el
const addElements = new Map(); // `${edgeId}:${segmentIndex}` -> circle el

export function initWaypointHandles(layer) {
  handleLayer = layer;
}

/** Rebuilds the waypoint-handle overlay for whichever edges are currently
 * selected — call after any store change and after any selection change,
 * same contract as edgeReconnect.js#syncEdgeHandles. Cheap and idempotent. */
export function syncWaypointHandles(state, selection) {
  if (!handleLayer) return;
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const edgesById = new Map(state.edges.map((e) => [e.id, e]));
  const wantedWaypoints = new Set();
  const wantedAdds = new Set();

  for (const edgeId of selection.edgeIds) {
    const edge = edgesById.get(edgeId);
    if (!edge) continue;
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    // A self-message always renders as its own fixed loop shape (see
    // connector.js#selfLoopPath) — nothing to bend, so no handles for it.
    if (!fromNode || !toNode || fromNode.id === toNode.id) continue;

    const a = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5);
    const b = sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5);
    const waypoints = edge.waypoints || [];
    const points = [a, ...waypoints, b];

    waypoints.forEach((wp, i) => placeWaypointHandle(edgeId, i, wp, wantedWaypoints));
    for (let i = 0; i < points.length - 1; i++) {
      const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
      placeAddHandle(edgeId, i, mid, wantedAdds);
    }
  }

  for (const [key, el] of waypointElements) {
    if (!wantedWaypoints.has(key)) { el.remove(); waypointElements.delete(key); }
  }
  for (const [key, el] of addElements) {
    if (!wantedAdds.has(key)) { el.remove(); addElements.delete(key); }
  }
}

const HANDLE_SIZE = 9;

function placeWaypointHandle(edgeId, index, point, wanted) {
  const key = `${edgeId}:${index}`;
  wanted.add(key);
  let el = waypointElements.get(key);
  if (!el) {
    el = svgEl('rect', {
      class: 'waypoint-handle',
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      'data-edge-id': edgeId,
      tabIndex: 0,
      'aria-label': "Drag to move this connector's bend point — right-click to remove it",
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      beginDragWaypoint(edgeId, index, e);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeWaypoint(edgeId, index);
    });
    waypointElements.set(key, el);
    handleLayer.appendChild(el);
  }
  el.setAttribute('x', String(point.x - HANDLE_SIZE / 2));
  el.setAttribute('y', String(point.y - HANDLE_SIZE / 2));
}

function placeAddHandle(edgeId, segmentIndex, point, wanted) {
  const key = `${edgeId}:${segmentIndex}`;
  wanted.add(key);
  let el = addElements.get(key);
  if (!el) {
    el = svgEl('circle', {
      class: 'waypoint-add-handle',
      r: 5,
      'data-edge-id': edgeId,
      'aria-label': 'Drag to bend the connector here, adding a new waypoint',
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      beginAddWaypoint(edgeId, segmentIndex, e);
    });
    // Unlike a waypoint's own handle (right-click there deletes it — a
    // deliberate, discoverable action), this "ghost" add-affordance has no
    // right-click behavior of its own, and it can sit exactly at a
    // segment's visual midpoint — the same point a user (or a test's
    // click-somewhere-safe-on-the-edge helper) would naturally right-click
    // expecting the connector's own context menu. Forward it there instead
    // of silently swallowing the click (this handle lives in its own
    // overlay layer, not inside the edge's own <g>, so the event would
    // never reach it by bubbling alone).
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const edgeEl = document.querySelector(`.edge[data-edge-id="${edgeId}"]`);
      edgeEl?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
    });
    addElements.set(key, el);
    handleLayer.appendChild(el);
  }
  el.setAttribute('cx', String(point.x));
  el.setAttribute('cy', String(point.y));
}

function removeWaypoint(edgeId, index) {
  store.dispatch((draft) => {
    const edge = draft.edges.find((e) => e.id === edgeId);
    if (edge) edge.waypoints.splice(index, 1);
  });
}

function beginAddWaypoint(edgeId, segmentIndex, e) {
  const p = screenToCanvas(e.clientX, e.clientY);
  // Coalesced (not committed yet) so a plain click-and-drag — or even a
  // click with no movement at all — lands as one single undo step once
  // beginDragWaypoint's own onUp commits, rather than two ("added" then
  // "moved").
  store.dispatch((draft) => {
    const edge = draft.edges.find((x) => x.id === edgeId);
    if (edge) edge.waypoints.splice(segmentIndex, 0, { x: p.x, y: p.y });
  }, { coalesce: true });
  beginDragWaypoint(edgeId, segmentIndex, e);
}

function beginDragWaypoint(edgeId, index, e) {
  e.currentTarget?.setPointerCapture?.(e.pointerId);
  let point = screenToCanvas(e.clientX, e.clientY);
  let raf = null;

  const apply = () => {
    raf = null;
    store.dispatch((draft) => {
      const edge = draft.edges.find((x) => x.id === edgeId);
      const wp = edge?.waypoints[index];
      if (wp) { wp.x = point.x; wp.y = point.y; }
    }, { coalesce: true });
  };

  const onMove = (ev) => {
    point = screenToCanvas(ev.clientX, ev.clientY);
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (raf) cancelAnimationFrame(raf);
    apply();
    store.commitHistory();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  apply();
}
