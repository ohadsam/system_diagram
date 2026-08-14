// Pointer-driven drag-to-move and drag-to-resize gestures for a node.
// Selection itself is handled by node.js's pointerdown (fires first, see
// canvas.js wiring order) — this module reads the resulting selection to
// decide whether to move just one node or the whole multi-selection.
import * as store from '../core/store.js';
import { screenToCanvas } from './viewport.js';
import { beginConnectFromNode } from './connectorInteractions.js';

const MIN_SIZE = 40;
const IGNORE_SELECTOR = '.conn-point, .resize-handle, .node-info-btn, .node-menu-btn, .row-item, .node-add-row, .inline-edit-input';

export function attachNodeInteractions(rootEl, nodeId) {
  rootEl.addEventListener('pointerdown', (e) => {
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

