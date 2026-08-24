// Pointer-driven drag-to-move and drag-to-resize gestures for a node.
// Selection itself is handled by node.js's pointerdown (fires first, see
// canvas.js wiring order) — this module reads the resulting selection to
// decide whether to move just one node or the whole multi-selection.
import * as store from '../core/store.js';
import { clamp } from '../core/geometry.js';
import { screenToCanvas } from './viewport.js';
import { beginConnectFromNode } from './connectorInteractions.js';

const MIN_SIZE = 40;
const IGNORE_SELECTOR = '.conn-point, .resize-handle, .node-info-btn, .node-menu-btn, .row-item, .node-add-row, .inline-edit-input, .lifeline-activation';

export function attachNodeInteractions(rootEl, nodeId) {
  rootEl.addEventListener('pointerdown', (e) => {
    // Activation bars are rebuilt on every render (variable count — see
    // node.js#updateNodeEl), so they're handled here via delegation rather
    // than their own addEventListener, which a rebuild would silently drop.
    const handle = e.target.closest('.activation-handle');
    const bar = e.target.closest('.lifeline-activation');
    if (e.button === 0 && handle && bar) {
      e.stopPropagation();
      e.preventDefault();
      beginActivationResize(nodeId, bar.dataset.activationId, handle.dataset.edge, e);
      return;
    }
    if (e.button === 0 && bar) {
      e.stopPropagation();
      e.preventDefault();
      beginActivationMove(nodeId, bar.dataset.activationId, e);
      return;
    }
    if (e.button !== 0 || e.target.closest(IGNORE_SELECTOR)) return;
    beginMove(nodeId, e);
  });

  rootEl.querySelectorAll('.resize-handle').forEach((handleEl) => {
    handleEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      beginResize(nodeId, handleEl.dataset.handle, e);
    });
  });

  rootEl.querySelectorAll('.conn-point').forEach((pointEl) => {
    pointEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      beginConnectFromNode(nodeId, pointEl.dataset.side, e);
    });
  });
}

function beginMove(nodeId, e) {
  e.preventDefault();
  // preventDefault() also suppresses the browser's default click-to-focus
  // behavior, which would otherwise leave focus stuck in e.g. the sidebar
  // search box and silently swallow keyboard shortcuts (Delete/undo/duplicate)
  // via main.js's isTypingTarget guard — so focus the node explicitly.
  e.currentTarget.focus({ preventScroll: true });
  // Deliberately does *not* call setPointerCapture here the way the other
  // begin*() gestures in this codebase do (see css/canvas.css's
  // .canvas-viewport comment for the general reasoning) — this handler
  // fires on every pointerdown on a node, including both of a
  // double-click's, and capturing the pointer there broke the browser's
  // native dblclick synthesis outright (caught by
  // tests/e2e/mobile-responsive.spec.js's inline-rename test). Not needed
  // for the touch-scroll-conflict problem anyway: touch-action:none on the
  // ancestor #canvas-viewport (which the CSS Touch Action spec applies to
  // this element too, being a descendant) already stops native scroll from
  // fighting this drag without it.
  const startCanvas = screenToCanvas(e.clientX, e.clientY);
  const state = store.getState();
  const selection = store.getSelection();
  const movingIds = selection.nodeIds.includes(nodeId) && selection.nodeIds.length > 1 ? selection.nodeIds : [nodeId];
  const startPositions = new Map(
    movingIds.map((id) => {
      const n = state.nodes.find((x) => x.id === id);
      return [id, { x: n.x, y: n.y }];
    }),
  );

  let moved = false;
  let raf = null;
  let dx = 0;
  let dy = 0;

  const apply = () => {
    raf = null;
    store.dispatch((draft) => {
      for (const id of movingIds) {
        const start = startPositions.get(id);
        const n = draft.nodes.find((x) => x.id === id);
        if (n && start) {
          n.x = start.x + dx;
          n.y = start.y + dy;
        }
      }
    }, { coalesce: true });
  };

  const onMove = (ev) => {
    const cur = screenToCanvas(ev.clientX, ev.clientY);
    dx = cur.x - startCanvas.x;
    dy = cur.y - startCanvas.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (raf) cancelAnimationFrame(raf);
    if (moved) {
      apply();
      store.commitHistory();
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function beginResize(nodeId, handle, e) {
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const startCanvas = screenToCanvas(e.clientX, e.clientY);
  const state = store.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const start = { x: node.x, y: node.y, w: node.w, h: node.h };
  let raf = null;
  let dx = 0;
  let dy = 0;

  const apply = () => {
    raf = null;
    store.dispatch((draft) => {
      const n = draft.nodes.find((x) => x.id === nodeId);
      if (!n) return;
      let { x, y, w, h } = start;
      if (handle.includes('e')) w = start.w + dx;
      if (handle.includes('s')) h = start.h + dy;
      if (handle.includes('w')) {
        w = start.w - dx;
        x = start.x + dx;
      }
      if (handle.includes('n')) {
        h = start.h - dy;
        y = start.y + dy;
      }
      if (w < MIN_SIZE) {
        if (handle.includes('w')) x -= MIN_SIZE - w;
        w = MIN_SIZE;
      }
      if (h < MIN_SIZE) {
        if (handle.includes('n')) y -= MIN_SIZE - h;
        h = MIN_SIZE;
      }
      n.x = x;
      n.y = y;
      n.w = w;
      n.h = h;
    }, { coalesce: true });
  };

  const onMove = (ev) => {
    const cur = screenToCanvas(ev.clientX, ev.clientY);
    dx = cur.x - startCanvas.x;
    dy = cur.y - startCanvas.y;
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
}

// UML activation bar (execution occurrence) drag-to-move/-resize — see
// node.js#updateNodeEl for how {id, startOffset, endOffset} renders, and
// canvas.js#addActivationBar/removeActivationBar for how one is added/
// removed. Both gestures convert a screen-space pointer delta to a
// fraction of the *lifeline's own height* (not a fixed pixel span), so they
// stay correct at any zoom level, mirroring beginResize's dx/dy above.
const MIN_ACTIVATION_SPAN = 0.03;

function beginActivationMove(nodeId, activationId, e) {
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const startCanvas = screenToCanvas(e.clientX, e.clientY);
  const state = store.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  const act = node?.activations?.find((a) => a.id === activationId);
  if (!node || !act) return;
  const start = { startOffset: act.startOffset, endOffset: act.endOffset };
  const span = start.endOffset - start.startOffset;
  let raf = null;
  let dy = 0;

  const apply = () => {
    raf = null;
    store.dispatch((draft) => {
      const n = draft.nodes.find((x) => x.id === nodeId);
      const a = n?.activations?.find((x) => x.id === activationId);
      if (!a || !n.h) return;
      const s = clamp(start.startOffset + dy / n.h, 0, 1 - span);
      a.startOffset = s;
      a.endOffset = s + span;
    }, { coalesce: true });
  };

  const onMove = (ev) => {
    const cur = screenToCanvas(ev.clientX, ev.clientY);
    dy = cur.y - startCanvas.y;
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
}

function beginActivationResize(nodeId, activationId, edge, e) {
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const startCanvas = screenToCanvas(e.clientX, e.clientY);
  const state = store.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  const act = node?.activations?.find((a) => a.id === activationId);
  if (!node || !act) return;
  const start = { startOffset: act.startOffset, endOffset: act.endOffset };
  let raf = null;
  let dy = 0;

  const apply = () => {
    raf = null;
    store.dispatch((draft) => {
      const n = draft.nodes.find((x) => x.id === nodeId);
      const a = n?.activations?.find((x) => x.id === activationId);
      if (!a || !n.h) return;
      const deltaOffset = dy / n.h;
      if (edge === 'start') {
        a.startOffset = clamp(start.startOffset + deltaOffset, 0, start.endOffset - MIN_ACTIVATION_SPAN);
      } else {
        a.endOffset = clamp(start.endOffset + deltaOffset, start.startOffset + MIN_ACTIVATION_SPAN, 1);
      }
    }, { coalesce: true });
  };

  const onMove = (ev) => {
    const cur = screenToCanvas(ev.clientX, ev.clientY);
    dy = cur.y - startCanvas.y;
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
}

