// Orchestrates the canvas: mounts the DOM, renders nodes/edges from the
// store, and owns pan/zoom/marquee-selection. See docs/ARCHITECTURE.md
// "Canvas rendering".
import * as store from '../core/store.js';
import { createEdge, nextZIndex, removeNode as removeNodeFromProject, removeEdge as removeEdgeFromProject, createNode } from '../core/project.js';
import { getComponentById } from '../data/index.js';
import { getCustomComponents } from '../io/customComponents.js';
import { buildCreationOverrides } from '../io/nodeDefaults.js';
import { el, svgEl } from '../utils/dom.js';
import { rectsIntersect } from '../core/geometry.js';
import { nextId } from '../core/id.js';
import { showToast } from '../utils/toast.js';
import * as viewport from './viewport.js';
import { createNodeEl, updateNodeEl, configureNodeHandlers } from './node.js';
import { attachNodeInteractions } from './nodeInteractions.js';
import { createEdgeEl, updateEdgeEl, configureEdgeHandlers, initConnectorDefs } from './connector.js';
import { initConnectorInteractions } from './connectorInteractions.js';
import { showContextMenu, hideContextMenu } from './contextMenu.js';

let viewportEl = null;
let contentEl = null;
let nodeLayer = null;
let edgeLayer = null;
let marqueeEl = null;

const nodeElements = new Map();
const edgeElements = new Map();

export function initCanvas(root) {
  viewportEl = root;
  viewportEl.classList.add('canvas-viewport');

  contentEl = el('div', { class: 'canvas-content' });
  edgeLayer = svgEl('svg', { class: 'edge-layer' });
  nodeLayer = el('div', { class: 'node-layer' });
  contentEl.appendChild(edgeLayer);
  contentEl.appendChild(nodeLayer);
  viewportEl.appendChild(contentEl);

  marqueeEl = el('div', { class: 'marquee', hidden: true });
  viewportEl.appendChild(marqueeEl);

  viewport.initViewport(viewportEl, contentEl);
  initConnectorDefs(edgeLayer);
  initConnectorInteractions(edgeLayer);

  configureNodeHandlers({
    onSelect: (nodeId, additive) => selectNode(nodeId, additive),
    onOpenDetails: (nodeId) => {
      window.dispatchEvent(new CustomEvent('sdb:open-details', { detail: { nodeId } }));
    },
    onContextMenu: (nodeId, evt) => openNodeContextMenu(nodeId, evt),
  });
  configureEdgeHandlers({
    onSelect: (edgeId, additive) => selectEdge(edgeId, additive),
    onContextMenu: (edgeId, evt) => openEdgeContextMenu(edgeId, evt),
  });

  wireBackgroundInteractions();
  wireWheel();

  store.subscribe('change', render);
  store.subscribe('selection', renderSelectionOnly);
  render(store.getState());
}

function wireWheel() {
  viewportEl.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0025);
        viewport.zoomAt(factor, e.clientX, e.clientY);
      } else {
        viewport.pan(-e.deltaX, -e.deltaY);
      }
    },
    { passive: false },
  );
}

function wireBackgroundInteractions() {
  viewportEl.addEventListener('pointerdown', (e) => {
    if (e.target !== viewportEl && e.target !== contentEl && e.target !== nodeLayer && e.target !== edgeLayer) return;
    // Move focus off e.g. the sidebar search box so keyboard shortcuts work
    // right after interacting with the canvas (see nodeInteractions.js beginMove).
    viewportEl.focus({ preventScroll: true });
    // On mobile the sidebar/details panel are slide-over drawers — tapping
    // the canvas is the natural "get out of the way" gesture for them.
    document.querySelector('.sidebar.open')?.classList.remove('open');
    if (e.button === 1 || e.pointerType === 'touch') {
      beginPan(e);
      return;
    }
    if (e.button !== 0) return;
    beginMarquee(e);
  });
  viewportEl.addEventListener('contextmenu', (e) => {
    if (e.target !== viewportEl && e.target !== contentEl && e.target !== nodeLayer && e.target !== edgeLayer) return;
    e.preventDefault();
    openCanvasContextMenu(e);
  });
}

function beginPan(e) {
  e.preventDefault();
  let last = { x: e.clientX, y: e.clientY };
  const onMove = (ev) => {
    viewport.pan(ev.clientX - last.x, ev.clientY - last.y);
    last = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function beginMarquee(e) {
  const startClient = { x: e.clientX, y: e.clientY };
  const startCanvas = viewport.screenToCanvas(startClient.x, startClient.y);
  let moved = false;

  const onMove = (ev) => {
    const cur = viewport.screenToCanvas(ev.clientX, ev.clientY);
    const rect = {
      x: Math.min(startCanvas.x, cur.x),
      y: Math.min(startCanvas.y, cur.y),
      w: Math.abs(cur.x - startCanvas.x),
      h: Math.abs(cur.y - startCanvas.y),
    };
    if (rect.w > 3 || rect.h > 3) moved = true;
    const vp = viewport.getViewport();
    marqueeEl.hidden = false;
    marqueeEl.style.left = `${rect.x * vp.zoom + vp.x}px`;
    marqueeEl.style.top = `${rect.y * vp.zoom + vp.y}px`;
    marqueeEl.style.width = `${rect.w * vp.zoom}px`;
    marqueeEl.style.height = `${rect.h * vp.zoom}px`;
    marqueeEl._rect = rect;
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    marqueeEl.hidden = true;
    if (moved && marqueeEl._rect) {
      const rect = marqueeEl._rect;
      const ids = store.getState().nodes.filter((n) => rectsIntersect(rect, n)).map((n) => n.id);
      store.select(ids, []);
    } else {
      store.select([], []);
    }
    marqueeEl._rect = null;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function selectNode(nodeId, additive) {
  const current = store.getSelection();
  if (additive) {
    const has = current.nodeIds.includes(nodeId);
    const nodeIds = has ? current.nodeIds.filter((id) => id !== nodeId) : [...current.nodeIds, nodeId];
    store.select(nodeIds, current.edgeIds);
  } else {
    store.select([nodeId], []);
  }
}

function selectEdge(edgeId, additive) {
  const current = store.getSelection();
  if (additive) {
    const has = current.edgeIds.includes(edgeId);
    const edgeIds = has ? current.edgeIds.filter((id) => id !== edgeId) : [...current.edgeIds, edgeId];
    store.select(current.nodeIds, edgeIds);
  } else {
    store.select([], [edgeId]);
  }
}

// ---- rendering ----

function render(state) {
  const nodeIds = new Set(state.nodes.map((n) => n.id));
  for (const [id, elRef] of nodeElements) {
    if (!nodeIds.has(id)) {
      elRef.remove();
      nodeElements.delete(id);
    }
  }
  for (const node of state.nodes) {
    let elRef = nodeElements.get(node.id);
    if (!elRef) {
      elRef = createNodeEl(node);
      attachNodeInteractions(elRef, node.id);
      nodeElements.set(node.id, elRef);
      nodeLayer.appendChild(elRef);
    }
    updateNodeEl(elRef, node, { selected: store.getSelection().nodeIds.includes(node.id) });
  }

  const edgeIds = new Set(state.edges.map((e) => e.id));
  for (const [id, elRef] of edgeElements) {
    if (!edgeIds.has(id)) {
      elRef.remove();
      edgeElements.delete(id);
    }
  }
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  for (const edge of state.edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (!fromNode || !toNode) continue;
    let elRef = edgeElements.get(edge.id);
    if (!elRef) {
      elRef = createEdgeEl(edge);
      edgeElements.set(edge.id, elRef);
      edgeLayer.appendChild(elRef);
    }
    updateEdgeEl(elRef, edge, fromNode, toNode, { selected: store.getSelection().edgeIds.includes(edge.id) });
  }
}

function renderSelectionOnly(selection) {
  for (const [id, elRef] of nodeElements) elRef.classList.toggle('selected', selection.nodeIds.includes(id));
  for (const [id, elRef] of edgeElements) elRef.classList.toggle('selected', selection.edgeIds.includes(id));
}

// ---- node/edge creation & mutation helpers ----

/** Focuses a node's DOM element so keyboard shortcuts (Delete/undo/duplicate)
 * work immediately after it's created/selected, even if focus was
 * previously stuck in e.g. the sidebar search box. */
function focusNode(nodeId) {
  nodeElements.get(nodeId)?.focus({ preventScroll: true });
}

export function focusEdge(edgeId) {
  edgeElements.get(edgeId)?.focus({ preventScroll: true });
}

/** Looks up a component definition by id across both the built-in library and the user's custom "My Components". */
export function resolveComponentDef(defId) {
  return getComponentById(defId) || getCustomComponents().find((c) => c.id === defId) || null;
}

export function createNodeFromDrop(defId, clientX, clientY) {
  const def = resolveComponentDef(defId);
  if (!def) return;
  const canvasPoint = viewport.screenToCanvas(clientX, clientY);
  const state = store.getState();
  const node = createNode(def, canvasPoint.x - def.defaultSize.w / 2, canvasPoint.y - def.defaultSize.h / 2, {
    zIndex: nextZIndex(state),
    ...buildCreationOverrides(),
  });
  store.dispatch((draft) => {
    draft.nodes.push(node);
  });
  store.select([node.id], []);
  focusNode(node.id);
}

export function addComponentAtCenter(defId) {
  const rect = viewportEl.getBoundingClientRect();
  createNodeFromDrop(defId, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

/** Attaches a "layer" component (see data/categories/layers.js) as a
 * sub-component of an existing node, instead of creating a standalone node. */
export function addLayerToNode(defId, nodeId) {
  const def = resolveComponentDef(defId);
  const targetExists = store.getState().nodes.some((n) => n.id === nodeId);
  if (!def || !targetExists) return;
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.subComponents.push({ id: nextId('sc'), name: def.name, icon: def.icon });
  });
  store.select([nodeId], []);
  focusNode(nodeId);
  showToast(`Added "${def.name}" to the selected component.`, 'success', 1800);
}

/** Instantiates a whole "design pattern" (see data/categories/design-patterns.js)
 * as a cluster of real nodes + connecting edges, positioned around `clientX/clientY`
 * (or the current view's center if omitted). Every generated node reuses a
 * real component/layer def for consistent styling. */
export function instantiatePattern(defId, clientX, clientY) {
  const patternDef = resolveComponentDef(defId);
  if (!patternDef?.pattern) return;
  const point = clientX != null && clientY != null
    ? viewport.screenToCanvas(clientX, clientY)
    : screenCenterCanvasPoint();

  const state = store.getState();
  let z = nextZIndex(state);
  const creationOverrides = buildCreationOverrides();
  const idByKey = new Map();
  const newNodes = patternDef.pattern.nodes.map((spec) => {
    const def = resolveComponentDef(spec.defId);
    const node = createNode(def, point.x + spec.dx - (def?.defaultSize.w ?? 160) / 2, point.y + spec.dy - (def?.defaultSize.h ?? 84) / 2, {
      zIndex: z++,
      text: spec.label || def?.name || spec.key,
      ...creationOverrides,
    });
    idByKey.set(spec.key, node.id);
    return node;
  });
  const newEdges = (patternDef.pattern.edges || [])
    .filter((edgeSpec) => idByKey.has(edgeSpec.from) && idByKey.has(edgeSpec.to))
    .map((edgeSpec) => createEdge(idByKey.get(edgeSpec.from), idByKey.get(edgeSpec.to), {
      label: edgeSpec.label || '',
      routing: edgeSpec.routing || 'orthogonal',
      dash: edgeSpec.dash || 'solid',
      startArrow: edgeSpec.startArrow || 'none',
      endArrow: edgeSpec.endArrow || 'filled',
    }));

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
  });
  store.select(newNodes.map((nd) => nd.id), []);
  showToast(`Added the "${patternDef.name}" pattern (${newNodes.length} components).`, 'success', 2400);
}

export function instantiatePatternAtCenter(defId) {
  instantiatePattern(defId, null, null);
}

export function addCustomShapeNode(shapeDef, centerPoint) {
  const state = store.getState();
  const point = centerPoint || screenCenterCanvasPoint();
  const node = createNode(shapeDef, point.x - shapeDef.defaultSize.w / 2, point.y - shapeDef.defaultSize.h / 2, {
    zIndex: nextZIndex(state),
    ...buildCreationOverrides(),
  });
  store.dispatch((draft) => {
    draft.nodes.push(node);
  });
  store.select([node.id], []);
  focusNode(node.id);
  return node;
}

function screenCenterCanvasPoint() {
  const rect = viewportEl.getBoundingClientRect();
  return viewport.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

export function deleteSelection() {
  const selection = store.getSelection();
  if (!selection.nodeIds.length && !selection.edgeIds.length) return;
  store.dispatch((draft) => {
    for (const id of selection.nodeIds) removeNodeFromProject(draft, id);
    for (const id of selection.edgeIds) removeEdgeFromProject(draft, id);
  });
  store.select([], []);
}

export function duplicateSelection() {
  const selection = store.getSelection();
  if (!selection.nodeIds.length) return;
  const state = store.getState();
  const idMap = new Map();
  const newNodes = selection.nodeIds
    .map((id) => state.nodes.find((n) => n.id === id))
    .filter(Boolean)
    .map((n) => {
      const { id: _oldId, x: _x, y: _y, ...rest } = n;
      const clone = createNode(null, n.x + 24, n.y + 24, rest);
      idMap.set(n.id, clone.id);
      return clone;
    });
  const newEdges = state.edges
    .filter((edge) => selection.nodeIds.includes(edge.from) && selection.nodeIds.includes(edge.to))
    .map((edge) => {
      const { id: _oldId, from: _from, to: _to, ...rest } = edge;
      return createEdge(idMap.get(edge.from), idMap.get(edge.to), rest);
    });

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
  });
  store.select(newNodes.map((n) => n.id), []);
  if (newNodes[0]) focusNode(newNodes[0].id);
}

function reorderZ(nodeId, toFront) {
  store.dispatch((draft) => {
    const zs = draft.nodes.map((n) => n.zIndex || 1);
    const target = toFront ? Math.max(...zs, 0) + 1 : Math.min(...zs, 1) - 1;
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.zIndex = target;
  });
}

export function getContentBounds() {
  const nodes = store.getState().nodes;
  if (!nodes.length) return null;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function fitToScreen() {
  const bounds = getContentBounds();
  if (bounds) viewport.fitToContent(bounds);
  else viewport.resetViewport();
}

// ---- context menus ----

function openNodeContextMenu(nodeId, evt) {
  const items = [
    { label: 'Open details', icon: 'ⓘ', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-details', { detail: { nodeId } })) },
    { label: 'Duplicate', icon: '⧉', onClick: () => { store.select([nodeId], []); duplicateSelection(); } },
    'separator',
    { label: 'Bring to front', icon: '⬆️', onClick: () => reorderZ(nodeId, true) },
    { label: 'Send to back', icon: '⬇️', onClick: () => reorderZ(nodeId, false) },
    'separator',
    { label: 'Delete', icon: '🗑️', danger: true, onClick: () => { store.select([nodeId], []); deleteSelection(); } },
  ];
  showContextMenu(evt.clientX, evt.clientY, items);
}

function openEdgeContextMenu(edgeId, evt) {
  const items = [
    { label: 'Delete connector', icon: '🗑️', danger: true, onClick: () => { store.select([], [edgeId]); deleteSelection(); } },
  ];
  showContextMenu(evt.clientX, evt.clientY, items);
}

function openCanvasContextMenu(evt) {
  const items = [
    { label: 'Select all', icon: '▭', onClick: () => store.select(store.getState().nodes.map((n) => n.id), []) },
    { label: 'Fit to screen', icon: '🔍', onClick: fitToScreen },
    { label: 'Reset zoom to 100%', icon: '💯', onClick: () => viewport.zoomTo(1) },
  ];
  showContextMenu(evt.clientX, evt.clientY, items);
}

window.addEventListener('blur', hideContextMenu);
