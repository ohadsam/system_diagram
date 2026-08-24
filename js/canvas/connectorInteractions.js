// Drag-from-a-node's-connection-point-to-another-node gesture that creates
// a new edge. The in-progress line is a throwaway SVG element, not project
// state, so nothing is dispatched to the store until the gesture succeeds.
import * as store from '../core/store.js';
import { createEdge } from '../core/project.js';
import { svgEl } from '../utils/dom.js';
import { screenToCanvas } from './viewport.js';
import { sideAnchor, pickBestSides, straightPath, computeAnchorOffset } from '../core/geometry.js';
import { focusEdge } from './canvas.js';

let draftLayer = null;

export function initConnectorInteractions(svg) {
  draftLayer = svg;
}

export function beginConnectFromNode(nodeId, side, e) {
  const fromNode = store.getState().nodes.find((n) => n.id === nodeId);
  if (!fromNode || !draftLayer) return;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  // Where on the side the user actually grabbed, not always the midpoint —
  // for most shapes the dot handle *is* the midpoint so this comes out to
  // ~0.5 either way, but a tall shape (e.g. a sequence-diagram lifeline)
  // exposes a full-height strip instead of a small dot (see css/node.css),
  // letting several connectors land at different heights on the same node
  // instead of stacking on one point. See core/geometry.js#sideAnchor.
  const grabPoint = screenToCanvas(e.clientX, e.clientY);
  const a = sideAnchor(fromNode, side, computeAnchorOffset(fromNode, side, grabPoint));

  const draft = svgEl('path', { class: 'edge-draft', fill: 'none' });
  draftLayer.appendChild(draft);

  let targetNodeId = null;
  let hoveredEl = null;

  const onMove = (ev) => {
    const p = screenToCanvas(ev.clientX, ev.clientY);
    draft.setAttribute('d', straightPath(a, p));

    const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
    const nodeElUnder = elUnder?.closest?.('.node');
    // A lifeline may connect to itself (a "self-message" — see
    // connector.js#selfLoopPath) since its full-height conn-point strip lets
    // a drag start and end at two genuinely different heights on the same
    // node; every other shape's drag-target dot is a single point, so
    // dropping back on the source there would just be a same-point no-op.
    const allowSelf = fromNode.shape === 'lifeline';
    const candidateId = nodeElUnder && (nodeElUnder.dataset.nodeId !== nodeId || allowSelf) ? nodeElUnder.dataset.nodeId : null;

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
      // Anchor sides come from the two nodes' actual relative position
      // (pickBestSides), not from whichever exact connection-point handle
      // was dragged from/to — a literal drag-point side produced needlessly
      // awkward paths (e.g. exiting left when the target sits to the
      // right) whenever the grabbed handle didn't happen to face the other
      // node. See docs/ARCHITECTURE.md's connector routing section.
      // A self-message needs both ends exiting the *same* side (the loop
      // shape only makes sense that way) — pickBestSides would instead see
      // two identical, fully-overlapping rects and default to right/left,
      // which draws as a flat line straight through the lifeline.
      const isSelfMessage = targetNodeId === nodeId;
      const sides = isSelfMessage
        ? { fromSide: side, toSide: side }
        : toNode ? pickBestSides(fromNode, toNode) : { fromSide: side, toSide: 'left' };
      // Re-derive against `sides.fromSide` (which can differ from the side
      // actually grabbed — see the comment on pickBestSides above) rather
      // than reusing an offset computed for the grabbed side: a fraction
      // meant for one axis (say, how far down a left/right edge) would be
      // silently misapplied to the other axis (how far across a top/bottom
      // edge) if pickBestSides ends up choosing a different side.
      const fromOffset = computeAnchorOffset(fromNode, sides.fromSide, grabPoint);
      const toOffset = toNode ? computeAnchorOffset(toNode, sides.toSide, screenToCanvas(ev.clientX, ev.clientY)) : 0.5;
      const isMessage = toNode && fromNode.shape === 'lifeline' && toNode.shape === 'lifeline';
      const edge = createEdge(nodeId, targetNodeId, {
        ...sides,
        fromOffset,
        toOffset,
        ...(isMessage ? { routing: 'straight' } : {}),
      });
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
