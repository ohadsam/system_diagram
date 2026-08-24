// Pointer-based (mouse + touch) drag from a sidebar item onto the canvas.
// Deliberately not HTML5 Drag & Drop — see docs/ARCHITECTURE.md.
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import {
  createNodeFromDrop, addComponentAtCenter, addLayerToNode, instantiatePattern,
  instantiatePatternAtCenter, instantiatePatternNearNode, resolveComponentDef,
} from '../canvas/canvas.js';

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
    const def = resolveComponentDef(defId);
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    let ghost = null;
    let hoveredNodeEl = null;

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
        const elAtPoint = document.elementFromPoint(ev.clientX, ev.clientY);
        // A pattern dropped onto an existing node instantiates positioned
        // next to it (instantiatePatternNearNode below) rather than
        // centered wherever the cursor happens to be — same "drop onto a
        // node changes behavior" affordance the layer flow already has,
        // just a different resulting action (nearby, not attached onto).
        const dropTargetKind = def?.kind === 'layer' || def?.kind === 'pattern' ? def.kind : null;
        const nodeElUnder = dropTargetKind ? elAtPoint?.closest('.node') : null;
        const dropClass = dropTargetKind === 'pattern' ? 'pattern-drop-target' : 'layer-drop-target';
        if (hoveredNodeEl && hoveredNodeEl !== nodeElUnder) hoveredNodeEl.classList.remove('layer-drop-target', 'pattern-drop-target');
        if (nodeElUnder) nodeElUnder.classList.add(dropClass);
        hoveredNodeEl = nodeElUnder || null;
        ghost.classList.toggle('drop-ready', !!(nodeElUnder || elAtPoint?.closest('.canvas-viewport')));
      }
    };

    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      itemEl.classList.remove('dragging-source');
      hoveredNodeEl?.classList.remove('layer-drop-target', 'pattern-drop-target');

      if (dragging) {
        const elAtPoint = document.elementFromPoint(ev.clientX, ev.clientY);
        const targetNodeId = elAtPoint?.closest('.node')?.dataset.nodeId;
        const overCanvas = elAtPoint?.closest('.canvas-viewport');
        if (def?.kind === 'layer' && targetNodeId) {
          addLayerToNode(defId, targetNodeId);
          closeMobileSidebarDrawer();
        } else if (def?.kind === 'pattern' && targetNodeId) {
          instantiatePatternNearNode(defId, targetNodeId);
          closeMobileSidebarDrawer();
        } else if (def?.kind === 'pattern' && overCanvas) {
          instantiatePattern(defId, ev.clientX, ev.clientY);
          closeMobileSidebarDrawer();
        } else if (overCanvas) {
          createNodeFromDrop(defId, ev.clientX, ev.clientY);
          closeMobileSidebarDrawer();
        }
        ghost?.remove();
      } else if (def?.kind === 'pattern') {
        instantiatePatternAtCenter(defId);
        closeMobileSidebarDrawer();
      } else if (def?.kind === 'layer' && store.getSelection().nodeIds.length === 1) {
        addLayerToNode(defId, store.getSelection().nodeIds[0]);
        closeMobileSidebarDrawer();
      } else {
        addComponentAtCenter(defId);
        closeMobileSidebarDrawer();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}
