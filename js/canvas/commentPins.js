// Renders Figma-style pinned-comment markers (see core/project.js's
// `comments` array) as small clickable dots in canvas space — lives in its
// own layer (canvas/canvas.js's commentLayer, topmost inside .canvas-content
// so a pin is never hidden behind a node) and re-renders on every store
// change, the same "diff by id, reuse existing DOM" pattern canvas.js's own
// node/edge render() uses.
import { el } from '../utils/dom.js';

let layerEl = null;
const pinElements = new Map(); // commentId -> element

export function initCommentPins(layer) {
  layerEl = layer;
}

export function renderCommentPins(comments) {
  if (!layerEl) return;
  const wanted = new Set();
  for (const comment of comments) {
    wanted.add(comment.id);
    let pin = pinElements.get(comment.id);
    if (!pin) {
      pin = el('button', {
        type: 'button',
        class: 'comment-pin',
        'data-comment-id': comment.id,
        onClick: (e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('sdb:open-comment', { detail: { commentId: comment.id } }));
        },
      });
      // Stops a pin click from also starting the canvas background's own
      // marquee-select/pan gesture (wireBackgroundInteractions in canvas.js
      // listens on pointerdown, not click) — same reasoning connector.js's
      // edge selection handler stops propagation on pointerdown too.
      pin.addEventListener('pointerdown', (e) => e.stopPropagation());
      pinElements.set(comment.id, pin);
      layerEl.appendChild(pin);
    }
    pin.style.left = `${comment.x}px`;
    pin.style.top = `${comment.y}px`;
    pin.classList.toggle('resolved', !!comment.resolved);
    pin.textContent = comment.resolved ? '✓' : '💬';
    pin.title = comment.text ? comment.text.slice(0, 80) : 'Comment';
    pin.setAttribute('aria-label', comment.resolved ? 'Resolved comment' : 'Comment');
  }
  for (const [id, pin] of pinElements) {
    if (!wanted.has(id)) { pin.remove(); pinElements.delete(id); }
  }
}
