// On-canvas minimap overlay: a small fixed-position panel in the corner of
// #canvas-viewport showing every node as a tiny rect plus a "you are here"
// box for the current pan/zoom — click or drag anywhere on it to jump the
// main view there. Self-contained (own store/viewport subscriptions, own
// render loop) rather than folded into canvas.js's main render() — it's
// display-only overlay chrome with no interaction with node/edge state, the
// same reasoning alignmentGuides.js's guideLayer is driven separately from
// the main node/edge diff render.
import * as store from '../core/store.js';
import * as viewport from './viewport.js';
import { el, svgEl } from '../utils/dom.js';
import { computeMinimapLayout, minimapPointToCanvas } from '../core/minimap.js';

const MAP_SIZE = { w: 220, h: 150 };

let viewportEl = null;
let rootEl = null;
let svgRoot = null;
let visible = false;
let unsubStore = null;
let unsubViewport = null;
let resizeObserver = null;

export function initMinimap(canvasViewportEl) {
  viewportEl = canvasViewportEl;
  rootEl = el('div', { class: 'minimap', hidden: true, 'aria-label': 'Minimap — click or drag to jump the view' });
  svgRoot = svgEl('svg', { class: 'minimap-svg', viewBox: `0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}` });
  rootEl.appendChild(svgRoot);
  viewportEl.appendChild(rootEl);

  svgRoot.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    svgRoot.setPointerCapture(e.pointerId);
    jumpTo(e);
    const onMove = (ev) => jumpTo(ev);
    const onUp = () => {
      svgRoot.removeEventListener('pointermove', onMove);
      svgRoot.removeEventListener('pointerup', onUp);
    };
    svgRoot.addEventListener('pointermove', onMove);
    svgRoot.addEventListener('pointerup', onUp);
  });
}

function jumpTo(e) {
  const rect = svgRoot.getBoundingClientRect();
  const mapX = ((e.clientX - rect.left) / rect.width) * MAP_SIZE.w;
  const mapY = ((e.clientY - rect.top) / rect.height) * MAP_SIZE.h;
  const layout = computeMinimapLayout(store.getState().nodes, viewport.getViewport(), viewportEl.getBoundingClientRect(), MAP_SIZE);
  const point = minimapPointToCanvas(mapX, mapY, layout);
  viewport.centerOn(point.x, point.y);
}

export function setMinimapVisible(next) {
  visible = next;
  if (!rootEl) return;
  rootEl.hidden = !next;
  if (next) {
    render();
    if (!unsubStore) unsubStore = store.subscribe('change', render);
    if (!unsubViewport) unsubViewport = viewport.onViewportChange(render);
    if (!resizeObserver && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(viewportEl);
    }
  } else {
    unsubStore?.();
    unsubViewport?.();
    resizeObserver?.disconnect();
    unsubStore = null;
    unsubViewport = null;
    resizeObserver = null;
  }
}

function render() {
  if (!visible || !svgRoot) return;
  const nodes = store.getState().nodes;
  const layout = computeMinimapLayout(nodes, viewport.getViewport(), viewportEl.getBoundingClientRect(), MAP_SIZE);

  while (svgRoot.firstChild) svgRoot.removeChild(svgRoot.firstChild);
  for (const r of layout.nodeRects) {
    svgRoot.appendChild(svgEl('rect', {
      class: 'minimap-node', x: r.x, y: r.y, width: Math.max(r.w, 2), height: Math.max(r.h, 2), rx: 1,
    }));
  }
  svgRoot.appendChild(svgEl('rect', {
    class: 'minimap-viewport',
    x: layout.viewportRect.x, y: layout.viewportRect.y,
    width: Math.max(layout.viewportRect.w, 1), height: Math.max(layout.viewportRect.h, 1),
  }));
}
