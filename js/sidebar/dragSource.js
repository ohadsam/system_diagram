// Pointer-based (mouse + touch) drag from a sidebar item onto the canvas.
// Deliberately not HTML5 Drag & Drop — see docs/ARCHITECTURE.md.
import { el } from '../utils/dom.js';
import { createNodeFromDrop, addComponentAtCenter } from '../canvas/canvas.js';

const DRAG_THRESHOLD = 5;

// On mobile the sidebar is a slide-over drawer (see css/responsive.css) —
// once a component has actually been placed, get it out of the way so the
// user can see it land on the canvas instead of requiring an extra tap.
function closeMobileSidebarDrawer() {
  document.querySelector('.sidebar')?.classList.remove('open');
}

export function makeDraggable(itemEl, defId) {
  itemEl.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    let ghost = null;

    const onMove = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragging = true;
        ghost = el('div', { class: 'sidebar-drag-ghost', text: itemEl.dataset.name || '' });
        document.body.appendChild(ghost);
        itemEl.classList.add('dragging-source');
      }
      if (dragging && ghost) {
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
        const overCanvas = !!document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.canvas-viewport');
        ghost.classList.toggle('drop-ready', overCanvas);
      }
    };

    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      itemEl.classList.remove('dragging-source');
      if (dragging) {
        const overCanvas = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.canvas-viewport');
        if (overCanvas) {
          createNodeFromDrop(defId, ev.clientX, ev.clientY);
          closeMobileSidebarDrawer();
        }
        ghost?.remove();
      } else {
        addComponentAtCenter(defId);
        closeMobileSidebarDrawer();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}
