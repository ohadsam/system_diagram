// Pure(ish) SVG builder/updater for a single edge (connector/arrow).
// Click/select wiring lives here (simple); drag-to-create lives in
// connectorInteractions.js.
import { svgEl } from '../utils/dom.js';
import { sideAnchor, buildPath, waypointsPath } from '../core/geometry.js';
import { computeMagicWaypoints } from '../core/magicRouter.js';

let handlers = { onSelect: () => {}, onContextMenu: () => {} };
export function configureEdgeHandlers(next) {
  handlers = { ...handlers, ...next };
}

let defsEl = null;
const markerIds = new Set();

export function initConnectorDefs(svg) {
  defsEl = svgEl('defs');
  svg.appendChild(defsEl);
}

function markerId(type, color) {
  return `marker-${type}-${color.replace('#', '')}`;
}

function ensureMarker(type, color) {
  if (type === 'none') return null;
  const id = markerId(type, color);
  if (!markerIds.has(id)) {
    const marker = svgEl('marker', {
      id,
      viewBox: '0 0 10 10',
      markerWidth: 8,
      markerHeight: 8,
      refX: type === 'circle' ? 5 : 9,
      refY: 5,
      orient: 'auto-start-reverse',
    });
    if (type === 'filled') {
      marker.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }));
    } else if (type === 'open') {
      marker.appendChild(svgEl('path', { d: 'M 1 1 L 9 5 L 1 9', fill: 'none', stroke: color, 'stroke-width': 1.5 }));
    } else if (type === 'diamond') {
      marker.appendChild(svgEl('path', { d: 'M 5 0 L 10 5 L 5 10 L 0 5 z', fill: color }));
    } else if (type === 'circle') {
      marker.appendChild(svgEl('circle', { cx: 5, cy: 5, r: 4, fill: color }));
    }
    defsEl.appendChild(marker);
    markerIds.add(id);
  }
  return `url(#${id})`;
}

export function createEdgeEl(edge) {
  const g = svgEl('g', { class: 'edge', 'data-edge-id': edge.id, tabIndex: 0, role: 'group', 'aria-label': 'connector' });
  const hit = svgEl('path', { class: 'edge-hit', fill: 'none', stroke: 'transparent', 'stroke-width': 16 });
  const line = svgEl('path', { class: 'edge-line', fill: 'none' });
  const label = svgEl('text', { class: 'edge-label' });
  g.appendChild(hit);
  g.appendChild(line);
  g.appendChild(label);

  const select = (e) => {
    e.stopPropagation();
    g.focus({ preventScroll: true });
    handlers.onSelect(edge.id, e.shiftKey || e.metaKey || e.ctrlKey);
  };
  g.addEventListener('pointerdown', select);
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handlers.onSelect(edge.id, false);
    handlers.onContextMenu(edge.id, e);
  });
  return g;
}

export function updateEdgeEl(g, edge, fromNode, toNode, { selected = false, allNodes = [] } = {}) {
  g.classList.toggle('selected', !!selected);
  g.classList.toggle('edge-magic', edge.routing === 'magic');
  const a = sideAnchor(fromNode, edge.fromSide);
  const b = sideAnchor(toNode, edge.toSide);
  const d = buildEdgePath(edge, fromNode, toNode, a, b, allNodes);

  const hit = g.querySelector('.edge-hit');
  const line = g.querySelector('.edge-line');
  const label = g.querySelector('.edge-label');

  hit.setAttribute('d', d);
  line.setAttribute('d', d);
  line.setAttribute('stroke', edge.color);
  line.setAttribute('stroke-width', String(edge.width));
  line.setAttribute('stroke-dasharray', dashArray(edge.dash, edge.width));
  const startMarker = ensureMarker(edge.startArrow, edge.color);
  const endMarker = ensureMarker(edge.endArrow, edge.color);
  if (startMarker) line.setAttribute('marker-start', startMarker);
  else line.removeAttribute('marker-start');
  if (endMarker) line.setAttribute('marker-end', endMarker);
  else line.removeAttribute('marker-end');

  if (edge.label) {
    const mid = pathMidpoint(line);
    label.textContent = edge.label;
    label.setAttribute('x', String(mid.x));
    label.setAttribute('y', String(mid.y - 6));
    label.style.display = '';
  } else {
    label.style.display = 'none';
  }
}

/** Obstacle-avoiding routing computes a path fresh from current node
 * positions each render (nothing persisted) — same "dynamic reshaping"
 * behavior every other routing already gets when nodes move, and it never
 * goes stale. Falls back to a plain elbow route if no path is found (e.g.
 * the target is fully boxed in) so an edge never simply disappears.
 *
 * Applies to the default 'orthogonal' routing, not just an explicitly
 * chosen 'magic' one — every freshly-drawn connector routes around
 * whatever's in the way out of the box, no arming step needed (the
 * toolbar toggle that used to require one was removed for exactly this
 * reason). 'magic' still exists as its own routing value (and gets the
 * `.edge-magic` glow — see connector.css) for a user who wants to force
 * this behavior on an edge whose *sides* were set some other way (e.g.
 * hand-edited after drawing); 'straight'/'curved' are deliberately
 * literal, simple styles and stay untouched by this — that's the whole
 * point of choosing them over an elbow. */
function buildEdgePath(edge, fromNode, toNode, a, b, allNodes) {
  if (edge.routing === 'magic' || edge.routing === 'orthogonal') {
    const obstacles = allNodes.filter((n) => n.id !== fromNode.id && n.id !== toNode.id);
    const waypoints = computeMagicWaypoints(fromNode, toNode, obstacles, edge.fromSide, edge.toSide);
    if (waypoints) return waypointsPath(waypoints);
    return buildPath('orthogonal', a, b, edge.fromSide, edge.toSide);
  }
  return buildPath(edge.routing, a, b, edge.fromSide, edge.toSide);
}

function dashArray(dash, width) {
  if (dash === 'dashed') return `${width * 3},${width * 2}`;
  if (dash === 'dotted') return `${width},${width * 1.6}`;
  return 'none';
}

function pathMidpoint(pathEl) {
  try {
    const len = pathEl.getTotalLength();
    return pathEl.getPointAtLength(len / 2);
  } catch {
    return { x: 0, y: 0 };
  }
}
