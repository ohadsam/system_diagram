// Pure(ish) SVG builder/updater for a single edge (connector/arrow).
// Click/select wiring lives here (simple); drag-to-create lives in
// connectorInteractions.js.
import { svgEl } from '../utils/dom.js';
import { sideAnchor, buildPath, waypointsPath } from '../core/geometry.js';
import { computeMagicWaypoints } from '../core/magicRouter.js';
import { wrapLabelLines, DEFAULT_LABEL_MAX_WIDTH } from '../core/labelWrap.js';

const LABEL_LINE_HEIGHT = 12;

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
  // SVG's native hover-tooltip mechanism (unlike HTML, a `title` *attribute*
  // on an SVG element is not reliably honored — a `<title>` child element
  // is the one that actually works across browsers) — surfaces the edge's
  // existing `notes` field (previously only visible by opening the details
  // panel) as a plain hover tooltip, same free-text field used for a
  // sequence-diagram message's extra context.
  const tooltip = svgEl('title');
  g.appendChild(tooltip);
  const hit = svgEl('path', { class: 'edge-hit', fill: 'none', stroke: 'transparent', 'stroke-width': 16 });
  const line = svgEl('path', { class: 'edge-line', fill: 'none', id: `edge-path-${edge.id}` });
  const label = svgEl('text', { class: 'edge-label' });
  const seqBadge = svgEl('g', { class: 'edge-seq-badge' });
  const seqCircle = svgEl('circle', { r: 9 });
  const seqText = svgEl('text');
  seqBadge.appendChild(seqCircle);
  seqBadge.appendChild(seqText);
  // Flow-simulation dot (see canvas.js#setFlowSimulationEnabled) — a small
  // circle that rides the same path via <mpath>, a live reference that
  // automatically follows the path's `d` whenever updateEdgeEl changes it,
  // so no per-move JS upkeep is needed here. Hidden by CSS unless the
  // .edge-layer carries .flow-simulation-on; its SMIL timing is paused at
  // the layer level (edgeLayer.pauseAnimations()) so it costs nothing when
  // the feature is off, however many edges the diagram has.
  const flowDot = svgEl('circle', { class: 'flow-dot', r: 4 });
  const flowMotion = svgEl('animateMotion', { dur: '2.4s', repeatCount: 'indefinite' });
  const flowMpath = svgEl('mpath', { href: `#edge-path-${edge.id}` });
  flowMpath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#edge-path-${edge.id}`);
  flowMotion.appendChild(flowMpath);
  flowDot.appendChild(flowMotion);
  g.appendChild(hit);
  g.appendChild(line);
  g.appendChild(flowDot);
  g.appendChild(label);
  g.appendChild(seqBadge);

  const select = (e) => {
    // See node.js's matching pointerdown handler for why a right-click
    // (button 2) on an already-selected edge preserves the current
    // multi-selection instead of collapsing it before 'contextmenu' fires.
    if (e.button === 2 && g.classList.contains('selected')) return;
    e.stopPropagation();
    g.focus({ preventScroll: true });
    handlers.onSelect(edge.id, e.shiftKey || e.metaKey || e.ctrlKey);
  };
  g.addEventListener('pointerdown', select);
  g.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handlers.onContextMenu(edge.id, e);
  });
  return g;
}

export function updateEdgeEl(g, edge, fromNode, toNode, { selected = false, allNodes = [], sequenceNumber = null } = {}) {
  g.classList.toggle('selected', !!selected);
  g.classList.toggle('edge-magic', edge.routing === 'magic');
  const a = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5);
  const b = sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5);
  const d = buildEdgePath(edge, fromNode, toNode, a, b, allNodes);

  const hit = g.querySelector('.edge-hit');
  const line = g.querySelector('.edge-line');
  const label = g.querySelector('.edge-label');
  const seqBadge = g.querySelector('.edge-seq-badge');

  g.querySelector('title').textContent = edge.notes || '';

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

  // Cleared unconditionally (not just when repopulating below) — otherwise
  // clearing a label back to empty would leave its old <tspan> children
  // sitting in the DOM (just hidden via display:none), so anything reading
  // the element's own textContent (e.g. an e2e assertion) would still see
  // stale text.
  while (label.firstChild) label.removeChild(label.firstChild);
  if (edge.label) {
    const pos = pathPointForLabel(line, edge.labelPosition);
    // Multi-line via <tspan> rather than a single long <text> run — SVG text
    // has no CSS `overflow-wrap` equivalent, so a long label (a common
    // sequence-diagram message, e.g. "verify code_verifier matches
    // challenge") would otherwise render as one unbroken line that overlaps
    // its neighbors. fill/stroke/paint-order set on the parent <text>
    // (css/connector.css) are inherited by every <tspan> automatically, so
    // the legibility halo still applies per line with no extra CSS needed.
    const lines = wrapLabelLines(edge.label, edge.labelMaxWidth || DEFAULT_LABEL_MAX_WIDTH);
    const topY = pos.y - 6 - (lines.length - 1) * LABEL_LINE_HEIGHT;
    // Also set on the parent <text> itself (not just each <tspan>) — a
    // <tspan> with no explicit x/y otherwise inherits its position from the
    // *current text position*, which for the first tspan comes from the
    // parent element's own x/y attributes. Keeping these in sync also
    // matters for anything reading the label's own position directly
    // rather than its first tspan (e.g. this app's own e2e assertions on
    // `.edge-label`'s `x`/`y` attributes).
    label.setAttribute('x', String(pos.x));
    label.setAttribute('y', String(topY));
    lines.forEach((text, i) => {
      const tspan = svgEl('tspan', { x: String(pos.x), y: String(topY + i * LABEL_LINE_HEIGHT) });
      tspan.textContent = text;
      label.appendChild(tspan);
    });
    label.style.display = '';
  } else {
    label.style.display = 'none';
  }

  if (sequenceNumber != null) {
    seqBadge.querySelector('circle').setAttribute('cx', String(a.x));
    seqBadge.querySelector('circle').setAttribute('cy', String(a.y));
    const text = seqBadge.querySelector('text');
    text.textContent = String(sequenceNumber);
    text.setAttribute('x', String(a.x));
    text.setAttribute('y', String(a.y));
    seqBadge.classList.toggle('is-override', edge.sequenceNumberOverride != null);
    seqBadge.style.display = '';
  } else {
    seqBadge.style.display = 'none';
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
// How far a self-message (a lifeline calling itself — see
// connectorInteractions.js's same-node drop handling) juts out from the
// lifeline before looping back, in canvas px. UML convention draws this as a
// small open rectangle, not a straight line (which would be a zero-width
// sliver since both ends anchor on the same side of the same node).
const SELF_LOOP_OUT = 56;

function selfLoopPath(edge, a, b) {
  const horizontal = edge.fromSide === 'left' || edge.fromSide === 'right';
  if (horizontal) {
    const outX = a.x + (edge.fromSide === 'left' ? -1 : 1) * SELF_LOOP_OUT;
    return `M ${a.x} ${a.y} L ${outX} ${a.y} L ${outX} ${b.y} L ${b.x} ${b.y}`;
  }
  const outY = a.y + (edge.fromSide === 'top' ? -1 : 1) * SELF_LOOP_OUT;
  return `M ${a.x} ${a.y} L ${a.x} ${outY} L ${b.x} ${outY} L ${b.x} ${b.y}`;
}

function buildEdgePath(edge, fromNode, toNode, a, b, allNodes) {
  // A self-message (fromNode === toNode) always renders as a loop — magic/
  // orthogonal routing has nothing to route around here (there's no gap
  // between two different nodes to navigate), and straight/curved between
  // two points on the very same side of the very same node would draw a
  // near-invisible sliver instead of a readable "calls itself" shape.
  if (fromNode.id === toNode.id) return selfLoopPath(edge, a, b);
  // Manual waypoints (dragged in via canvas/waypointHandles.js) are an
  // explicit user override — same "wins over automatic" precedent as e.g.
  // a def's own textPosition beating the global default — so they take the
  // path over any routing algorithm, orthogonal/magic included.
  if (edge.waypoints?.length) return waypointsPath([a, ...edge.waypoints, b]);
  if (edge.routing === 'magic' || edge.routing === 'orthogonal') {
    const obstacles = allNodes.filter((n) => n.id !== fromNode.id && n.id !== toNode.id);
    const waypoints = computeMagicWaypoints(fromNode, toNode, obstacles, edge.fromSide, edge.toSide, edge.fromOffset ?? 0.5, edge.toOffset ?? 0.5);
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

// Fraction along the rendered path for each labelPosition — 'start'/'end'
// deliberately stop short of the actual endpoints (0/1) rather than sitting
// exactly on them, so the label doesn't overlap the arrowhead or get
// clipped by the node/lifeline it anchors into.
const LABEL_POSITION_T = { start: 0.15, middle: 0.5, end: 0.85 };

function pathPointForLabel(pathEl, labelPosition) {
  try {
    const len = pathEl.getTotalLength();
    const t = LABEL_POSITION_T[labelPosition] ?? LABEL_POSITION_T.middle;
    return pathEl.getPointAtLength(len * t);
  } catch {
    return { x: 0, y: 0 };
  }
}
