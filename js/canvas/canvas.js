// Orchestrates the canvas: mounts the DOM, renders nodes/edges from the
// store, and owns pan/zoom/marquee-selection. See docs/ARCHITECTURE.md
// "Canvas rendering".
import * as store from '../core/store.js';
import { createEdge, nextZIndex, removeNode as removeNodeFromProject, removeEdge as removeEdgeFromProject, createNode, duplicateProject } from '../core/project.js';
import { buildReplicationPair } from '../core/replication.js';
import { computeAutoLayout } from '../core/autoLayout.js';
import { layoutLifelines, distributeLifelineColumns, distributeMessages, layoutImportedSequenceDiagram, GAP as LIFELINE_GAP } from '../core/sequenceDiagram.js';
import { scaleNodes } from '../core/scaleDiagram.js';
import { getComponentById } from '../data/index.js';
import { getCustomComponents } from '../io/customComponents.js';
import { buildCreationOverrides } from '../io/nodeDefaults.js';
import { el, svgEl } from '../utils/dom.js';
import { rectsIntersect, pickBestSides, sideAnchor, computeAnchorOffset } from '../core/geometry.js';
import { nextId } from '../core/id.js';
import { showToast } from '../utils/toast.js';
import * as viewport from './viewport.js';
import { createNodeEl, updateNodeEl, configureNodeHandlers } from './node.js';
import { attachNodeInteractions } from './nodeInteractions.js';
import { createEdgeEl, updateEdgeEl, configureEdgeHandlers, initConnectorDefs } from './connector.js';
import { initConnectorInteractions } from './connectorInteractions.js';
import { initEdgeReconnect, syncEdgeHandles } from './edgeReconnect.js';
import { showContextMenu, hideContextMenu } from './contextMenu.js';
import { getToolMode, onToolModeChange } from './toolMode.js';
import { showSuggestionsFor } from './suggestions.js';
import { computeGroupBounds } from './groupBackgrounds.js';
import { confirmAction } from '../modals/confirmModal.js';
import { promptNumber } from '../modals/promptModal.js';
import { recordComponentUsed } from '../io/recentComponents.js';

let viewportEl = null;
let contentEl = null;
let nodeLayer = null;
let edgeLayer = null;
let edgeHandleLayer = null;
let groupBgLayer = null;
let marqueeEl = null;

const nodeElements = new Map();
const edgeElements = new Map();
const groupBgElements = new Map();
// Session-only opt-out ("✕" on a group's own background) — a group that
// dissolves (drops below 2 members) naturally falls out of
// computeGroupBounds() and is cleaned up in render() below regardless of
// whether it's in this set, so this never leaks stale entries.
const hiddenGroupBackgrounds = new Set();

export function initCanvas(root) {
  viewportEl = root;
  viewportEl.classList.add('canvas-viewport');

  contentEl = el('div', { class: 'canvas-content' });
  groupBgLayer = el('div', { class: 'group-bg-layer' });
  edgeLayer = svgEl('svg', { class: 'edge-layer' });
  nodeLayer = el('div', { class: 'node-layer' });
  edgeHandleLayer = svgEl('svg', { class: 'edge-handle-layer' });
  contentEl.appendChild(groupBgLayer);
  contentEl.appendChild(edgeLayer);
  contentEl.appendChild(nodeLayer);
  // Stacked after .node-layer so a selected edge's reconnect handles always
  // win the pointer hit-test even where they visually coincide with a
  // node's own connection-point strip — see edgeReconnect.js's header
  // comment for why this can't just live inside .edge-layer.
  contentEl.appendChild(edgeHandleLayer);
  viewportEl.appendChild(contentEl);

  marqueeEl = el('div', { class: 'marquee', hidden: true });
  viewportEl.appendChild(marqueeEl);

  viewport.initViewport(viewportEl, contentEl);
  initConnectorDefs(edgeLayer);
  initConnectorInteractions(edgeLayer);
  initEdgeReconnect(edgeHandleLayer);

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

  onToolModeChange((tool) => viewportEl.classList.toggle('tool-hand', tool === 'hand'));
  viewportEl.classList.toggle('tool-hand', getToolMode() === 'hand');

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
  // Registered with `capture: true` so that while the Hand tool is active
  // this runs *before* a pointerdown over a node/edge reaches their own
  // (bubble-phase) handlers — stopPropagation() there then keeps it from
  // ever starting a node drag/resize or connector draw, letting a Hand-tool
  // drag pan the canvas no matter what it starts on top of. When the Hand
  // tool is off this branch is skipped entirely, so nothing here changes
  // for the default Select tool.
  viewportEl.addEventListener('pointerdown', (e) => {
    if (getToolMode() === 'hand' && (e.button === 0 || e.pointerType === 'touch')) {
      e.stopPropagation();
      viewportEl.focus({ preventScroll: true });
      document.querySelector('.sidebar.open')?.classList.remove('open');
      beginPan(e);
      return;
    }
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
  }, { capture: true });
  viewportEl.addEventListener('contextmenu', (e) => {
    if (e.target !== viewportEl && e.target !== contentEl && e.target !== nodeLayer && e.target !== edgeLayer) return;
    e.preventDefault();
    openCanvasContextMenu(e);
  });
}

function beginPan(e) {
  e.preventDefault();
  viewportEl.classList.add('is-panning');
  // Redirects this pointer's subsequent events to viewportEl regardless of
  // where the finger/cursor actually moves — without it, a fast touch-drag
  // that leaves #canvas-viewport's bounds can have its gesture cancelled by
  // the browser mid-pan (a `pointercancel`, silently dropping the rest of
  // the drag) instead of continuing to deliver pointermove here.
  viewportEl.setPointerCapture?.(e.pointerId);
  let last = { x: e.clientX, y: e.clientY };
  const onMove = (ev) => {
    viewport.pan(ev.clientX - last.x, ev.clientY - last.y);
    last = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    viewportEl.classList.remove('is-panning');
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
      const state = store.getState();
      const ids = state.nodes.filter((n) => rectsIntersect(rect, n)).map((n) => n.id);
      const idSet = new Set(ids);
      // Also pick up connectors whose both ends are inside the marquee, so a
      // drag-select naturally grabs a cluster's internal wiring too.
      const edgeIds = state.edges.filter((e) => idSet.has(e.from) && idSet.has(e.to)).map((e) => e.id);
      store.select(ids, edgeIds);
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
    return;
  }
  // Clicking any member of a group selects the whole group, so moving or
  // editing one grouped node naturally acts on all of them together.
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  const nodeIds = node?.groupId
    ? store.getState().nodes.filter((n) => n.groupId === node.groupId).map((n) => n.id)
    : [nodeId];
  store.select(nodeIds, []);
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
  const replicatedGroupIds = new Set();
  const frozenGroupIds = new Set();
  for (const p of state.replicationPairs) {
    replicatedGroupIds.add(p.groupA);
    replicatedGroupIds.add(p.groupB);
    if (p.frozen) { frozenGroupIds.add(p.groupA); frozenGroupIds.add(p.groupB); }
  }
  renderGroupBackgrounds(state.nodes, replicatedGroupIds);
  for (const node of state.nodes) {
    let elRef = nodeElements.get(node.id);
    if (!elRef) {
      elRef = createNodeEl(node);
      attachNodeInteractions(elRef, node.id);
      nodeElements.set(node.id, elRef);
      nodeLayer.appendChild(elRef);
    }
    updateNodeEl(elRef, node, {
      selected: store.getSelection().nodeIds.includes(node.id),
      replicated: !!node.groupId && replicatedGroupIds.has(node.groupId),
      replicationFrozen: !!node.groupId && frozenGroupIds.has(node.groupId),
    });
  }

  const edgeIds = new Set(state.edges.map((e) => e.id));
  for (const [id, elRef] of edgeElements) {
    if (!edgeIds.has(id)) {
      elRef.remove();
      edgeElements.delete(id);
    }
  }
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const sequenceNumbers = computeMessageSequenceNumbers(state.edges, nodesById);
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
    updateEdgeEl(elRef, edge, fromNode, toNode, {
      selected: store.getSelection().edgeIds.includes(edge.id),
      allNodes: state.nodes,
      sequenceNumber: sequenceNumbers.get(edge.id) ?? null,
    });
  }
  syncEdgeHandles(state, store.getSelection());
}

/** Auto-numbers "messages" — edges between two lifeline nodes — in
 * top-to-bottom order (their vertical anchor position, i.e. when in the
 * flow they happen), purely for display: nothing is persisted, so it can
 * never go stale and is naturally correct after undo/redo, adding a new
 * message, or deleting one. Every other edge (ordinary component
 * connectors) gets no number at all.
 *
 * The one deliberate exception: an edge with `sequenceNumberOverride` set
 * (right-click a message -> "Set sequence number...") shows that value
 * instead of its computed position — a genuinely persisted field, unlike
 * everything else here, for the rare case the auto order doesn't match
 * intent. Doesn't renumber its neighbors to keep the sequence gap-free;
 * the user is choosing to state a specific number, not reflow the rest. */
export function computeMessageSequenceNumbers(edges, nodesById) {
  const messages = [];
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (fromNode?.shape !== 'lifeline' || toNode?.shape !== 'lifeline') continue;
    const y = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5).y;
    messages.push({ id: edge.id, y, override: edge.sequenceNumberOverride });
  }
  messages.sort((a, b) => a.y - b.y);
  return new Map(messages.map((m, i) => [m.id, m.override ?? i + 1]));
}

/** Right-click a message -> "Set sequence number...": prompts for a
 * positive integer and stores it as that edge's override (see
 * computeMessageSequenceNumbers above). null clears it (context menu's
 * "Clear sequence number override" calls this directly with null). */
export function setSequenceNumberOverride(edgeId, value) {
  store.dispatch((draft) => {
    const edge = draft.edges.find((e) => e.id === edgeId);
    if (edge) edge.sequenceNumberOverride = value;
  });
}

/** One subtle bounding box behind every multi-member group — a regular
 * Group/Ungroup group and a replication pair's side are both just nodes
 * sharing a `groupId`, so this renders identically for either, with only
 * the label/color telling them apart. `pointer-events: none` on the box
 * itself (see css/canvas.css) keeps it from intercepting clicks meant for
 * a node or the canvas background underneath; only its own "✕" dismiss
 * control opts back in. Dismissing is session-only (not saved with the
 * project) — the group itself is untouched, just its background. */
function renderGroupBackgrounds(nodes, replicatedGroupIds) {
  const bounds = computeGroupBounds(nodes, replicatedGroupIds).filter((b) => !hiddenGroupBackgrounds.has(b.groupId));
  const seqGroupIds = new Set(getSequenceDiagramGroups().map((g) => g.groupId));
  const seen = new Set();
  for (const b of bounds) {
    seen.add(b.groupId);
    let elRef = groupBgElements.get(b.groupId);
    if (!elRef) {
      elRef = el('div', { class: 'group-bg' });
      elRef.appendChild(el('span', { class: 'group-bg-label' }));
      elRef.appendChild(el('button', {
        type: 'button', class: 'group-bg-zoom', text: '🔍', title: 'View this sequence diagram zoomed in',
        onClick: (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('sdb:open-subdiagram', { detail: { groupId: b.groupId } })); },
      }));
      elRef.appendChild(el('button', {
        type: 'button', class: 'group-bg-dismiss', text: '✕', title: 'Hide this group\'s background (the group itself is unaffected)',
        onClick: () => { hiddenGroupBackgrounds.add(b.groupId); render(store.getState()); },
      }));
      groupBgElements.set(b.groupId, elRef);
      groupBgLayer.appendChild(elRef);
    }
    // A group only qualifies for the zoom-in/drill-down view while every one
    // of its members is a lifeline (see getSequenceDiagramGroups) — hidden
    // rather than removed so the toggle is instant if that ever flips.
    elRef.querySelector('.group-bg-zoom').hidden = !seqGroupIds.has(b.groupId);
    const isReplicated = replicatedGroupIds.has(b.groupId);
    elRef.classList.toggle('group-bg-replicated', isReplicated);
    // A replication side is commonly just 1 component (the mirror is on
    // the *other* side's own box, not this one) — "🔁 1 replicated" would
    // read oddly, so drop the count in that case; a regular group is
    // never rendered below 2 members (see computeGroupBounds), so it
    // always has one to show.
    elRef.querySelector('.group-bg-label').textContent = isReplicated
      ? (b.count === 1 ? '🔁 Replicated' : `🔁 ${b.count} replicated`)
      : `${b.count} grouped`;
    elRef.style.left = `${b.x}px`;
    elRef.style.top = `${b.y}px`;
    elRef.style.width = `${b.w}px`;
    elRef.style.height = `${b.h}px`;
  }
  for (const [groupId, elRef] of groupBgElements) {
    if (!seen.has(groupId)) {
      elRef.remove();
      groupBgElements.delete(groupId);
      hiddenGroupBackgrounds.delete(groupId);
    }
  }
}

function renderSelectionOnly(selection) {
  for (const [id, elRef] of nodeElements) elRef.classList.toggle('selected', selection.nodeIds.includes(id));
  for (const [id, elRef] of edgeElements) elRef.classList.toggle('selected', selection.edgeIds.includes(id));
  syncEdgeHandles(store.getState(), selection);
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

/** Screen-space (getBoundingClientRect) union bounding box of every
 * currently-selected node/edge's DOM element — used by the toolbar's
 * "floating" contextual style row (toolbar.js) to anchor itself next to
 * whatever's selected instead of pinning to the top/bottom of the screen.
 * Returns null if nothing in the selection has a live element (nothing
 * selected, or ids referencing since-deleted items). */
export function getSelectionScreenRect(nodeIds, edgeIds) {
  const rects = [];
  for (const id of nodeIds) {
    const elRef = nodeElements.get(id);
    if (elRef) rects.push(elRef.getBoundingClientRect());
  }
  for (const id of edgeIds) {
    const elRef = edgeElements.get(id);
    if (elRef) rects.push(elRef.getBoundingClientRect());
  }
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** Looks up a component definition by id across both the built-in library and the user's custom "My Components". */
export function resolveComponentDef(defId) {
  return getComponentById(defId) || getCustomComponents().find((c) => c.id === defId) || null;
}

/** Nudges `(x, y)` diagonally in fixed 24px steps (same cascade offset
 * `duplicateSelection` already uses) while a same-sized box centered there
 * would cover an existing node's own center point. Every repeat click of
 * the same sidebar item or "Add Shape" card (or a same-point drag-drop)
 * would otherwise land the new node in *exactly* the same spot as the last
 * one — and since the new node always gets the higher zIndex, its box then
 * sits directly over the older node's own center, the exact point a plain
 * click targets, making that older node permanently unreachable by a
 * normal click (higher zIndex always wins, and nothing else in the UI
 * moves a freshly-created node out of the way) — see
 * docs/ARCHITECTURE.md's "Contextual style-editor row" for why this became
 * reachable: 'floating' mode no longer resizes #canvas-viewport the way
 * pinned-top incidentally did, so the click-to-add center point stopped
 * shifting between clicks. A small partial overlap elsewhere is fine (real
 * diagrams often place components close together) — this only cares about
 * covering the *center* of an older node, which is what actually blocks a
 * plain click on it. Used by both `createNodeFromDrop` (sidebar click-add
 * and drag-drop) and `addCustomShapeNode` (the "Add Shape" modal), the two
 * entry points that default to the canvas's exact current center. */
function findClearCenter(x, y, w, h, existingNodes) {
  const STEP = 24;
  let cx = x;
  let cy = y;
  for (let i = 0; i < 50; i += 1) {
    const left = cx - w / 2;
    const top = cy - h / 2;
    const covers = existingNodes.some((n) => {
      const ncx = n.x + n.w / 2;
      const ncy = n.y + n.h / 2;
      return ncx > left && ncx < left + w && ncy > top && ncy < top + h;
    });
    if (!covers) break;
    cx += STEP;
    cy += STEP;
  }
  return { x: cx, y: cy };
}

export function createNodeFromDrop(defId, clientX, clientY) {
  const def = resolveComponentDef(defId);
  if (!def) return;
  const state = store.getState();
  const rawPoint = viewport.screenToCanvas(clientX, clientY);
  const canvasPoint = findClearCenter(rawPoint.x, rawPoint.y, def.defaultSize.w, def.defaultSize.h, state.nodes);
  const node = createNode(def, canvasPoint.x - def.defaultSize.w / 2, canvasPoint.y - def.defaultSize.h / 2, {
    zIndex: nextZIndex(state),
    ...buildCreationOverrides(),
  });
  store.dispatch((draft) => {
    draft.nodes.push(node);
  });
  store.select([node.id], []);
  focusNode(node.id);
  recordComponentUsed(defId);
  showSuggestionsFor(def, node, {
    onAddComponent: (relDefId, offsetIndex) => addRelatedComponent(relDefId, node.id, offsetIndex),
    onAddLayer: (layerDefId) => addLayerToNode(layerDefId, node.id),
    onAddPattern: (patternDefId) => instantiatePatternNearNode(patternDefId, node.id),
  });
}

export function addComponentAtCenter(defId) {
  const rect = viewportEl.getBoundingClientRect();
  createNodeFromDrop(defId, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

/** Places a "Smart Suggestions" companion component (see
 * canvas/suggestions.js) beside the node that prompted it — guessing "to
 * the right", stacked vertically if more than one suggestion is accepted
 * from the same banner, then nudged by `findClearCenter` (the same
 * anti-overlap search click-to-add already uses) if that guess would land
 * on top of an existing node, so a crowded area doesn't stack a suggestion
 * onto something unrelated. Also creates the connecting edge from the
 * anchor to the new node — a curated companion is only ever suggested
 * *because* the two are typically connected, so the pre-suggestions
 * behavior of leaving them unconnected was a real gap — with anchor sides
 * picked from actual relative position (`pickBestSides`), not a hardcoded
 * side, so the edge still looks right however the placement above landed. */
function addRelatedComponent(defId, anchorNodeId, offsetIndex) {
  const def = resolveComponentDef(defId);
  if (!def) return;
  const state = store.getState();
  const anchor = state.nodes.find((n) => n.id === anchorNodeId);
  const w = def.defaultSize.w;
  const h = def.defaultSize.h;
  const guess = anchor
    ? { x: anchor.x + anchor.w + 60 + w / 2, y: anchor.y + h / 2 + offsetIndex * (h + 24) }
    : screenCenterCanvasPoint();
  const center = findClearCenter(guess.x, guess.y, w, h, state.nodes);
  const point = { x: center.x - w / 2, y: center.y - h / 2 };
  const node = createNode(def, point.x, point.y, {
    zIndex: nextZIndex(state),
    ...buildCreationOverrides(),
  });

  const newEdges = [];
  if (anchor) {
    const sides = pickBestSides(anchor, { x: point.x, y: point.y, w, h });
    newEdges.push(createEdge(anchorNodeId, node.id, sides));
  }

  store.dispatch((draft) => {
    draft.nodes.push(node);
    draft.edges.push(...newEdges);
  });
  store.select([node.id], []);
  focusNode(node.id);
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
  const point = clientX != null && clientY != null
    ? viewport.screenToCanvas(clientX, clientY)
    : screenCenterCanvasPoint();
  instantiatePatternAtPoint(defId, point);
}

/** Core of instantiatePattern, taking an already-canvas-space center point
 * instead of screen coordinates — shared by instantiatePattern (drop/click,
 * screen-space) and instantiatePatternNearNode (Smart Suggestions "Add this
 * sequence diagram" button, canvas-space relative to an existing node). */
function instantiatePatternAtPoint(defId, point) {
  const patternDef = resolveComponentDef(defId);
  if (!patternDef?.pattern) return;

  const state = store.getState();
  let z = nextZIndex(state);
  const creationOverrides = buildCreationOverrides();
  const idByKey = new Map();
  // `spec.overrides`/`edgeSpec.overrides` (see buildGroupSnapshotFromSelection
  // below) carries a full per-node/per-edge style snapshot for custom
  // components saved from a real selection — absent for hand-authored
  // built-in patterns (data/categories/*.js), which only ever set
  // defId/dx/dy/label and rely on the def's own styling, unchanged from before.
  const newNodes = patternDef.pattern.nodes.map((spec) => {
    const def = resolveComponentDef(spec.defId);
    const w = spec.overrides?.w ?? def?.defaultSize.w ?? 160;
    const h = spec.overrides?.h ?? def?.defaultSize.h ?? 84;
    const node = createNode(def, point.x + spec.dx - w / 2, point.y + spec.dy - h / 2, {
      zIndex: z++,
      text: spec.label || def?.name || spec.key,
      ...creationOverrides,
      ...(spec.overrides || {}),
    });
    idByKey.set(spec.key, node.id);
    return node;
  });
  // Saved multi-component custom components (groupOnInstantiate) come back
  // as one movable unit, same as an explicit Group — see groupSelection().
  if (patternDef.groupOnInstantiate && newNodes.length > 1) {
    const groupId = nextId('group');
    for (const n of newNodes) n.groupId = groupId;
  }
  const newEdges = (patternDef.pattern.edges || [])
    .filter((edgeSpec) => idByKey.has(edgeSpec.from) && idByKey.has(edgeSpec.to))
    .map((edgeSpec) => createEdge(idByKey.get(edgeSpec.from), idByKey.get(edgeSpec.to), edgeSpec.overrides || {
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

/** Smart Suggestions' "Add this sequence diagram" row (canvas/suggestions.js)
 * and dragging a pattern sidebar item onto a node (sidebar/dragSource.js) —
 * instantiates a pattern positioned just to the right of `nodeId` instead of
 * the screen center, so it lands visibly next to (never overlapping) the
 * component that suggested/received it rather than wherever the viewport
 * happens to be centered. */
export function instantiatePatternNearNode(defId, nodeId) {
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  const patternDef = resolveComponentDef(defId);
  if (!node || !patternDef?.pattern) { instantiatePatternAtCenter(defId); return; }
  const MARGIN = 60;
  // The pattern's own nodes are placed at `center.x + spec.dx - w/2`
  // (instantiatePatternAtPoint below) — so its leftmost real edge relative
  // to its own center point is however far left of dx=0 its own left-most
  // node's own left edge reaches, not just its dx=0 origin. Clearing that
  // (rather than a flat guess) is what actually guarantees no overlap
  // regardless of which template this is or how many lifelines it has.
  const leftmostEdge = Math.min(...patternDef.pattern.nodes.map((spec) => {
    const def = resolveComponentDef(spec.defId);
    const w = spec.overrides?.w ?? def?.defaultSize.w ?? 160;
    return spec.dx - w / 2;
  }));
  instantiatePatternAtPoint(defId, { x: node.x + node.w + MARGIN - leftmostEdge, y: node.y + node.h / 2 });
}

/** Creates a fresh set of titled "lifeline" nodes for a sequence/
 * communication-flow diagram (see modals/sequenceDiagramModal.js) — evenly
 * spaced, centered on the current view. Only the lifelines themselves are
 * created here; messages between them are drawn afterward with the
 * ordinary node-to-node connect gesture (now offset-aware specifically so
 * several messages can land on the same lifeline at different heights —
 * see connectorInteractions.js and core/geometry.js#sideAnchor). */
export function createSequenceDiagram(names) {
  const def = resolveComponentDef('shape-lifeline');
  if (!def || !names.length) return;
  const point = screenCenterCanvasPoint();
  const state = store.getState();
  let z = nextZIndex(state);
  const layout = layoutLifelines(names, point.x, point.y - def.defaultSize.h / 2, def.defaultSize);
  const newNodes = layout.map((spec) => createNode(def, spec.x, spec.y, { zIndex: z++, text: spec.text }));

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
  });
  store.select(newNodes.map((n) => n.id), []);
  showToast(`Created a sequence diagram with ${newNodes.length} lifelines — drag between two lifelines to draw a message.`, 'success', 3200);
}

const FRAGMENT_DEF_ID = { alt: 'shape-fragment-alt', opt: 'shape-fragment-opt', loop: 'shape-fragment-loop', par: 'shape-fragment-par' };

/** Turns parsed Mermaid `sequenceDiagram` text (io/importSequenceMermaid.js)
 * into a real, grouped sequence diagram — lifelines, messages, activation
 * bars, destroy markers, and alt/opt/loop/par fragment boxes — the inverse
 * of "📋 Copy as Mermaid" (io/exportSequenceMermaid.js). Returns the number
 * of lifelines created, or 0 if `parsed` was empty/invalid, so the caller
 * (modals/importSequenceMermaidModal.js) can show an error instead of a
 * silent no-op. */
export function createSequenceDiagramFromMermaid(parsed) {
  if (!parsed?.participants?.length) return 0;
  const def = resolveComponentDef('shape-lifeline');
  if (!def) return 0;
  const point = screenCenterCanvasPoint();
  const state = store.getState();
  let z = nextZIndex(state);

  const layout = layoutImportedSequenceDiagram(parsed, point.x, point.y - def.defaultSize.h / 2, def.defaultSize);
  const groupId = layout.lifelines.length > 1 ? nextId('group') : null;
  const newNodes = layout.lifelines.map((spec, i) => createNode(def, spec.x, spec.y, {
    zIndex: z++,
    text: spec.text,
    groupId,
    activations: layout.activations[i],
    destroyOffset: layout.destroys[i],
  }));
  const idByParticipantId = new Map(parsed.participants.map((p, i) => [p.id, newNodes[i].id]));

  const newEdges = layout.edges
    .filter((e) => idByParticipantId.has(e.fromId) && idByParticipantId.has(e.toId))
    .map((e) => createEdge(idByParticipantId.get(e.fromId), idByParticipantId.get(e.toId), e.overrides));

  const fragmentNodes = layout.fragments
    .map((f) => {
      const fdef = resolveComponentDef(FRAGMENT_DEF_ID[f.type]);
      return fdef ? createNode(fdef, f.x, f.y, { zIndex: z++, text: f.label, w: f.w, h: f.h }) : null;
    })
    .filter(Boolean);

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes, ...fragmentNodes);
    draft.edges.push(...newEdges);
  });
  store.select(newNodes.map((n) => n.id), []);
  showToast(`Imported a sequence diagram with ${newNodes.length} lifelines and ${newEdges.length} messages.`, 'success', 3200);
  return newNodes.length;
}

/** Quick "add one more participant" for an existing sequence diagram (right-
 * click a lifeline → "➕ Add lifeline to the right") — faster than re-running
 * the wizard or dragging a fresh one in from Add Shape when you just need
 * one more. Lines up with the wizard's own spacing (`LIFELINE_GAP`),
 * nudging further right if that spot is already occupied by another
 * lifeline (e.g. clicking this twice in a row on the same source without
 * moving anything in between). */
export function addLifelineToRight(nodeId) {
  const state = store.getState();
  const source = state.nodes.find((n) => n.id === nodeId);
  if (!source || source.shape !== 'lifeline') return;
  const def = resolveComponentDef('shape-lifeline');
  if (!def) return;

  let x = source.x + LIFELINE_GAP;
  while (state.nodes.some((n) => n.shape === 'lifeline' && Math.abs(n.x - x) < 40)) x += LIFELINE_GAP;

  const existingNames = new Set(state.nodes.map((n) => n.text));
  let text = 'New Participant';
  let i = 1;
  while (existingNames.has(text)) { i += 1; text = `New Participant ${i}`; }

  const node = createNode(def, x, source.y, { text, zIndex: nextZIndex(state) });
  store.dispatch((draft) => { draft.nodes.push(node); });
  store.select([node.id], []);
  focusNode(node.id);
}

/** Right-click on a lifeline -> "Mark destroyed here" (UML destroy marker):
 * computes destroyOffset from the actual click height via the same
 * point->offset inverse (`computeAnchorOffset`) a dragged connector uses,
 * so the X lands exactly where the user clicked rather than a fixed spot. */
export function setLifelineDestroyOffset(nodeId, evt) {
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  if (!node || node.shape !== 'lifeline') return;
  const point = viewport.screenToCanvas(evt.clientX, evt.clientY);
  const offset = computeAnchorOffset({ x: node.x, y: node.y, w: node.w, h: node.h }, 'left', point);
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.destroyOffset = offset;
  });
}

export function clearLifelineDestroyOffset(nodeId) {
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.destroyOffset = null;
  });
}

// UML activation bar (execution occurrence) width, split evenly around the
// click point that spawned it — see addActivationBar below.
const ACTIVATION_SPAN = 0.12;

/** Right-click on a lifeline -> "Add activation bar": drops a default-length
 * span centered on the click height (same computeAnchorOffset inverse as
 * the destroy marker), which the user then drags to move/resize — see
 * nodeInteractions.js#beginActivationMove/beginActivationResize. */
export function addActivationBar(nodeId, evt) {
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  if (!node || node.shape !== 'lifeline') return;
  const point = viewport.screenToCanvas(evt.clientX, evt.clientY);
  const center = computeAnchorOffset({ x: node.x, y: node.y, w: node.w, h: node.h }, 'left', point);
  let startOffset = center - ACTIVATION_SPAN / 2;
  let endOffset = center + ACTIVATION_SPAN / 2;
  if (startOffset < 0) { endOffset -= startOffset; startOffset = 0; }
  if (endOffset > 1) { startOffset -= endOffset - 1; endOffset = 1; }
  startOffset = Math.max(0, startOffset);
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.activations.push({ id: nextId('act'), startOffset, endOffset });
  });
}

export function removeActivationBar(nodeId, activationId) {
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.activations = n.activations.filter((a) => a.id !== activationId);
  });
}

export function addCustomShapeNode(shapeDef, centerPoint) {
  const state = store.getState();
  const rawPoint = centerPoint || screenCenterCanvasPoint();
  // Same stacking risk as createNodeFromDrop's click-to-add path (see its
  // own comment on findClearCenter) — the "Add Shape" modal also always
  // targets the canvas center, so picking the same shape twice in a row
  // would otherwise land both nodes in the exact same spot.
  const point = findClearCenter(rawPoint.x, rawPoint.y, shapeDef.defaultSize.w, shapeDef.defaultSize.h, state.nodes);
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
  if (!selection.nodeIds.length && !selection.edgeIds.length) return;
  const state = store.getState();
  const idMap = new Map();
  const groupIdMap = new Map();
  const newNodes = selection.nodeIds
    .map((id) => state.nodes.find((n) => n.id === id))
    .filter(Boolean)
    .map((n) => {
      const { id: _oldId, x: _x, y: _y, groupId: oldGroupId, ...rest } = n;
      let newGroupId = null;
      if (oldGroupId) {
        if (!groupIdMap.has(oldGroupId)) groupIdMap.set(oldGroupId, nextId('group'));
        newGroupId = groupIdMap.get(oldGroupId);
      }
      const clone = createNode(null, n.x + 24, n.y + 24, { ...rest, groupId: newGroupId });
      idMap.set(n.id, clone.id);
      return clone;
    });

  // Duplicate both edges internal to the duplicated nodes AND any edge the
  // user explicitly selected directly (even if only one/neither endpoint
  // was itself duplicated — that just reconnects to the original node).
  const internalEdges = state.edges.filter((edge) => selection.nodeIds.includes(edge.from) && selection.nodeIds.includes(edge.to));
  const selectedEdges = state.edges.filter((edge) => selection.edgeIds.includes(edge.id));
  const edgesToClone = [...new Map([...internalEdges, ...selectedEdges].map((e) => [e.id, e])).values()];
  const newEdges = edgesToClone.map((edge) => {
    const { id: _oldId, from, to, ...rest } = edge;
    return createEdge(idMap.get(from) || from, idMap.get(to) || to, rest);
  });

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
  });
  store.select(newNodes.map((n) => n.id), newEdges.map((e) => e.id));
  if (newNodes[0]) focusNode(newNodes[0].id);
  else if (newEdges[0]) focusEdge(newEdges[0].id);
}

/** Builds a saveable snapshot of the current selection's nodes (+ their
 * internal/selected connectors), as a `{key, defId, dx, dy, overrides}`
 * pattern spec (see instantiatePattern) — every per-node style field
 * (fill, stroke, size, subComponents, textPosition, etc.) is captured in
 * `overrides` so the saved custom component reproduces the selection
 * exactly, not just a defId-referencing blueprint like a built-in pattern.
 * Positions are stored relative to the selection's bounding-box center so
 * the saved component drops in centered wherever the user places it.
 * Returns null if nothing is selected. */
export function buildGroupSnapshotFromSelection() {
  const selection = store.getSelection();
  if (!selection.nodeIds.length) return null;
  const state = store.getState();
  const nodes = selection.nodeIds.map((id) => state.nodes.find((n) => n.id === id)).filter(Boolean);
  if (!nodes.length) return null;

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const keyById = new Map();
  const patternNodes = nodes.map((n, idx) => {
    const key = `n${idx}`;
    keyById.set(n.id, key);
    const { id: _id, x, y, zIndex: _zIndex, groupId: _groupId, defId: _defId, ...overrides } = n;
    return { key, defId: n.defId || null, dx: x + n.w / 2 - centerX, dy: y + n.h / 2 - centerY, overrides };
  });

  const internalEdges = state.edges.filter((e) => keyById.has(e.from) && keyById.has(e.to));
  const selectedEdges = state.edges.filter((e) => selection.edgeIds.includes(e.id) && keyById.has(e.from) && keyById.has(e.to));
  const edgesToSave = [...new Map([...internalEdges, ...selectedEdges].map((e) => [e.id, e])).values()];
  const patternEdges = edgesToSave.map((e) => {
    const { id: _id, from, to, ...overrides } = e;
    return { from: keyById.get(from), to: keyById.get(to), overrides };
  });

  return { nodeCount: nodes.length, pattern: { nodes: patternNodes, edges: patternEdges } };
}

/** Duplicates every node and connector currently on the canvas, offset in
 * place — the whole diagram, doubled, still in the same project. */
export function duplicateEntireCanvas() {
  const state = store.getState();
  if (!state.nodes.length && !state.edges.length) return;
  store.select(state.nodes.map((n) => n.id), state.edges.map((e) => e.id));
  duplicateSelection();
}

/** Clones the whole project (see core/project.js#duplicateProject) and
 * switches the active canvas to the copy — the original stays exactly as
 * it was (autosaved/saved separately under its own id), unaffected. */
export function duplicateProjectAsNew() {
  const copy = duplicateProject(store.getState());
  store.loadProject(copy);
  showToast(`Duplicated into a new project — now editing "${copy.name}".`, 'success', 2400);
}

/** Empties every component, connector and replication pair from the
 * *current* project (same id/name — unlike toolbar.js's "New", which
 * switches to a brand-new project entity and is right to reset history
 * along with it). Deliberately goes through `store.dispatch()` rather than
 * `store.loadProject()`: the latter calls `history.init()`, which wipes
 * undo/redo entirely — fine for switching to an unrelated new project, but
 * it would make an "Undo brings it back" promise a lie for clearing the
 * *same* project's content. A plain dispatch is committed to history like
 * any other edit, so Ctrl/Cmd+Z genuinely restores everything afterward. */
export async function clearCanvas() {
  const state = store.getState();
  if (!state.nodes.length && !state.edges.length && !state.replicationPairs.length) {
    showToast('The canvas is already empty.', 'info', 1800);
    return;
  }
  const ok = await confirmAction({
    title: 'Clear the canvas?',
    message: 'Deletes every component and connector on the canvas and starts fresh. Undo (Ctrl/Cmd+Z) brings it all back.',
    confirmLabel: 'Clear canvas',
    danger: true,
  });
  if (!ok) return;
  store.dispatch((draft) => {
    draft.nodes = [];
    draft.edges = [];
    draft.replicationPairs = [];
  });
  store.select([], []);
  showToast('Canvas cleared.', 'success', 1800);
}

/** Ties 2+ selected nodes together so clicking or dragging any one of them
 * acts on the whole set — see selectNode(). */
export function groupSelection() {
  const selection = store.getSelection();
  if (selection.nodeIds.length < 2) return;
  const groupId = nextId('group');
  store.dispatch((draft) => {
    for (const id of selection.nodeIds) {
      const n = draft.nodes.find((x) => x.id === id);
      if (n) n.groupId = groupId;
    }
  });
  showToast(`Grouped ${selection.nodeIds.length} components.`, 'success', 1800);
}

export function ungroupSelection() {
  const selection = store.getSelection();
  if (!selection.nodeIds.length) return;
  store.dispatch((draft) => {
    for (const id of selection.nodeIds) {
      const n = draft.nodes.find((x) => x.id === id);
      if (n) n.groupId = null;
    }
  });
  showToast('Ungrouped.', 'success', 1800);
}

/** Whether the current selection includes at least one grouped node (so an "Ungroup" action makes sense). */
export function selectionHasGroup() {
  const state = store.getState();
  return store.getSelection().nodeIds.some((id) => state.nodes.find((n) => n.id === id)?.groupId);
}

function isGroupInAnyPair(state, groupId) {
  return !!groupId && state.replicationPairs.some((p) => p.groupA === groupId || p.groupB === groupId);
}

/** Turns the current selection into a brand-new live replication pair: side
 * A is the selection (grouped if it wasn't already), side B is an
 * auto-generated mirror placed to the right — see core/replication.js. */
export function createReplicationPairFromSelection(mode) {
  const selection = store.getSelection();
  if (!selection.nodeIds.length) return;
  const state = store.getState();

  const conflict = selection.nodeIds.some((id) => {
    const n = state.nodes.find((x) => x.id === id);
    return n && isGroupInAnyPair(state, n.groupId);
  });
  if (conflict) {
    showToast('One or more selected components already belong to a replication pair — break that pair first, or use "Add to Replication" instead.', 'error', 3200);
    return;
  }

  const built = buildReplicationPair(state.nodes, selection.nodeIds, mode, state.edges);
  if (!built || !built.mirrorNodes.length) {
    showToast('Every selected component is excluded from replication — nothing to mirror.', 'error');
    return;
  }
  store.dispatch((draft) => {
    for (const id of built.regroupNodeIds) {
      const n = draft.nodes.find((x) => x.id === id);
      if (n) n.groupId = built.groupA;
    }
    draft.nodes.push(...built.mirrorNodes);
    draft.edges.push(...built.edgeMirrors);
    draft.replicationPairs.push(built.pair);
  });
  store.select([...selection.nodeIds, ...built.mirrorNodes.map((n) => n.id)], []);
  const edgeNote = built.edgeMirrors.length ? `, ${built.edgeMirrors.length} connector${built.edgeMirrors.length === 1 ? '' : 's'} between them` : '';
  showToast(`Created a replication pair — ${built.mirrorNodes.length} component${built.mirrorNodes.length === 1 ? '' : 's'} mirrored${edgeNote}.`, 'success', 2600);
}

/** Adds the current selection to an existing pair's side ('a'|'b') by
 * assigning that side's groupId — the next sync pass mirrors each newly
 * joined node to the other side automatically. */
export function addSelectionToReplicationSide(pairId, side) {
  const selection = store.getSelection();
  if (!selection.nodeIds.length) return;
  const state = store.getState();
  const pair = state.replicationPairs.find((p) => p.id === pairId);
  if (!pair) return;
  const targetGroupId = side === 'a' ? pair.groupA : pair.groupB;

  const conflict = selection.nodeIds.some((id) => {
    const n = state.nodes.find((x) => x.id === id);
    return n && n.groupId !== targetGroupId && isGroupInAnyPair(state, n.groupId);
  });
  if (conflict) {
    showToast('One or more selected components already belong to a different replication pair.', 'error', 3200);
    return;
  }

  const newlyJoined = selection.nodeIds.filter((id) => state.nodes.find((n) => n.id === id)?.groupId !== targetGroupId).length;
  store.dispatch((draft) => {
    for (const id of selection.nodeIds) {
      const n = draft.nodes.find((x) => x.id === id);
      if (n) n.groupId = targetGroupId;
    }
  });
  if (newlyJoined > 0) {
    showToast(`Added ${newlyJoined} component${newlyJoined === 1 ? '' : 's'} — mirroring to the other side.`, 'success', 2400);
  } else {
    showToast('Already part of that side.', 'info', 1800);
  }
}

/** Deletes a replication pair's link: both sides' nodes and their groupIds
 * are left exactly as they are, just no longer kept in sync. */
export function breakReplicationPair(pairId) {
  store.dispatch((draft) => {
    draft.replicationPairs = draft.replicationPairs.filter((p) => p.id !== pairId);
  });
  showToast('Replication pair broken — both sides are now independent.', 'success', 2200);
}

/** Freezes or resumes a pair's live sync — while frozen, either side can be
 * edited without the change reaching the other (see core/replication.js).
 * Resuming does not retroactively reconcile any drift that happened while
 * frozen; it only resumes syncing changes made from now on. */
export function setReplicationPairFrozen(pairId, frozen) {
  store.dispatch((draft) => {
    const pair = draft.replicationPairs.find((p) => p.id === pairId);
    if (pair) pair.frozen = frozen;
  });
  showToast(frozen ? 'Replication frozen — changes on either side stay local until resumed.' : 'Replication resumed — changes will mirror again.', 'success', 2400);
}

export function getReplicationPairs() {
  return store.getState().replicationPairs;
}

/** Returns `{ pair, side: 'a'|'b' }` if `nodeId`'s groupId currently belongs
 * to an active replication pair's side, else null. */
export function getReplicationInfoForNode(nodeId) {
  const state = store.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node || !node.groupId) return null;
  for (const pair of state.replicationPairs) {
    if (pair.groupA === node.groupId) return { pair, side: 'a' };
    if (pair.groupB === node.groupId) return { pair, side: 'b' };
  }
  return null;
}

function reorderZ(nodeId, toFront) {
  store.dispatch((draft) => {
    const zs = draft.nodes.map((n) => n.zIndex || 1);
    const target = toFront ? Math.max(...zs, 0) + 1 : Math.min(...zs, 1) - 1;
    const n = draft.nodes.find((x) => x.id === nodeId);
    if (n) n.zIndex = target;
  });
}

/** Node x/y/w/h alone understates a diagram's real extent: obstacle-avoiding
 * edge routing can jut out past every node's own bounding box while
 * detouring around a cluster, and `textPosition: 'above'/'below'` labels
 * render entirely outside .node-body by design (see node.js's
 * updateExternalLabel). Left uncorrected, both "fit to screen" and PNG
 * export silently crop that overflow — worse the more edges/labels a
 * diagram has, which is exactly why it only became visible on large
 * diagrams. edgeLayer's own coordinate system is already canvas-space (the
 * pan/zoom transform lives on its parent, contentEl — see
 * viewport.js#applyViewport), so its getBBox() unions in directly with no
 * conversion; external labels are plain positioned HTML, so their
 * genuinely-in-viewport-pixels rect goes through screenToCanvas first. */
export function getContentBounds() {
  const nodes = store.getState().nodes;
  if (!nodes.length) return null;
  let minX = Math.min(...nodes.map((n) => n.x));
  let minY = Math.min(...nodes.map((n) => n.y));
  let maxX = Math.max(...nodes.map((n) => n.x + n.w));
  let maxY = Math.max(...nodes.map((n) => n.y + n.h));

  if (edgeLayer) {
    const bbox = edgeLayer.getBBox();
    if (bbox.width > 0 || bbox.height > 0) {
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    }
  }

  for (const labelEl of document.querySelectorAll('.node-external-label')) {
    const r = labelEl.getBoundingClientRect();
    const topLeft = viewport.screenToCanvas(r.left, r.top);
    const bottomRight = viewport.screenToCanvas(r.right, r.bottom);
    minX = Math.min(minX, topLeft.x);
    minY = Math.min(minY, topLeft.y);
    maxX = Math.max(maxX, bottomRight.x);
    maxY = Math.max(maxY, bottomRight.y);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function fitToScreen() {
  const bounds = getContentBounds();
  if (bounds) viewport.fitToContent(bounds);
  else viewport.resetViewport();
}

/** Rearranges every node into a layered top-to-bottom layout based on
 * connector direction (see core/autoLayout.js) — a source flows into its
 * dependents one row per hop, disconnected nodes/components spread out
 * below/beside the rest instead of overlapping. One undo step for the
 * whole rearrangement. Edges aren't touched directly; their rendering
 * already recomputes from current node positions every time nodes move,
 * same as any drag. */
export function autoArrangeAll() {
  const state = store.getState();
  if (!state.nodes.length) return;
  // A sequence diagram's horizontal lifeline layout is manual and
  // meaningful (x position = which participant, not "flows into") —
  // running the connector-direction layout over it would scramble it.
  if (state.nodes.some((n) => n.shape === 'lifeline')) {
    showToast('Auto-arrange isn\'t available with a sequence diagram on the canvas — its layout is manual.', 'info', 3200);
    return;
  }
  const positions = computeAutoLayout(state.nodes, state.edges);
  store.dispatch((draft) => {
    for (const n of draft.nodes) {
      const p = positions.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    }
    // Re-pick every edge's anchor sides for the new layout too — an edge
    // otherwise keeps whatever sides it was originally drawn with, which
    // usually reads fine on its own but tends to produce an unnecessary
    // loop-out once auto-arrange has straightened everything else into
    // tidy rows (e.g. a straight vertical chain, but one edge still exits
    // "right" and re-enters "left" because that's what its two endpoints
    // happened to face when it was first connected).
    for (const e of draft.edges) {
      const from = draft.nodes.find((n) => n.id === e.from);
      const to = draft.nodes.find((n) => n.id === e.to);
      if (from && to) Object.assign(e, pickBestSides(from, to));
    }
  });
  fitToScreen();
}

/** "Distribute evenly" (Tools dropdown) — re-spaces every lifeline column to
 * the wizard's own gap and every message's height along its lifeline(s),
 * preserving both the lifelines' left-to-right order and the messages'
 * top-to-bottom order (see core/sequenceDiagram.js). A tidy-up action for a
 * sequence diagram that's drifted uneven from manual dragging/reconnecting,
 * not a replacement for Auto-arrange (which sequence diagrams opt out of
 * entirely — their layout is manual/meaningful, see autoArrangeAll above). */
export function distributeSequenceDiagram() {
  const state = store.getState();
  if (state.nodes.filter((n) => n.shape === 'lifeline').length < 2) {
    showToast('Add at least 2 lifelines to distribute a sequence diagram.', 'info', 2400);
    return;
  }
  const xUpdates = distributeLifelineColumns(state.nodes);
  const offsetUpdates = distributeMessages(state.nodes, state.edges);
  store.dispatch((draft) => {
    for (const [id, x] of xUpdates) {
      const n = draft.nodes.find((nd) => nd.id === id);
      if (n) n.x = x;
    }
    for (const [id, upd] of offsetUpdates) {
      const e = draft.edges.find((ed) => ed.id === id);
      if (!e) continue;
      if (upd.fromOffset != null) e.fromOffset = upd.fromOffset;
      if (upd.toOffset != null) e.toOffset = upd.toOffset;
    }
  });
  showToast('Distributed lifelines and messages evenly.', 'success', 2200);
}

/** "Scale Diagram" (Tools dropdown → modals/scaleDiagramModal.js) —
 * permanently resizes every node's own position/size *and* font size by
 * `factor`, unlike the view-only pan/zoom (canvas/viewport.js) which never
 * touches the underlying data. Centered on the diagram's own current
 * bounding-box center so it stays roughly in place instead of drifting
 * toward the canvas origin. Edge fromOffset/toOffset are fractions (0..1
 * along a node's own side), already scale-invariant, so edges need no
 * changes at all. */
export function scaleDiagram(factor) {
  const state = store.getState();
  if (!state.nodes.length) {
    showToast('Nothing to scale yet — add some components first.', 'info', 2200);
    return;
  }
  const bounds = getContentBounds();
  const origin = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  store.dispatch((draft) => {
    draft.nodes = scaleNodes(draft.nodes, factor, origin);
  });
  showToast(`Scaled the diagram to ${Math.round(factor * 100)}%.`, 'success', 2200);
}

/** Every group whose members are ALL lifeline nodes (2+) — a "sequence
 * diagram group" that qualifies for the drill-down/zoom-in view (see
 * modals/subDiagramModal.js) and gets its own extra page/image in PDF/PNG
 * export (see io/exportPdf.js, io/exportImage.js). Purely derived from the
 * existing groupId+shape fields already round-tripped through JSON export/
 * import — nothing new is persisted, so no schema changes were needed for
 * this feature, the same "computed at render time" convention as
 * computeMessageSequenceNumbers above. */
export function getSequenceDiagramGroups() {
  const state = store.getState();
  const byGroup = new Map();
  for (const n of state.nodes) {
    if (!n.groupId) continue;
    if (!byGroup.has(n.groupId)) byGroup.set(n.groupId, []);
    byGroup.get(n.groupId).push(n);
  }
  const groups = [];
  for (const [groupId, nodes] of byGroup) {
    if (nodes.length < 2 || !nodes.every((n) => n.shape === 'lifeline')) continue;
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = state.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    groups.push({ groupId, nodes, edges, label: nodes.map((n) => n.text).filter(Boolean).join(' / ') });
  }
  return groups;
}

/** Bounding box of just the given node ids (ignoring every other node/edge
 * on the canvas) — used by io/exportImage.js to capture one sequence
 * diagram group on its own, cropped tightly around only its own content.
 * Simpler than getContentBounds() above (no edge-overflow/external-label
 * correction): a sequence diagram's messages never route outside their own
 * lifelines' horizontal span, so the extra correction that function exists
 * for doesn't apply here. */
export function getNodesBounds(nodeIds) {
  const idSet = new Set(nodeIds);
  const nodes = store.getState().nodes.filter((n) => idSet.has(n.id));
  if (!nodes.length) return null;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Hides every node/edge element NOT in `nodeIds` (and the group-background
 * layer entirely) so io/exportImage.js's html2canvas capture shows only one
 * sequence diagram group in isolation. Returns a restore function that
 * undoes exactly this — call it in a `finally` block, same pattern
 * captureDiagramCanvas() itself already uses for its own viewport/style
 * save-and-restore. */
export function hideExcept(nodeIds) {
  const idSet = new Set(nodeIds);
  const state = store.getState();
  const edgesById = new Map(state.edges.map((e) => [e.id, e]));
  const hidden = [];
  for (const [id, elRef] of nodeElements) {
    if (!idSet.has(id)) { hidden.push(elRef); elRef.style.display = 'none'; }
  }
  for (const [id, elRef] of edgeElements) {
    const edge = edgesById.get(id);
    if (!edge || !idSet.has(edge.from) || !idSet.has(edge.to)) { hidden.push(elRef); elRef.style.display = 'none'; }
  }
  const prevGroupBgDisplay = groupBgLayer.style.display;
  groupBgLayer.style.display = 'none';
  const prevHandleDisplay = edgeHandleLayer.style.display;
  edgeHandleLayer.style.display = 'none';
  return () => {
    for (const elRef of hidden) elRef.style.display = '';
    groupBgLayer.style.display = prevGroupBgDisplay;
    edgeHandleLayer.style.display = prevHandleDisplay;
  };
}

// ---- context menus ----

function openNodeContextMenu(nodeId, evt) {
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  const items = [
    { label: 'Open details', icon: 'ⓘ', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-details', { detail: { nodeId } })) },
    { label: 'Duplicate', icon: '⧉', onClick: () => { store.select([nodeId], []); duplicateSelection(); } },
  ];
  if (node?.shape === 'lifeline') {
    items.push({ label: 'Add lifeline to the right', icon: '➕', onClick: () => addLifelineToRight(nodeId) });
    items.push(Number.isFinite(node.destroyOffset)
      ? { label: 'Clear destroy marker', icon: '✕', onClick: () => clearLifelineDestroyOffset(nodeId) }
      : { label: 'Mark destroyed here', icon: '✕', onClick: () => setLifelineDestroyOffset(nodeId, evt) });
    // Right-clicking directly on an existing activation bar offers removing
    // *that* bar instead of adding a new (likely overlapping) one.
    const activationBarEl = evt.target.closest?.('.lifeline-activation');
    if (activationBarEl) {
      items.push({ label: 'Remove activation bar', icon: '▯', onClick: () => removeActivationBar(nodeId, activationBarEl.dataset.activationId) });
    } else {
      items.push({ label: 'Add activation bar', icon: '▯', onClick: () => addActivationBar(nodeId, evt) });
    }
  }
  items.push(
    'separator',
    { label: 'Bring to front', icon: '⬆️', onClick: () => reorderZ(nodeId, true) },
    { label: 'Send to back', icon: '⬇️', onClick: () => reorderZ(nodeId, false) },
  );
  // Only offered once ≥1 replication pair already exists in the project,
  // this specific node isn't already part of one, and it isn't already a
  // member of some *other* multi-node group — addSelectionToReplicationSide
  // just overwrites groupId with no merge, so joining replication from
  // here would otherwise silently pull the node out of an existing regular
  // group with no warning. The same "create a brand-new pair" action
  // already lives in the toolbar's 🔁 Replicate button once something is
  // selected, so this menu item is specifically the shortcut for the
  // *join an existing pair* case, which otherwise required knowing to
  // select the node and open that same modal yourself.
  const inOtherGroup = node?.groupId && store.getState().nodes.some((n) => n.id !== nodeId && n.groupId === node.groupId);
  if (getReplicationPairs().length && !getReplicationInfoForNode(nodeId) && !inOtherGroup) {
    items.push('separator', {
      label: 'Join replication...', icon: '🔁',
      onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-replication', { detail: { nodeId } })),
    });
  }
  items.push('separator', { label: 'Delete', icon: '🗑️', danger: true, onClick: () => { store.select([nodeId], []); deleteSelection(); } });
  showContextMenu(evt.clientX, evt.clientY, items);
}

function openEdgeContextMenu(edgeId, evt) {
  const state = store.getState();
  const edge = state.edges.find((e) => e.id === edgeId);
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const isMessage = edge && nodesById.get(edge.from)?.shape === 'lifeline' && nodesById.get(edge.to)?.shape === 'lifeline';

  const items = [
    { label: 'Open details', icon: 'ⓘ', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-edge-details', { detail: { edgeId } })) },
  ];
  if (isMessage) {
    items.push('separator');
    items.push({
      label: edge.sequenceNumberOverride != null ? 'Change sequence number...' : 'Set sequence number...',
      icon: '#️⃣',
      onClick: async () => {
        const n = await promptNumber({ title: 'Sequence number', label: 'Number', defaultValue: edge.sequenceNumberOverride ?? 1, min: 1, confirmLabel: 'Set' });
        if (n != null) setSequenceNumberOverride(edgeId, n);
      },
    });
    if (edge.sequenceNumberOverride != null) {
      items.push({ label: 'Clear sequence number override', icon: '↩️', onClick: () => setSequenceNumberOverride(edgeId, null) });
    }
  }
  items.push(
    'separator',
    { label: 'Duplicate', icon: '⧉', onClick: () => { store.select([], [edgeId]); duplicateSelection(); } },
    'separator',
    { label: 'Delete connector', icon: '🗑️', danger: true, onClick: () => { store.select([], [edgeId]); deleteSelection(); } },
  );
  showContextMenu(evt.clientX, evt.clientY, items);
}

function openCanvasContextMenu(evt) {
  const items = [
    { label: 'Select all', icon: '▭', onClick: () => store.select(store.getState().nodes.map((n) => n.id), []) },
    { label: 'Fit to screen', icon: '🔍', onClick: fitToScreen },
    { label: 'Reset zoom to 100%', icon: '💯', onClick: () => viewport.zoomTo(1) },
    'separator',
    { label: 'Duplicate entire canvas', icon: '⧉', onClick: duplicateEntireCanvas },
    { label: 'Duplicate as new project', icon: '📄', onClick: duplicateProjectAsNew },
    'separator',
    { label: 'Clear canvas', icon: '🧹', danger: true, onClick: clearCanvas },
  ];
  showContextMenu(evt.clientX, evt.clientY, items);
}

window.addEventListener('blur', hideContextMenu);
