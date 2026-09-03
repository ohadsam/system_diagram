// Orchestrates the canvas: mounts the DOM, renders nodes/edges from the
// store, and owns pan/zoom/marquee-selection. See docs/ARCHITECTURE.md
// "Canvas rendering".
import * as store from '../core/store.js';
import { createEdge, nextZIndex, removeNode as removeNodeFromProject, removeEdge as removeEdgeFromProject, createNode, duplicateProject, createVersionSnapshot, removeVersion as removeVersionFromProject, createComment, createReply, createAnimationStep, createAnimation, createProjectLink, upsertGroupMeta } from '../core/project.js';
import { copyVersionToBranch } from '../core/versionBranches.js';
import { onAnimationChange, isAnimationPlaying, getAnimationPlaybackState, startPlayback, stopPlayback } from '../core/animationPlayback.js';
import { buildAutoWalkthroughAnimation } from '../core/animationAutoBuild.js';
import { setKioskMode } from '../core/kioskMode.js';
import { buildReplicationPair } from '../core/replication.js';
import { computeAutoLayout } from '../core/autoLayout.js';
import { layoutLifelines, distributeLifelineColumns, distributeMessages, spaceMessagesForLabels, layoutImportedSequenceDiagram, GAP as LIFELINE_GAP } from '../core/sequenceDiagram.js';
import { spreadNodesForLabels } from '../core/labelSpacing.js';
import { layoutErTables } from '../core/erDiagramLayout.js';
import { layoutC4Context } from '../core/c4Context.js';
import { buildDemoProject } from '../core/demoProjects.js';
import { scaleNodes } from '../core/scaleDiagram.js';
import { applyDiagramTheme, DIAGRAM_THEMES } from '../core/diagramTheme.js';
import { initMinimap } from './minimap.js';
import { computeFocusedIds } from '../core/focusMode.js';
import { computeDiagramLint, computeCustomLint } from '../core/diagramLint.js';
import { getCustomLintRules } from '../io/customLintRules.js';
import { getUiPrefs } from '../io/uiPrefs.js';
import { getComponentById } from '../data/index.js';
import { getCustomComponents } from '../io/customComponents.js';
import { buildCreationOverrides } from '../io/nodeDefaults.js';
import { el, svgEl, clear } from '../utils/dom.js';
import { rectsIntersect, pickBestSides, sideAnchor, computeAnchorOffset, boundsOfBoxes } from '../core/geometry.js';
import { nextDuplicateName } from '../core/duplicateNaming.js';
import { nextId } from '../core/id.js';
import { sanitizeAddNode, sanitizeAddEdge, sanitizeNodeUpdateFields, sanitizeEdgeUpdateFields } from '../io/aiEditDesign.js';
import { showToast } from '../utils/toast.js';
import * as viewport from './viewport.js';
import { touchPointDistance, touchPointAngleDeg, normalizeRotationDeg } from './touchGeometry.js';
import { registerTouchGestureCancel, clearTouchGestureCancel, cancelAnyActiveTouchGesture } from './touchGestureCoordinator.js';
import { createNodeEl, updateNodeEl, configureNodeHandlers, startInlineEdit } from './node.js';
import { attachNodeInteractions } from './nodeInteractions.js';
import { createEdgeEl, updateEdgeEl, configureEdgeHandlers, initConnectorDefs } from './connector.js';
import { initConnectorInteractions } from './connectorInteractions.js';
import { initEdgeReconnect, syncEdgeHandles } from './edgeReconnect.js';
import { initWaypointHandles, syncWaypointHandles } from './waypointHandles.js';
import { initCommentPins, renderCommentPins } from './commentPins.js';
import { showContextMenu, hideContextMenu } from './contextMenu.js';
import { getToolMode, onToolModeChange } from './toolMode.js';
import { showSuggestionsFor } from './suggestions.js';
import { computeGroupBounds, PADDING as GROUP_BOUNDS_PADDING } from './groupBackgrounds.js';
import { computeShrunkGroups } from './shrinkGroups.js';
import { confirmAction } from '../modals/confirmModal.js';
import { promptNumber } from '../modals/promptModal.js';
import { openBlastRadiusModal } from '../modals/blastRadiusModal.js';
import { recordComponentUsed } from '../io/recentComponents.js';

let viewportEl = null;
let contentEl = null;
let nodeLayer = null;
let edgeLayer = null;
let edgeHandleLayer = null;
let groupBgLayer = null;
let replicationSyncLayer = null;
let marqueeEl = null;
let guideLayer = null;
let commentLayer = null;
let animBadgeLayer = null;

const nodeElements = new Map();
const edgeElements = new Map();
const groupBgElements = new Map();
const animBadgeElements = new Map();
// Which `${targetType}:${targetId}` keys were revealed as of the *previous*
// applyAnimationVisibility() pass — diffed against the current pass to spot
// a target crossing from hidden to revealed, which gets a one-shot
// `.anim-just-revealed` pulse (see applyAnimationVisibility).
let previouslyRevealedAnimKeys = new Set();
// The active animation's own `autoFocus` setting, captured once at
// startAnimationPlayback() (not re-read live) so it can't flip mid-
// -presentation if something edited the project underneath it — same
// snapshot reasoning core/animationPlayback.js documents for its own
// `steps`. How many steps had already been auto-focused, so
// maybeAutoFocusOnReveal() only frames what's *newly* revealed since the
// last change, not the whole sequence again on every tick.
let animationPlaybackAutoFocus = false;
let animationAutoFocusedCount = 0;
// Session-only opt-out ("✕" on a group's own background) — a group that
// dissolves (drops below 2 members) naturally falls out of
// computeGroupBounds() and is cleaned up in render() below regardless of
// whether it's in this set, so this never leaks stale entries.
const hiddenGroupBackgrounds = new Set();

// Two-finger touch gestures (pinch-to-zoom, and rotate when exactly one
// node is selected) — see wireTouchGestures()/beginTouchPinchRotate() below.
// `touchGestureFirstTarget` records where the *first* finger of a
// candidate gesture landed, so a second finger touching down somewhere
// unrelated (e.g. a native pinch inside an open <dialog>) never gets
// hijacked into a canvas zoom just because it happened at the same time.
const activeTouchPoints = new Map();
let touchGestureFirstTarget = null;

export function initCanvas(root) {
  viewportEl = root;
  viewportEl.classList.add('canvas-viewport');

  contentEl = el('div', { class: 'canvas-content' });
  groupBgLayer = el('div', { class: 'group-bg-layer' });
  edgeLayer = svgEl('svg', { class: 'edge-layer' });
  // A child of edgeLayer (not its own top-level layer) purely so it rides
  // along with edgeLayer's own .flow-simulation-on class and
  // pause/unpauseAnimations() calls (see setFlowSimulationEnabled) instead
  // of needing its own parallel toggle — the moving dots between a
  // replication pair's mirrored members are conceptually the same "ambient
  // traffic" visualization as an edge's flow-dot, just without a real edge
  // object backing them (see renderReplicationSyncPaths).
  replicationSyncLayer = svgEl('g', { class: 'replication-sync-layer' });
  edgeLayer.appendChild(replicationSyncLayer);
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
  // Smart alignment guides (nodeInteractions.js#beginMove) — sits above
  // everything else in .canvas-content so a guide line is never hidden
  // behind the node being dragged. Lives in canvas-space just like every
  // other layer here (contentEl carries the pan/zoom transform), so a
  // guide's x/y is a plain canvas coordinate with no manual zoom math
  // needed, unlike .marquee below (deliberately a sibling of contentEl,
  // not a child, for reasons specific to that gesture — see its own code).
  guideLayer = svgEl('svg', { class: 'align-guide-layer' });
  contentEl.appendChild(guideLayer);
  // Pinned comments (see canvas/commentPins.js) sit above every other
  // canvas-space layer, same reasoning as guideLayer just above — a pin
  // must always be clickable, never hidden behind a node/edge it happens
  // to be pinned near.
  commentLayer = el('div', { class: 'comment-layer' });
  contentEl.appendChild(commentLayer);
  // Diagram Animation's order badges (edit-time only, see
  // renderAnimationBadges) — its own layer for the same reason
  // commentLayer/guideLayer are: read-only, canvas-space overlays that must
  // never intercept clicks meant for a node/edge/the canvas background.
  animBadgeLayer = el('div', { class: 'anim-badge-layer' });
  contentEl.appendChild(animBadgeLayer);
  viewportEl.appendChild(contentEl);

  marqueeEl = el('div', { class: 'marquee', hidden: true });
  viewportEl.appendChild(marqueeEl);

  viewport.initViewport(viewportEl, contentEl);
  initConnectorDefs(edgeLayer);
  initConnectorInteractions(edgeLayer);
  initEdgeReconnect(edgeHandleLayer);
  initWaypointHandles(edgeHandleLayer);
  initCommentPins(commentLayer);

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

  wireTouchGestures();
  wireBackgroundInteractions();
  wireWheel();

  onToolModeChange((tool) => viewportEl.classList.toggle('tool-hand', tool === 'hand'));
  viewportEl.classList.toggle('tool-hand', getToolMode() === 'hand');

  store.subscribe('change', render);
  store.subscribe('selection', renderSelectionOnly);
  render(store.getState());

  initMinimap(viewportEl);

  // Starting/stopping/stepping playback never touches project data (it's
  // pure core/animationPlayback.js state), so it never fires the store's
  // own 'change' event — render() alone would leave the order badges gone
  // forever after a presentation ends, since nothing else would ever call
  // it again. Re-running both here keeps badges and hidden-state in sync
  // with every animation change, not just data edits.
  onAnimationChange(() => {
    const state = store.getState();
    const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
    renderAnimationBadges(state, nodesById);
    applyAnimationVisibility(state);
    maybeAutoFocusOnReveal(state, nodesById);
  });
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
    // See wireTouchGestures below — a second finger touching down converts
    // this single-finger pan into a pinch/rotate gesture by calling this
    // same onUp (via the shared coordinator) to tear the pan down first.
    clearTouchGestureCancel(onUp);
  };
  if (e.pointerType === 'touch') registerTouchGestureCancel(onUp);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** Two-finger pinch-to-zoom (always) + rotate (only while exactly one node
 * is selected — mirrors the Rotation field in toolbar/styleEditor.js, just
 * driven by a gesture instead of a number input). Started once a second
 * touch lands on top of an already-tracked first one — see the pointerdown
 * listener in wireTouchGestures below, which also cancels whatever
 * single-finger pan that first touch had already started. */
function beginTouchPinchRotate() {
  const ids = [...activeTouchPoints.keys()];
  if (ids.length !== 2) return;

  let prevDist = touchPointDistance(activeTouchPoints.get(ids[0]), activeTouchPoints.get(ids[1]));
  let prevAngle = touchPointAngleDeg(activeTouchPoints.get(ids[0]), activeTouchPoints.get(ids[1]));

  const selection = store.getSelection();
  const rotatingNodeId = (selection.nodeIds.length === 1 && selection.edgeIds.length === 0)
    ? selection.nodeIds[0]
    : null;

  const onMove = (ev) => {
    if (!activeTouchPoints.has(ev.pointerId)) return;
    activeTouchPoints.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const p1 = activeTouchPoints.get(ids[0]);
    const p2 = activeTouchPoints.get(ids[1]);
    if (!p1 || !p2) return;
    const dist = touchPointDistance(p1, p2);
    const angle = touchPointAngleDeg(p1, p2);
    if (prevDist > 0 && dist > 0) {
      viewport.zoomAt(dist / prevDist, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    }
    if (rotatingNodeId) {
      const angleDelta = angle - prevAngle;
      store.dispatch((draft) => {
        const n = draft.nodes.find((x) => x.id === rotatingNodeId);
        if (n) n.rotation = normalizeRotationDeg((n.rotation || 0) + angleDelta);
      }, { coalesce: true });
    }
    prevDist = dist;
    prevAngle = angle;
  };
  const onEnd = (ev) => {
    activeTouchPoints.delete(ev.pointerId);
    if (activeTouchPoints.size >= 2) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    if (rotatingNodeId) store.commitHistory();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
}

/** Tracks every active touch pointer at the window level (capture phase, so
 * it always runs before viewportEl's own pointerdown listener below) purely
 * to detect a second finger landing while a first is already down. Only
 * hijacks the gesture into pinch/rotate when the *first* finger's original
 * target was inside the canvas viewport — a two-finger gesture starting
 * elsewhere (say, inside an open <dialog>) is left completely alone. */
function wireTouchGestures() {
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if (activeTouchPoints.size === 0) touchGestureFirstTarget = e.target;
    activeTouchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouchPoints.size === 2 && viewportEl.contains(touchGestureFirstTarget)) {
      e.stopPropagation();
      cancelAnyActiveTouchGesture();
      beginTouchPinchRotate();
    }
  }, { capture: true });
  const clearTouchPoint = (e) => {
    if (e.pointerType !== 'touch') return;
    activeTouchPoints.delete(e.pointerId);
  };
  window.addEventListener('pointerup', clearTouchPoint, { capture: true });
  window.addEventListener('pointercancel', clearTouchPoint, { capture: true });
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

/** Renders the alignment-guide lines computed by
 * core/alignmentGuides.js#computeAlignmentGuides — called from
 * nodeInteractions.js#beginMove on every drag move while snapping is on.
 * Plain SVG lines in canvas-space (see guideLayer's own comment above). */
export function showAlignmentGuides(guides) {
  if (!guideLayer) return;
  clear(guideLayer);
  for (const g of guides.verticalGuides) {
    guideLayer.appendChild(svgEl('line', { class: 'align-guide', x1: g.x, y1: g.y1, x2: g.x, y2: g.y2 }));
  }
  for (const g of guides.horizontalGuides) {
    guideLayer.appendChild(svgEl('line', { class: 'align-guide', x1: g.x1, y1: g.y, x2: g.x2, y2: g.y }));
  }
}

export function hideAlignmentGuides() {
  if (guideLayer) clear(guideLayer);
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

/** Exported (in addition to being the store's own 'change' subscriber
 * below) so a UI-only preference that changes what a node's own DOM looks
 * like — but isn't itself project data, so toggling it must not touch
 * store.dispatch/history — can force an immediate re-render without a
 * fake no-op mutation that would otherwise leave a spurious "nothing
 * changed" entry in undo history. See toolbar.js's inline-lint-badges
 * toggle for the one current caller. */
export function render(state) {
  const nodeIds = new Set(state.nodes.map((n) => n.id));
  for (const [id, elRef] of nodeElements) {
    if (!nodeIds.has(id)) {
      elRef.remove();
      nodeElements.delete(id);
    }
  }
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const replicatedGroupIds = new Set();
  const frozenGroupIds = new Set();
  for (const p of state.replicationPairs) {
    replicatedGroupIds.add(p.groupA);
    replicatedGroupIds.add(p.groupB);
    if (p.frozen) { frozenGroupIds.add(p.groupA); frozenGroupIds.add(p.groupB); }
  }
  // "Group & Shrink" (see core/project.js's shrunkAnchorId field comment):
  // `shrunkGroups` maps each currently-shrunk group's anchor node id to its
  // *other* (hidden) member ids. `anchorByHiddenId` is the inverse lookup,
  // used below to redirect an edge that would otherwise terminate at an
  // invisible hidden member onto its group's visible placeholder instead —
  // an external connection to a shrunk group should visually read as
  // "this connects to the group", not silently vanish.
  const shrunkGroups = computeShrunkGroups(state.nodes);
  const hiddenNodeIds = new Set();
  const anchorByHiddenId = new Map();
  const shrunkGroupIds = new Set();
  const shrunkAnchorByGroupId = new Map();
  // What canvas/node.js actually draws *inside* a shrunk anchor's own face
  // instead of its normal icon/label — a live miniature of every member's
  // box+icon (canvas/shrinkThumbnail.js), not just the anchor's own
  // appearance, so "shrunk" reads as "here's a small preview of what's
  // grouped in here" rather than hiding that information entirely (see
  // docs/ARCHITECTURE.md's "Group & Shrink miniature" section for why the
  // previous "pristine node, frame only" design didn't give any indication).
  // Only every member's real, current x/y/w/h/icon/fill and the edges
  // strictly between two members are used — an edge to something outside
  // the group is already redirected onto the anchor itself elsewhere below,
  // so including it here too would double-draw it.
  const shrinkThumbnailByAnchorId = new Map();
  for (const [anchorId, memberIds] of shrunkGroups) {
    for (const id of memberIds) { hiddenNodeIds.add(id); anchorByHiddenId.set(id, anchorId); }
    const anchorNode = nodesById.get(anchorId);
    if (anchorNode?.groupId) { shrunkGroupIds.add(anchorNode.groupId); shrunkAnchorByGroupId.set(anchorNode.groupId, anchorNode); }
    if (!memberIds.length) continue; // a degenerate solo anchor (every other member since deleted) has nothing to preview
    const allIds = new Set([anchorId, ...memberIds]);
    const members = [...allIds].map((id) => nodesById.get(id)).filter(Boolean);
    if (members.length < 2) continue;
    const memberEdges = state.edges.filter((e) => allIds.has(e.from) && allIds.has(e.to));
    shrinkThumbnailByAnchorId.set(anchorId, { members, edges: memberEdges });
  }
  // Bounds/count still come from *every* member (as for any other group —
  // computeGroupBounds itself is unaware anything is hidden, so a shrunk
  // group's label still correctly reads its true member count) — only the
  // box's own x/y/w/h get overridden below, to just the one visible anchor's
  // rect, since a hidden member still carries its own original, possibly
  // far-away position and including it in the box itself would draw the
  // frame around that stale spread-out area instead of snugly around the
  // one visible placeholder.
  renderGroupBackgrounds(state.nodes, replicatedGroupIds, shrunkGroupIds, state.groups, shrunkAnchorByGroupId);
  renderReplicationSyncPaths(state.nodes, state.replicationPairs);
  // Ambient "Check Diagram" badges (io/uiPrefs.js#inlineLintBadges) — same
  // deterministic, offline findings the "🔍 Check Diagram" modal computes
  // (core/diagramLint.js), just surfaced directly on the node(s) involved
  // instead of requiring the modal to be opened first. Computed once per
  // render pass (not per node) since it's an O(nodes+edges) scan.
  let lintMessagesByNodeId = null;
  if (getUiPrefs().inlineLintBadges) {
    lintMessagesByNodeId = new Map();
    const findings = [
      ...computeDiagramLint(state.nodes, state.edges, state.replicationPairs, resolveComponentDef),
      ...computeCustomLint(state.nodes, state.edges, getCustomLintRules(), resolveComponentDef),
    ];
    for (const finding of findings) {
      for (const nodeId of finding.nodeIds) {
        if (!lintMessagesByNodeId.has(nodeId)) lintMessagesByNodeId.set(nodeId, []);
        lintMessagesByNodeId.get(nodeId).push(finding.message);
      }
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
    updateNodeEl(elRef, node, {
      selected: store.getSelection().nodeIds.includes(node.id),
      replicated: !!node.groupId && replicatedGroupIds.has(node.groupId),
      replicationFrozen: !!node.groupId && frozenGroupIds.has(node.groupId),
      lintMessages: lintMessagesByNodeId?.get(node.id) || null,
      shrinkThumbnail: shrinkThumbnailByAnchorId.get(node.id) || null,
    });
    // Reclaims the hidden member's on-canvas footprint entirely (unlike the
    // opacity-only `.dimmed`/`.anim-hidden` classes Focus Mode/Diagram
    // Animation use elsewhere) — real `display: none`, same technique
    // hideExcept() already uses for isolated group image export. The anchor
    // itself gets no special outline/border of its own — the group's own
    // frame (renderGroupBackgrounds, sized to just this rect) is what
    // signals "this is a collapsed group"; its *face*, though, is replaced
    // by the shrinkThumbnail composite above rather than rendering exactly
    // as it did before being shrunk (see node.js#buildShrinkThumbnailBody).
    elRef.style.display = hiddenNodeIds.has(node.id) ? 'none' : '';
  }

  const edgeIds = new Set(state.edges.map((e) => e.id));
  for (const [id, elRef] of edgeElements) {
    if (!edgeIds.has(id)) {
      elRef.remove();
      edgeElements.delete(id);
    }
  }
  const sequenceNumbers = computeMessageSequenceNumbers(state.edges, nodesById);
  for (const edge of state.edges) {
    // A hidden shrunk member's own real position/side is meaningless once
    // it's collapsed — route the edge to its group's placeholder instead.
    const fromId = anchorByHiddenId.get(edge.from) ?? edge.from;
    const toId = anchorByHiddenId.get(edge.to) ?? edge.to;
    const fromNode = nodesById.get(fromId);
    const toNode = nodesById.get(toId);
    if (!fromNode || !toNode) continue;
    let elRef = edgeElements.get(edge.id);
    if (!elRef) {
      elRef = createEdgeEl(edge);
      edgeElements.set(edge.id, elRef);
      edgeLayer.appendChild(elRef);
    }
    // Both ends collapsed onto the *same* placeholder from two originally
    // *different* nodes — an edge purely internal to a shrunk group has
    // nothing meaningful left to draw. Hidden, not removed, so a real
    // collapsed edge reappears instantly on Expand/Ungroup without waiting
    // to be recreated.
    //
    // A genuine self-loop (edge.from === edge.to already, e.g. a lifeline's
    // own self-message or an ER self-referencing relationship — see
    // erDiagramPatterns.spec.js/sequence-diagram.spec.js) used to always
    // render normally at the anchor regardless, on the reasoning that the
    // anchor kept its own full, unscaled size — so a self-loop's normal
    // path/arrowhead/label never overflowed it. That stopped being true
    // once a shrunk anchor could also show a live shrinkThumbnail composite
    // (canvas/shrinkThumbnail.js) at a footprint far smaller than a normal
    // node (see attachSuggestedPatternAsMiniature's 84x60 miniature): the
    // self-loop's own normal-sized rendering then spilled out well past the
    // tiny box, looking broken rather than "shrunk." So a self-loop is now
    // hidden too whenever its anchor is actually drawing that composite
    // (`shrinkThumbnailByAnchorId.has(fromId)`) — implementation-detail
    // message text/arrows have no room at miniature scale; the group's own
    // name is still shown via its frame's `.group-bg-label`, and the full
    // self-loop is still visible in the 🔍 zoom-in drill-down, which renders
    // the group's real nodes/edges independently of this hiding.
    if (fromId === toId && (edge.from !== edge.to || shrinkThumbnailByAnchorId.has(fromId))) {
      elRef.style.display = 'none';
      continue;
    }
    elRef.style.display = '';
    updateEdgeEl(elRef, edge, fromNode, toNode, {
      selected: store.getSelection().edgeIds.includes(edge.id),
      allNodes: state.nodes,
      sequenceNumber: sequenceNumbers.get(edge.id) ?? null,
    });
  }
  syncEdgeHandles(state, store.getSelection());
  syncWaypointHandles(state, store.getSelection());
  renderCommentPins(state.comments || []);
  applyFocusDimming(store.getSelection());
  renderAnimationBadges(state, nodesById);
  applyAnimationVisibility(state);
}

// ---- Focus Mode ----
// Dims every node/edge not directly connected to the current selection,
// so a large diagram can be read one neighborhood at a time. Purely a
// view-layer overlay (a `.dimmed` class, toggled here) — never touches
// project data, so it needs no undo/redo entry and survives a toggle with
// zero effect on anything exported/saved.
let focusModeEnabled = false;

export function setFocusMode(enabled) {
  focusModeEnabled = enabled;
  applyFocusDimming(store.getSelection());
}

/** Toggles the ambient "traffic flow" dots (see connector.js#createEdgeEl's
 * .flow-dot/<animateMotion>) app-wide. SMIL timing is paused/resumed at the
 * .edge-layer's own SVGSVGElement level rather than per-edge, so this is
 * O(1) regardless of how many connectors the diagram has, and every edge
 * created afterward starts already in the right paused/running state
 * simply by being appended into an already-paused-or-not layer. */
export function setFlowSimulationEnabled(enabled) {
  if (!edgeLayer) return;
  edgeLayer.classList.toggle('flow-simulation-on', enabled);
  try {
    if (enabled) edgeLayer.unpauseAnimations();
    else edgeLayer.pauseAnimations();
  } catch {
    // pauseAnimations/unpauseAnimations (SMIL) isn't implemented in every
    // engine — the .flow-simulation-on CSS class above still controls
    // visibility either way, just without the pause-when-off cost saving.
  }
}

/** Draws one animated dot traveling back and forth between each replication
 * pair member's mirrored counterpart — a Live Replication pair has no real
 * edge between its two sides (mirroring is a data relationship, not a drawn
 * connector), so this synthesizes its own invisible-unless-flow-simulation
 * path rather than reusing connector.js#createEdgeEl. Rides inside
 * .edge-layer (see initCanvas's `replicationSyncLayer`) purely so it shares
 * that layer's existing .flow-simulation-on visibility/pause toggle — see
 * setFlowSimulationEnabled above — with no separate state of its own to
 * keep in sync. Goes both ways (`keyPoints`/`keyTimes` round-trip) rather
 * than only A->B, since this app's replication is bidirectional regardless
 * of which cosmetic label (Active-Active/Active-Passive/...) a pair uses —
 * see modals/replicationModal.js. Cheap enough to just clear-and-rebuild
 * every render() the same way renderGroupBackgrounds() already does,
 * rather than diffing — a diagram rarely has more than a couple of pairs. */
function renderReplicationSyncPaths(nodes, replicationPairs) {
  if (!replicationSyncLayer) return;
  clear(replicationSyncLayer);
  if (!replicationPairs || !replicationPairs.length) return;
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  for (const pair of replicationPairs) {
    for (const member of pair.members || []) {
      const a = nodesById.get(member.a);
      const b = nodesById.get(member.b);
      if (!a || !b) continue;
      const pathId = `repl-sync-${member.a}-${member.b}`;
      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const path = svgEl('path', { class: 'replication-sync-path', id: pathId, d: `M ${ax} ${ay} L ${bx} ${by}` });
      replicationSyncLayer.appendChild(path);

      const dot = svgEl('circle', { class: 'replication-sync-dot', r: 4 });
      const motion = svgEl('animateMotion', {
        dur: '2.4s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1;0', keyTimes: '0;0.5;1',
      });
      const mpath = svgEl('mpath', { href: `#${pathId}` });
      mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathId}`);
      motion.appendChild(mpath);
      dot.appendChild(motion);
      replicationSyncLayer.appendChild(dot);
    }
  }
}

function applyFocusDimming(selection) {
  const active = focusModeEnabled && selection.nodeIds.length > 0;
  const { nodeIds: focusedNodeIds, edgeIds: focusedEdgeIds } = active
    ? computeFocusedIds(selection.nodeIds, store.getState().edges)
    : { nodeIds: new Set(), edgeIds: new Set() };
  for (const [id, elRef] of nodeElements) elRef.classList.toggle('dimmed', active && !focusedNodeIds.has(id));
  for (const [id, elRef] of edgeElements) elRef.classList.toggle('dimmed', active && !focusedEdgeIds.has(id));
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

/** Discards every manually-dragged bend point (see
 * canvas/waypointHandles.js), handing the connector back to whatever
 * routing/fromSide/toSide would otherwise draw. */
export function clearEdgeWaypoints(edgeId) {
  store.dispatch((draft) => {
    const edge = draft.edges.find((e) => e.id === edgeId);
    if (edge) edge.waypoints = [];
  });
}

// ---- Pinned comments (see canvas/commentPins.js and core/project.js#createComment) ----

/** Drops a new comment pin at the right-click point (canvas-viewport's
 * "Add comment here" — see openCanvasContextMenu below) and immediately
 * opens it for editing, same "create then open" flow as a freshly-drawn
 * sequence-diagram message's details. */
export function addCommentAt(evt) {
  const point = viewport.screenToCanvas(evt.clientX, evt.clientY);
  const comment = createComment(point.x, point.y);
  store.dispatch((draft) => { draft.comments.push(comment); });
  window.dispatchEvent(new CustomEvent('sdb:open-comment', { detail: { commentId: comment.id } }));
}

/** Command-palette equivalent of addCommentAt — there's no click point to
 * anchor to, so it drops at the current viewport's center instead, same
 * convention as addComponentAtCenter. */
export function addCommentAtCenter() {
  const point = screenCenterCanvasPoint();
  const comment = createComment(point.x, point.y);
  store.dispatch((draft) => { draft.comments.push(comment); });
  window.dispatchEvent(new CustomEvent('sdb:open-comment', { detail: { commentId: comment.id } }));
}

export function updateCommentText(commentId, text) {
  store.dispatch((draft) => {
    const c = draft.comments.find((x) => x.id === commentId);
    if (c) c.text = text;
  });
}

export function toggleCommentResolved(commentId) {
  store.dispatch((draft) => {
    const c = draft.comments.find((x) => x.id === commentId);
    if (c) c.resolved = !c.resolved;
  });
}

export function deleteComment(commentId) {
  store.dispatch((draft) => {
    draft.comments = draft.comments.filter((x) => x.id !== commentId);
  });
}

/** Appends a reply to a comment thread — see core/project.js#createReply.
 * No-ops on blank text so a click on an empty reply box never commits an
 * empty history entry (the same guard-before-dispatch discipline every
 * other action here follows — store.dispatch always emits 'change'
 * regardless of whether anything meaningful changed). */
export function addCommentReply(commentId, text) {
  if (!text || !text.trim()) return;
  store.dispatch((draft) => {
    const c = draft.comments.find((x) => x.id === commentId);
    if (c) c.replies.push(createReply(text.trim()));
  });
}

export function deleteCommentReply(commentId, replyId) {
  store.dispatch((draft) => {
    const c = draft.comments.find((x) => x.id === commentId);
    if (c) c.replies = c.replies.filter((r) => r.id !== replyId);
  });
}

/** Captures the current canvas content as a new named version — see
 * core/project.js#createVersionSnapshot and docs/ARCHITECTURE.md's
 * "Diagram Versions" section. A plain `dispatch` (not `loadProject`) so
 * saving a version is itself undoable, same reasoning as every other
 * in-place project mutation here (see the `clearCanvas` gotcha this file's
 * other actions already follow). */
export function saveDiagramVersion(name) {
  const state = store.getState();
  const version = createVersionSnapshot(state, name);
  store.dispatch((draft) => {
    draft.versions = [...(draft.versions || []), version];
  });
  return version;
}

/** Adds a cross-project link from this live project to another *saved*
 * project — see core/project.js's `links` field and modals/
 * systemMapModal.js. Purely data; the actual System Map is computed at
 * render time from every saved project's own `links` array. */
export function addProjectLink(targetProjectId, label) {
  const link = createProjectLink(targetProjectId, label);
  store.dispatch((draft) => {
    draft.links = [...(draft.links || []), link];
  });
  return link;
}

export function removeProjectLink(linkId) {
  store.dispatch((draft) => {
    draft.links = (draft.links || []).filter((l) => l.id !== linkId);
  });
}

/** Changes this project's review status (see core/project.js's
 * REVIEW_STATUSES and modals/reviewStatusModal.js) and records who set it
 * and when — a lightweight "who last touched this" note, not a real
 * permissions/approval system (no accounts exist here to enforce one). */
export function setReviewStatus(status, reviewedBy) {
  store.dispatch((draft) => {
    draft.reviewStatus = status;
    draft.reviewedBy = (reviewedBy || '').trim();
    draft.reviewedAt = new Date().toISOString();
  });
}

/** Replaces the live canvas's nodes/edges/replicationPairs with a saved
 * version's own snapshot — the version history itself (and every other
 * version in it) is untouched, so reverting is not a one-way trip: revert
 * to an older version, then revert again to a newer one, as many times as
 * needed. Clears selection since a selected id might not exist in the
 * reverted content. No-op if the version no longer exists (e.g. deleted in
 * another tab). */
export function revertToVersion(versionId) {
  const state = store.getState();
  const version = (state.versions || []).find((v) => v.id === versionId);
  if (!version) return false;
  store.dispatch((draft) => {
    draft.nodes = structuredClone(version.snapshot.nodes);
    draft.edges = structuredClone(version.snapshot.edges);
    draft.replicationPairs = structuredClone(version.snapshot.replicationPairs);
  });
  store.select([], []);
  return true;
}

/** Deletes a saved version (cascades to strip it from any presentation
 * slide referencing it — see core/project.js#removeVersion). Does not
 * touch the live canvas content at all, only the stored history. */
export function deleteVersion(versionId) {
  store.dispatch((draft) => {
    removeVersionFromProject(draft, versionId);
  });
}

/** "Create a branch from this version" and "Merge into..." are the exact
 * same underlying operation (see core/versionBranches.js#copyVersionToBranch
 * for why this is an explicit copy, never an automatic structural merge) —
 * both land here. `targetBranch` is a brand-new name for the former, an
 * existing branch's name for the latter; either way the result is a new
 * version entry, appended, with the source version's own history
 * untouched. Returns the new version, or null if the source no longer
 * exists (e.g. deleted in another tab). */
export function branchFromVersion(versionId, targetBranch, name) {
  const state = store.getState();
  const source = (state.versions || []).find((v) => v.id === versionId);
  if (!source) return null;
  const newVersion = copyVersionToBranch(source, targetBranch, name);
  store.dispatch((draft) => {
    draft.versions = [...(draft.versions || []), newVersion];
  });
  return newVersion;
}

/** Creates or overwrites a presentation — an ordered subset of saved
 * versions assembled into a slideshow (see modals/presentationsModal.js,
 * modals/presentationPlayerModal.js). `slides` is `[{versionId, title,
 * notes}]`; pass `id` to update an existing presentation in place instead
 * of creating a new one. */
export function savePresentation({ id, name, slides }) {
  const state = store.getState();
  const existing = id ? (state.presentations || []).find((p) => p.id === id) : null;
  const presentation = {
    id: existing?.id || id || nextId('pres'),
    name: (name || '').trim() || 'Presentation',
    createdAt: existing?.createdAt || new Date().toISOString(),
    slides,
  };
  store.dispatch((draft) => {
    const list = draft.presentations || [];
    const idx = list.findIndex((p) => p.id === presentation.id);
    draft.presentations = idx === -1 ? [...list, presentation] : list.map((p, i) => (i === idx ? presentation : p));
  });
  return presentation;
}

export function deletePresentation(presentationId) {
  store.dispatch((draft) => {
    draft.presentations = (draft.presentations || []).filter((p) => p.id !== presentationId);
  });
}

// ---- Diagram Animation ----
// Any number of named, independently-playable reveal sequences over this
// project's own nodes/edges — see core/project.js's `animations`/
// `activeAnimationId` fields, core/animationPlayback.js (the playback state
// machine), and panel/animationPanel.js (the editing UI, including the
// animation switcher). A step's `targets` array is normally one item, but
// can hold several — a "reveal together" group, all sharing one order
// number — see addAnimationStep. Order is just array position; an item
// never added to any step of the active animation is always visible,
// animated or not.

export function getAnimations() {
  return store.getState().animations || [];
}

export function getActiveAnimationId() {
  return store.getState().activeAnimationId;
}

export function getActiveAnimation() {
  const id = getActiveAnimationId();
  return getAnimations().find((a) => a.id === id) || null;
}

export function getAnimationSteps() {
  return getActiveAnimation()?.steps || [];
}

export function createNewAnimation(name) {
  const animation = createAnimation(name);
  store.dispatch((draft) => {
    draft.animations = [...(draft.animations || []), animation];
    draft.activeAnimationId = animation.id;
  });
  return animation;
}

export function renameAnimation(animationId, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === animationId);
    if (a) a.name = trimmed;
  });
}

/** No confirmation here — panel/animationPanel.js's delete button owns
 * asking first, same division of labor as removeVersionFromProject/its own
 * modal callers. Falls back to whatever animation is now first in the list
 * (or none) if the deleted one was active. */
export function deleteAnimation(animationId) {
  store.dispatch((draft) => {
    draft.animations = (draft.animations || []).filter((a) => a.id !== animationId);
    if (draft.activeAnimationId === animationId) {
      draft.activeAnimationId = draft.animations[0]?.id ?? null;
    }
  });
}

export function setActiveAnimation(animationId) {
  store.dispatch((draft) => { draft.activeAnimationId = animationId; });
}

export function setAnimationAutoFocus(animationId, autoFocus) {
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === animationId);
    if (a) a.autoFocus = !!autoFocus;
  });
}

/** Adds one target (a plain `{targetType, targetId}`) or several at once
 * (an array — a "reveal together" group, e.g. from a multi-selection's
 * right-click "Add Selection to Animation") as a single new step. Silently
 * drops any target already somewhere in the active animation (so
 * re-triggering an add on an already-included item, or a group add that
 * partially overlaps an existing step, can never create a duplicate
 * reference); returns null and creates nothing if that leaves zero targets.
 * Creates the project's first animation implicitly if none exists yet —
 * the panel's "New Animation" button is only needed for a *second* one. */
export function addAnimationStep(targetsInput) {
  const requested = Array.isArray(targetsInput) ? targetsInput : [targetsInput];
  const active = getActiveAnimation();
  const already = new Set((active?.steps || []).flatMap((s) => s.targets.map((t) => `${t.targetType}:${t.targetId}`)));
  const targets = requested.filter((t) => !already.has(`${t.targetType}:${t.targetId}`));
  if (!targets.length) return null;
  const step = createAnimationStep(targets);
  store.dispatch((draft) => {
    if (!draft.animations.length) {
      const fresh = createAnimation('Animation 1');
      draft.animations = [fresh];
      draft.activeAnimationId = fresh.id;
    }
    const a = draft.animations.find((x) => x.id === draft.activeAnimationId) || draft.animations[0];
    a.steps.push(step);
  });
  return step;
}

export function removeAnimationStep(stepId) {
  if (!stepId) return;
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === draft.activeAnimationId);
    if (a) a.steps = a.steps.filter((s) => s.id !== stepId);
  });
}

/** Removes one target from within a (possibly grouped) step, dropping the
 * whole step once that leaves it with no targets — the context menu's
 * "Remove from Animation" and a per-target ✕ in the panel's grouped-step
 * row both call this rather than removeAnimationStep, since either could be
 * acting on just one member of a multi-target group. */
export function removeAnimationTarget(stepId, targetType, targetId) {
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === draft.activeAnimationId);
    if (!a) return;
    a.steps = a.steps
      .map((s) => (s.id === stepId ? { ...s, targets: s.targets.filter((t) => !(t.targetType === targetType && t.targetId === targetId)) } : s))
      .filter((s) => s.targets.length);
  });
}

function findAnimationStepForTarget(targetType, targetId) {
  return getAnimationSteps().find((s) => s.targets.some((t) => t.targetType === targetType && t.targetId === targetId)) || null;
}

/** Moves a step earlier (`direction: -1`) or later (`direction: 1`) in the
 * sequence. No-op (not even a wasted undo entry) if the move would go past
 * either end — checked before dispatching, same convention as
 * `revertToVersion`'s not-found guard above. */
export function reorderAnimationStep(stepId, direction) {
  const steps = getAnimationSteps();
  const idx = steps.findIndex((s) => s.id === stepId);
  const targetIdx = idx + direction;
  if (idx === -1 || targetIdx < 0 || targetIdx >= steps.length) return;
  const next = [...steps];
  [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === draft.activeAnimationId);
    if (a) a.steps = next;
  });
}

/** Patches one step's own settings (`revealMode`/`delayMs`/`notes`) — the
 * panel's per-row controls call this on every change. */
export function updateAnimationStepSettings(stepId, patch) {
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === draft.activeAnimationId);
    if (a) a.steps = a.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s));
  });
}

/** Bulk-replaces the whole animations collection — used by
 * io/exportAnimation.js's import flow, which always replaces rather than
 * merges (see its own header comment for why). */
export function setAnimations(animations, activeAnimationId) {
  store.dispatch((draft) => {
    draft.animations = animations;
    draft.activeAnimationId = activeAnimationId ?? (animations[0]?.id ?? null);
  });
}

/** panel/animationPanel.js's "+ Add All" — every node then every edge not
 * already somewhere in the active animation, each as its own separate step
 * (canvas order), in one dispatch/undo entry rather than one per item. Same
 * "silently skip what's already in" semantics as addAnimationStep, and
 * same "create the first animation implicitly" behavior — this is just its
 * bulk sibling. Returns the number of steps actually added (0 if nothing
 * was left to add, e.g. every candidate is already in the animation). */
export function addAllToActiveAnimation() {
  const state = store.getState();
  const active = getActiveAnimation();
  const already = new Set((active?.steps || []).flatMap((s) => s.targets.map((t) => `${t.targetType}:${t.targetId}`)));
  const newSteps = [
    ...state.nodes.filter((n) => !already.has(`node:${n.id}`)).map((n) => createAnimationStep({ targetType: 'node', targetId: n.id })),
    ...state.edges.filter((e) => !already.has(`edge:${e.id}`)).map((e) => createAnimationStep({ targetType: 'edge', targetId: e.id })),
  ];
  if (!newSteps.length) return 0;
  store.dispatch((draft) => {
    if (!draft.animations.length) {
      const fresh = createAnimation('Animation 1');
      draft.animations = [fresh];
      draft.activeAnimationId = fresh.id;
    }
    const a = draft.animations.find((x) => x.id === draft.activeAnimationId) || draft.animations[0];
    a.steps.push(...newSteps);
  });
  return newSteps.length;
}

/** panel/animationPanel.js's bulk "change all to auto-play"/"change all to
 * click" actions — applies one `revealMode` to every step of the active
 * animation in a single dispatch. Switching a step *into* 'auto' also gives
 * it a sensible `delayMs` if it doesn't already have one (a step created by
 * hand always starts as 'click' with no meaningful delay set — see
 * createAnimationStep's default); switching to 'click' leaves `delayMs`
 * alone since it's simply unused in that mode and switching back to 'auto'
 * later should restore whatever delay was set before, not reset to default. */
export function setAllStepsRevealMode(revealMode) {
  store.dispatch((draft) => {
    const a = (draft.animations || []).find((x) => x.id === draft.activeAnimationId);
    if (!a) return;
    a.steps = a.steps.map((s) => ({
      ...s,
      revealMode,
      delayMs: revealMode === 'auto' && !s.delayMs ? 2000 : s.delayMs,
    }));
  });
}

/** The animation counterpart to "🎲 Auto-arrange"/"📐 Scale Diagram" —
 * builds a fresh walkthrough animation from *every* node/edge currently on
 * the canvas (core/animationAutoBuild.js, the same logic already offered
 * after AI-generation flows via modals/autoAnimationPrompt.js) and starts
 * playing it immediately, with no manual step-adding or per-step
 * configuration required first. Replaces whichever animation was already
 * active rather than appending a second one — this is meant as a quick
 * "just show me the whole thing" action, not a step in building a curated
 * animation by hand (that's what the panel's own "+ Add All" is for). */
export function autoBuildAndPlayAnimation() {
  const state = store.getState();
  if (state.nodes.length < 1) {
    showToast('Add at least one component first.', 'error');
    return;
  }
  const animation = buildAutoWalkthroughAnimation(state, { revealMode: 'auto' });
  setAnimations([animation], animation.id);
  startAnimationPlayback();
}

/** Small numbered badges over every node/edge currently in the active
 * animation's sequence — editing-time-only feedback so the order is visible
 * directly on the diagram, not just in the side panel. Purely a read-only
 * overlay (its own layer, `pointer-events: none` — see css/canvas.css)
 * computed from project data, same reasoning as connector.js's sequence-
 * -number badges; kept as a separate layer rather than added to
 * node.js/connector.js so this feature never has to touch those two
 * already-complex, heavily tested files. Hidden entirely while playback is
 * running — it's an authoring aid, not something the audience should see.
 * A grouped (multi-target) step draws the *same* order number over every
 * one of its targets, one badge element each — keyed by
 * `${step.id}:${targetType}:${targetId}` rather than just `step.id` so
 * every target in a group gets its own DOM element. */
function renderAnimationBadges(state, nodesById) {
  const steps = getAnimationSteps();
  if (!steps.length || isAnimationPlaying()) {
    for (const [, elRef] of animBadgeElements) elRef.remove();
    animBadgeElements.clear();
    return;
  }
  const seen = new Set();
  steps.forEach((step, index) => {
    step.targets.forEach((target) => {
      let pos = null;
      if (target.targetType === 'node') {
        const n = nodesById.get(target.targetId);
        // Capped at a typical component's own height (84, see
        // project.js#createNode's default) rather than the node's actual
        // height, so the badge stays near the readable label/icon instead
        // of sliding arbitrarily far down an unusually tall shape — a
        // sequence diagram's lifeline (default 640px tall) being the
        // concrete case this matters for. A no-op for every ordinary
        // component, which is never taller than the cap anyway.
        if (n) pos = { x: n.x, y: n.y + Math.min(n.h, 84) };
      } else {
        const edge = state.edges.find((e) => e.id === target.targetId);
        const fromNode = edge && nodesById.get(edge.from);
        const toNode = edge && nodesById.get(edge.to);
        if (fromNode && toNode) {
          const a = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5);
          const b = sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5);
          pos = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
      }
      if (!pos) return;
      const key = `${step.id}:${target.targetType}:${target.targetId}`;
      seen.add(key);
      let elRef = animBadgeElements.get(key);
      if (!elRef) {
        elRef = el('div', { class: 'anim-badge' });
        animBadgeElements.set(key, elRef);
        animBadgeLayer.appendChild(elRef);
      }
      elRef.textContent = String(index + 1);
      elRef.style.left = `${pos.x - 11}px`;
      elRef.style.top = `${pos.y - 11}px`;
    });
  });
  for (const [key, elRef] of animBadgeElements) {
    if (!seen.has(key)) {
      elRef.remove();
      animBadgeElements.delete(key);
    }
  }
}

// How long the reveal-pulse CSS animation runs (see css/canvas.css's
// .anim-just-revealed keyframes) — the class is removed again after this so
// it can be re-added (and replay) the next time the same element happens to
// be revealed again (e.g. jumping backward then forward past it).
const REVEAL_PULSE_MS = 700;

/** Gives a node/edge a brief one-shot pulse the moment it crosses from
 * hidden to revealed — `revealedKeys` is the *current* pass's revealed set,
 * `previouslyRevealedAnimKeys` (module-level) is the *previous* pass's, so
 * only an actual hidden→revealed transition qualifies, never a step
 * backward or an unrelated re-render while already revealed. */
function applyRevealPulse(elRef, key, revealedKeys) {
  if (!revealedKeys.has(key) || previouslyRevealedAnimKeys.has(key)) return;
  elRef.classList.remove('anim-just-revealed');
  // Force a reflow so re-adding the class restarts the CSS animation even
  // if this exact element was mid-pulse a moment ago (e.g. rapid
  // next/prev/next clicking landing back on the same target).
  void elRef.offsetWidth;
  elRef.classList.add('anim-just-revealed');
  setTimeout(() => elRef.classList.remove('anim-just-revealed'), REVEAL_PULSE_MS);
}

/** Toggles `.anim-hidden` on every node/edge element per the current
 * playback position (see core/animationPlayback.js) — re-run on every
 * playback change (next/prev/freeze) via `onAnimationChange`, and on every
 * normal store `render()` too so a live edit during playback (rare, but
 * kiosk mode doesn't block canvas interaction) doesn't leave a stale class
 * behind. A no-op, fully-visible pass when nothing is playing. Also drives
 * the reveal-pulse (see applyRevealPulse) by diffing this pass's revealed
 * set against the previous one. */
/** For io/exportAnimationPptx.js and io/exportAnimationVideo.js: the same
 * `.anim-hidden` mechanism applyAnimationVisibility uses for live playback,
 * but driven directly by a caller-supplied revealed-keys set rather than
 * core/animationPlayback.js's own state — a capture pass for exporting
 * doesn't want to actually enter playback mode (its chrome, keyboard
 * shortcuts, etc). clearAnimationExportVisibility() restores every
 * node/edge to visible once the capture pass is done. */
export function applyAnimationExportVisibility(revealedKeys) {
  for (const [id, elRef] of nodeElements) elRef.classList.toggle('anim-hidden', !revealedKeys.has(`node:${id}`));
  for (const [id, elRef] of edgeElements) elRef.classList.toggle('anim-hidden', !revealedKeys.has(`edge:${id}`));
}

export function clearAnimationExportVisibility() {
  for (const [, elRef] of nodeElements) elRef.classList.remove('anim-hidden');
  for (const [, elRef] of edgeElements) elRef.classList.remove('anim-hidden');
}

function applyAnimationVisibility(state) {
  if (!isAnimationPlaying()) {
    for (const [, elRef] of nodeElements) elRef.classList.remove('anim-hidden', 'anim-just-revealed');
    for (const [, elRef] of edgeElements) elRef.classList.remove('anim-hidden', 'anim-just-revealed');
    previouslyRevealedAnimKeys = new Set();
    return;
  }
  const { steps, revealedCount } = getAnimationPlaybackState();
  const hidden = new Set(steps.slice(revealedCount).flatMap((s) => s.targets).map((t) => `${t.targetType}:${t.targetId}`));
  const revealedKeys = new Set(steps.slice(0, revealedCount).flatMap((s) => s.targets).map((t) => `${t.targetType}:${t.targetId}`));
  for (const [id, elRef] of nodeElements) {
    const key = `node:${id}`;
    elRef.classList.toggle('anim-hidden', hidden.has(key));
    applyRevealPulse(elRef, key, revealedKeys);
  }
  for (const [id, elRef] of edgeElements) {
    const key = `edge:${id}`;
    elRef.classList.toggle('anim-hidden', hidden.has(key));
    applyRevealPulse(elRef, key, revealedKeys);
  }
  previouslyRevealedAnimKeys = revealedKeys;
}

function computeAnimationTargetsBounds(targets, state, nodesById) {
  const xs = [];
  const ys = [];
  for (const t of targets) {
    if (t.targetType === 'node') {
      const n = nodesById.get(t.targetId);
      if (n) { xs.push(n.x, n.x + n.w); ys.push(n.y, n.y + n.h); }
    } else {
      const edge = state.edges.find((e) => e.id === t.targetId);
      const fromNode = edge && nodesById.get(edge.from);
      const toNode = edge && nodesById.get(edge.to);
      if (fromNode && toNode) {
        const a = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5);
        const b = sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5);
        xs.push(a.x, b.x);
        ys.push(a.y, b.y);
      }
    }
  }
  if (!xs.length) return null;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(Math.max(...xs) - minX, 1), h: Math.max(Math.max(...ys) - minY, 1) };
}

// Extra breathing room around a freshly-revealed step's own bounds when
// auto-focus frames it — a bare fitToContent(bounds, 0) would zoom in tight
// enough that the item touches the screen edges.
const AUTO_FOCUS_PADDING = 120;

/** When the active animation's `autoFocus` is on, pans/zooms the canvas to
 * frame whatever the *most recent* forward move just revealed — a single
 * step, or every step jumped over at once (see
 * core/animationPlayback.js#jumpToStep). Never fires on a step backward or
 * on an unrelated change (a freeze toggle, autoplay/loop toggling) since
 * those don't advance `revealedCount`. Uses the playback's own captured
 * `steps` snapshot, not the live (possibly since-edited) active animation,
 * consistent with core/animationPlayback.js holding its own snapshot. */
function maybeAutoFocusOnReveal(state, nodesById) {
  const playbackState = getAnimationPlaybackState();
  if (!playbackState.playing || !animationPlaybackAutoFocus) {
    animationAutoFocusedCount = 0;
    return;
  }
  if (playbackState.revealedCount <= animationAutoFocusedCount) {
    animationAutoFocusedCount = playbackState.revealedCount;
    return;
  }
  const newlyRevealedSteps = playbackState.steps.slice(animationAutoFocusedCount, playbackState.revealedCount);
  animationAutoFocusedCount = playbackState.revealedCount;
  const bounds = computeAnimationTargetsBounds(newlyRevealedSteps.flatMap((s) => s.targets), state, nodesById);
  if (bounds) viewport.fitToContent(bounds, AUTO_FOCUS_PADDING);
}

/** Enters Diagram Animation playback — reuses Presenter Mode's chrome-
 * hiding (see core/kioskMode.js) as the base, then layers the reveal-by-
 * reveal state machine on top (core/animationPlayback.js). Clears the
 * selection first since nothing should read as "selected" during a
 * presentation. */
export function startAnimationPlayback() {
  const animation = getActiveAnimation();
  const steps = animation?.steps || [];
  if (!steps.length) {
    showToast('Add at least one step to the animation before playing.', 'error');
    return;
  }
  animationPlaybackAutoFocus = !!animation.autoFocus;
  animationAutoFocusedCount = 0;
  store.select([], []);
  setKioskMode(true);
  startPlayback(steps);
}

export function stopAnimationPlayback() {
  animationPlaybackAutoFocus = false;
  stopPlayback();
  setKioskMode(false);
}

/** One subtle bounding box behind every multi-member group — a regular
 * Group/Ungroup group, a replication pair's side, and a "Group & Shrink"
 * group (canvas.js#groupAndShrinkSelection) are all just nodes sharing a
 * `groupId`, so this renders identically for all three, with only the
 * label/color/zoom-button visibility telling them apart. `pointer-events:
 * none` on the box itself (see css/canvas.css) keeps it from intercepting
 * clicks meant for a node or the canvas background underneath; only its
 * own label/color-swatch/zoom/dismiss controls opt back in.
 *
 * A shrunk group's own box gets its x/y/w/h overridden below to its one
 * visible anchor's own rect (`shrunkAnchorByGroupId`) — `computeGroupBounds`
 * itself doesn't know or care that a member is hidden, so without this
 * override the box would span every member's original position, including
 * a hidden one's own stale, possibly far-away spot. The override makes the
 * frame come out sized to exactly the anchor's own rect, same footprint as
 * an ordinary node: the anchor itself renders with zero special treatment
 * (see render()'s own comment on the removed `.node-shrunk-anchor` class),
 * so "shrunk" now reads purely as "this ordinary-looking component has a
 * group frame around it," not as a mark on the component itself.
 *
 * A custom name (double-click the label to rename) and frame color (the
 * small swatch) are `project.groups`-backed (see core/project.js's
 * `upsertGroupMeta`) and available on any group here *except* a
 * replication side — its "🔁 N replicated"/purple color is a fixed,
 * meaningful signal, not something a custom label should be able to
 * obscure. Dismissing the background entirely (the "✕") stays session-only
 * (not saved with the project) — the group itself, and any custom name/
 * color it has, are untouched. */
function renderGroupBackgrounds(nodes, replicatedGroupIds, shrunkGroupIds = new Set(), groupsMeta = [], shrunkAnchorByGroupId = new Map()) {
  const bounds = computeGroupBounds(nodes, replicatedGroupIds, shrunkGroupIds)
    .filter((b) => !hiddenGroupBackgrounds.has(b.groupId));
  // Override just the box's own rect for a shrunk group, to its one visible
  // anchor's rect (padded the same amount computeGroupBounds itself uses) —
  // `count` (and everything else about `b`) stays exactly what
  // computeGroupBounds already gave it, computed from *every* member,
  // hidden or not.
  for (const b of bounds) {
    const anchor = shrunkAnchorByGroupId.get(b.groupId);
    if (!anchor) continue;
    b.x = anchor.x - GROUP_BOUNDS_PADDING;
    b.y = anchor.y - GROUP_BOUNDS_PADDING;
    b.w = anchor.w + GROUP_BOUNDS_PADDING * 2;
    b.h = anchor.h + GROUP_BOUNDS_PADDING * 2;
  }
  const seqGroupIds = new Set(getSequenceDiagramGroups().map((g) => g.groupId));
  const metaByGroupId = new Map(groupsMeta.map((g) => [g.groupId, g]));
  const seen = new Set();
  for (const b of bounds) {
    seen.add(b.groupId);
    let elRef = groupBgElements.get(b.groupId);
    if (!elRef) {
      elRef = el('div', { class: 'group-bg' });
      const label = el('span', { class: 'group-bg-label', title: 'Double-click to rename this group' });
      label.addEventListener('dblclick', (e) => {
        if (elRef.classList.contains('group-bg-replicated')) return;
        e.stopPropagation();
        startInlineEdit(label, label.textContent, (value) => renameGroup(b.groupId, value));
      });
      elRef.appendChild(label);
      elRef.appendChild(el('input', {
        type: 'color', class: 'group-bg-color', title: 'Set this group\'s frame color',
        onInput: (e) => setGroupColor(b.groupId, e.target.value),
      }));
      elRef.appendChild(el('button', {
        type: 'button', class: 'group-bg-zoom', text: '🔍', title: 'View this group zoomed in',
        onClick: (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('sdb:open-subdiagram', { detail: { groupId: b.groupId } })); },
      }));
      elRef.appendChild(el('button', {
        type: 'button', class: 'group-bg-dismiss', text: '✕', title: 'Hide this group\'s background (the group itself is unaffected)',
        onClick: () => { hiddenGroupBackgrounds.add(b.groupId); render(store.getState()); },
      }));
      groupBgElements.set(b.groupId, elRef);
      groupBgLayer.appendChild(elRef);
    }
    // A group qualifies for the zoom-in/drill-down view either because
    // every member is a lifeline (getSequenceDiagramGroups) or because it's
    // currently shrunk — hidden rather than removed so the toggle is
    // instant if either ever flips.
    const isShrunk = shrunkGroupIds.has(b.groupId);
    elRef.querySelector('.group-bg-zoom').hidden = !seqGroupIds.has(b.groupId) && !isShrunk;
    const isReplicated = replicatedGroupIds.has(b.groupId);
    elRef.classList.toggle('group-bg-replicated', isReplicated);
    elRef.querySelector('.group-bg-color').hidden = isReplicated;
    const meta = metaByGroupId.get(b.groupId);
    const labelEl = elRef.querySelector('.group-bg-label');
    // Skip while a rename is live in this exact element (startInlineEdit
    // swapped the label out for an <input>) — this whole function reruns on
    // every store change anywhere in the app, not just a change to this
    // group, so without this guard a concurrent unrelated dispatch would
    // tear out the in-progress <input> and its unsaved text.
    if (!elRef.querySelector('.inline-edit-input')) {
      // A replication side is commonly just 1 component (the mirror is on
      // the *other* side's own box, not this one) — "🔁 1 replicated" would
      // read oddly, so drop the count in that case; a regular/shrunk group
      // is never rendered below 1 member (see computeGroupBounds), so it
      // always has one to show.
      const fallback = isReplicated ? (b.count === 1 ? '🔁 Replicated' : `🔁 ${b.count} replicated`) : `${b.count} grouped`;
      const hasCustomName = !isReplicated && meta?.name;
      labelEl.textContent = hasCustomName ? meta.name : fallback;
      // css/canvas.css forces this label's `direction: ltr` for the
      // computed fallback text above, which is always-English and would
      // otherwise bidi-reorder under Hebrew's `dir="rtl"` — but a custom
      // name is arbitrary user text (it could itself be Hebrew), so forcing
      // ltr on it would render *that* backward instead. An inline
      // `direction: inherit` beats the stylesheet's own `ltr` rule (inline
      // styles always win) and falls back to whatever the ambient
      // direction actually is, same as if this label had no direction rule
      // of its own at all.
      labelEl.style.direction = hasCustomName ? 'inherit' : 'ltr';
    }
    const colorEl = elRef.querySelector('.group-bg-color');
    colorEl.value = meta?.color || '#94A3B8';
    elRef.style.borderColor = (!isReplicated && meta?.color) ? meta.color : '';
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
  syncWaypointHandles(store.getState(), selection);
  applyFocusDimming(selection);
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
    // A shrunk group's hidden (non-anchor) members are display:none and
    // report an all-zero rect — including one here would corrupt the union
    // box toward the viewport's origin instead of simply being excluded, as
    // a since-deleted id already is.
    if (elRef && elRef.style.display !== 'none') rects.push(elRef.getBoundingClientRect());
  }
  for (const id of edgeIds) {
    const elRef = edgeElements.get(id);
    if (elRef && elRef.style.display !== 'none') rects.push(elRef.getBoundingClientRect());
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
    onAddPattern: (patternDefId) => attachSuggestedPatternAsMiniature(patternDefId, node.id),
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
export function addRelatedComponent(defId, anchorNodeId, offsetIndex) {
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
 * screen-space), instantiatePatternNearNode (sidebar drag-onto-node), and
 * attachSuggestedPatternAsMiniature (Smart Suggestions "+ Add" button, which
 * needs the raw created nodes back to shrink them, and suppresses this
 * function's own toast in favor of its own more specific one). */
function instantiatePatternAtPoint(defId, point, { silent = false } = {}) {
  const patternDef = resolveComponentDef(defId);
  if (!patternDef?.pattern) return null;

  const state = store.getState();
  let z = nextZIndex(state);
  const creationOverrides = buildCreationOverrides();
  const idByKey = new Map();
  // A fresh id per *instantiation*, not per pattern — dropping the same
  // template twice must never make the two copies look like one shared
  // instance to modals/groupExplanationModal.js's "gather every node from
  // this same instantiation" lookup. Stamped after `spec.overrides` (not
  // merged in earlier) so it always wins regardless of what a saved custom
  // component's own overrides happen to contain — this is structural
  // provenance metadata, not something a pattern's own data should ever be
  // able to override, the same reasoning `def.textPosition` etc. above
  // createNode() already documents.
  const patternInstanceId = nextId('patterninstance');
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
      sourcePatternId: defId,
      patternInstanceId,
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
  // "Group & Shrink" (see buildGroupSnapshotFromSelection's own
  // startShrunk/shrinkAnchorKey comment): a component saved while shrunk
  // reopens shrunk, by re-resolving its saved anchor key to this fresh
  // instantiation's own new node id — the id saved on the definition itself
  // is meaningless here (a different instantiation, possibly the very first
  // one ever), same "resolve fresh every time" reasoning patternInstanceId
  // above already documents.
  let shrunkAnchorNodeId = null;
  if (patternDef.startShrunk && patternDef.shrinkAnchorKey && idByKey.has(patternDef.shrinkAnchorKey)) {
    shrunkAnchorNodeId = idByKey.get(patternDef.shrinkAnchorKey);
    for (const n of newNodes) n.shrunkAnchorId = shrunkAnchorNodeId;
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

  // A silent caller always follows up with its own dispatch right away
  // (attachSuggestedPatternAsMiniature's own shrink/reposition one) — this
  // one deliberately skips its own history commit, the same `{ coalesce:
  // true }` idiom drag/resize gestures already use (nodeInteractions.js,
  // waypointHandles.js) for "several dispatches, one undo step," so a single
  // Undo removes the whole "added as a miniature" action in one step instead
  // of first un-shrinking a stray full-size pattern.
  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
  }, { coalesce: silent });
  // A silent caller (attachSuggestedPatternAsMiniature) still needs the
  // freshly created nodes' own ids/positions back, but sets its own final
  // selection itself once it's done repositioning/shrinking them — selecting
  // here too would fire an extra (multi-node) selection change in between
  // that a details-panel-open caller doesn't want to be visible even
  // momentarily (e.g. it would close an already-open details panel).
  if (!silent) {
    store.select(shrunkAnchorNodeId ? [shrunkAnchorNodeId] : newNodes.map((nd) => nd.id), []);
    showToast(`Added the "${patternDef.name}" pattern (${newNodes.length} components).`, 'success', 2400);
  }
  return { nodes: newNodes, edges: newEdges, shrunkAnchorNodeId };
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

const SUGGESTED_MINIATURE_W = 84;
const SUGGESTED_MINIATURE_H = 60;
// How much of the miniature's own footprint overlaps onto the host node's
// corner (rather than sitting fully outside it) — this, plus rendering it via
// the same "Group & Shrink" thumbnail (canvas/shrinkThumbnail.js), is what
// reads as "a small indicator attached to this component" instead of "a
// separate diagram that happens to be nearby", without requiring literal DOM
// nesting inside the host's own node box (this app's nodes are flat,
// absolutely-positioned siblings — there's no such thing as "inside" another
// node's DOM).
const SUGGESTED_MINIATURE_OVERLAP = 0.35;

/** Smart Suggestions' "+ Add" button (panel/detailsPanel.js#renderSuggestedPatterns)
 * for a suggested flow diagram. Unlike instantiatePatternNearNode (which drops
 * the pattern at full size next to the host node — the literal bug this fixes:
 * a full-size flow diagram appearing next to a component it was "added to"
 * looked like an unrelated second diagram, not an attached indicator), this
 * creates the pattern and immediately collapses it into the existing "Group &
 * Shrink" miniature (see shrinkThumbnail.js/node.js#buildShrinkThumbnailBody),
 * resized small and positioned overlapping the host's bottom-right corner —
 * so it reads as a small attached indicator, not a same-size sibling diagram,
 * and its existing 🔍 zoom button (subDiagramModal.js) is the "view it large"
 * action the user asked for, reused as-is. */
export function attachSuggestedPatternAsMiniature(defId, hostNodeId) {
  const hostNode = store.getState().nodes.find((n) => n.id === hostNodeId);
  const patternDef = resolveComponentDef(defId);
  if (!hostNode || !patternDef?.pattern) { instantiatePatternAtCenter(defId); return; }
  const MARGIN = 60;
  const result = instantiatePatternAtPoint(defId, { x: hostNode.x + hostNode.w + MARGIN, y: hostNode.y + hostNode.h / 2 }, { silent: true });
  if (!result?.nodes.length) return;
  const { nodes: newNodes, shrunkAnchorNodeId } = result;
  // A pattern already saved shrunk (patternDef.startShrunk/shrinkAnchorKey —
  // see instantiatePatternAtPoint) already designated its own anchor; honor
  // that instead of overriding it with the generic tie-break below, same as
  // groupAndShrinkSelection's own "topmost, then leftmost" pick for every
  // other (undesignated) case.
  const anchor = shrunkAnchorNodeId
    ? newNodes.find((n) => n.id === shrunkAnchorNodeId)
    : [...newNodes].sort((a, b) => (a.y - b.y) || (a.x - b.x))[0];
  const targetX = hostNode.x + hostNode.w - SUGGESTED_MINIATURE_W * SUGGESTED_MINIATURE_OVERLAP;
  const targetY = hostNode.y + hostNode.h - SUGGESTED_MINIATURE_H * SUGGESTED_MINIATURE_OVERLAP;
  const dx = targetX - anchor.x;
  const dy = targetY - anchor.y;
  const groupId = nextId('group');
  const newNodeIds = new Set(newNodes.map((n) => n.id));
  store.dispatch((draft) => {
    const z = nextZIndex(draft);
    for (const n of draft.nodes) {
      if (!newNodeIds.has(n.id)) continue;
      // Translating every member together (not just the anchor) preserves
      // their real relative layout — the shrink-thumbnail's own scaling math
      // (shrinkThumbnail.js#computeShrinkThumbnail) depends on each member's
      // actual x/y relative to the others, so moving only the anchor while
      // leaving the rest at their original, far-away creation position would
      // corrupt that bounding box the moment the group is later expanded.
      n.x += dx;
      n.y += dy;
      n.groupId = groupId;
      n.shrunkAnchorId = anchor.id;
      if (n.id === anchor.id) { n.w = SUGGESTED_MINIATURE_W; n.h = SUGGESTED_MINIATURE_H; n.zIndex = z; }
    }
  });
  // Keeps the host node selected (not the new anchor) — the user is
  // typically mid-flow in the host's own details panel, adding one or more
  // suggested flow diagrams in a row; jumping the selection to the newly
  // created anchor would close/replace that panel on every click instead of
  // letting them keep going (panel/detailsPanel.js's `selection` subscriber
  // only reacts when a single *different* node is selected).
  store.select([hostNode.id], []);
  showToast(`Added the "${patternDef.name}" flow diagram as a small indicator — click 🔍 to view it full size.`, 'success', 2800);
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

/** Turns parsed SQL DDL (io/sqlDdlImport.js#parseSqlDdl) into a real ER
 * diagram — one `rows`-shaped "entity" node per table (see
 * data/categories/design-patterns.js's own `entity()` helper for the same
 * convention its 3 built-in ER templates already use, so an imported
 * diagram matches them visually) and one labeled edge per foreign key.
 * Returns the number of tables created (0 if `parsed` was falsy/empty), so
 * modals/importSqlModal.js can tell a genuine no-op from a real import. */
export function createErDiagramFromDdl(parsed) {
  if (!parsed?.tables?.length) return 0;
  const entityDef = resolveComponentDef('shape-server-rows');
  const point = screenCenterCanvasPoint();
  const state = store.getState();
  let z = nextZIndex(state);

  const placed = layoutErTables(parsed.tables, point.x, point.y);
  const nodeIdByTable = new Map();
  const newNodes = placed.map((table) => {
    const rows = table.columns.map((c) => `${c.isPrimaryKey ? '🔑 ' : ''}${c.name}: ${c.type}`);
    const node = createNode(entityDef, table.x, table.y, { zIndex: z++, text: table.name, icon: '🗂️', rows, w: table.w, h: table.h });
    nodeIdByTable.set(table.name, node.id);
    return node;
  });

  const newEdges = parsed.foreignKeys
    .map((fk) => {
      const fromId = nodeIdByTable.get(fk.fromTable);
      const toId = nodeIdByTable.get(fk.toTable);
      if (!fromId || !toId) return null;
      return createEdge(fromId, toId, { label: `${fk.fromColumn} → ${fk.toColumn}` });
    })
    .filter(Boolean);

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
  });
  store.select(newNodes.map((n) => n.id), []);
  showToast(`Imported ${newNodes.length} table(s) and ${newEdges.length} relationship(s).`, 'success', 3200);
  return newNodes.length;
}

/** Creates a C4 System Context diagram (see modals/c4ContextModal.js): one
 * central "Software System" box, a row of Person/Actor boxes above it, a
 * row of External Software System boxes below it, and an edge from each
 * person/external system to the central system. Only the Context diagram
 * has a dedicated wizard — a Container or Component diagram is built the
 * same way as any other diagram, by dragging the matching shapes from the
 * "C4 Model" sidebar category and connecting them. */
export function createC4ContextDiagram(systemName, people, externalSystems) {
  const systemDef = resolveComponentDef('c4-system');
  const personDef = resolveComponentDef('c4-person');
  const externalDef = resolveComponentDef('c4-system-external');
  if (!systemDef || !personDef || !externalDef) return 0;

  const point = screenCenterCanvasPoint();
  const state = store.getState();
  let z = nextZIndex(state);

  const layout = layoutC4Context(systemName, people, externalSystems, point.x, point.y, systemDef.defaultSize);
  const systemNode = createNode(systemDef, layout.system.x, layout.system.y, { zIndex: z++, text: layout.system.text });
  const peopleNodes = layout.people.map((p) => createNode(personDef, p.x, p.y, { zIndex: z++, text: p.text }));
  const externalNodes = layout.externalSystems.map((s) => createNode(externalDef, s.x, s.y, { zIndex: z++, text: s.text }));

  const newEdges = [
    ...peopleNodes.map((n) => createEdge(n.id, systemNode.id, {})),
    ...externalNodes.map((n) => createEdge(systemNode.id, n.id, {})),
  ];
  const newNodes = [systemNode, ...peopleNodes, ...externalNodes];

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
  });
  store.select(newNodes.map((n) => n.id), []);
  showToast(`Created a C4 Context diagram with ${newNodes.length} boxes.`, 'success', 3200);
  return newNodes.length;
}

/** Loads a ready-made Demo Project (see core/demoProjects.js and
 * modals/demoProjectsModal.js) — a full project switch via
 * `store.loadProject`, same as Load/New/"Generate Design"/"AI Quick
 * Start", not an incremental `dispatch` onto the current canvas. The
 * modal itself is responsible for confirming replacement of a non-empty
 * canvas first (same pattern as those other full-switch flows) and for
 * offering "🧹 Clear Canvas" (the existing `clearCanvas()` below) right
 * alongside it — a loaded demo needs no separate "is this a demo"
 * tracking of its own to be clearable. */
export function loadDemoProject(demoId) {
  const project = buildDemoProject(demoId);
  if (!project) return false;
  store.loadProject(project);
  store.select(project.nodes.map((n) => n.id), []);
  showToast(`Loaded "${project.name}" (${project.nodes.length} components).`, 'success', 2800);
  return true;
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

export function addCustomShapeNode(shapeDef, centerPoint, extraOverrides = {}) {
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
    ...extraOverrides,
  });
  store.dispatch((draft) => {
    draft.nodes.push(node);
  });
  store.select([node.id], []);
  focusNode(node.id);
  return node;
}

/** One-click sticky note — the same underlying node as dragging "Sticky
 * Note" in from the Basic Shapes sidebar (`shape-note`,
 * data/categories/shapes.js), but skips the "Add Shape" picker modal and
 * gives it two small defaults suited to a fast, no-fuss annotation rather
 * than a labeled diagram shape: no icon (so a blank note doesn't show 🗒️
 * before you've typed anything) and a small randomized tilt, so several
 * notes dropped on the same canvas read as casually hand-placed instead of
 * mechanically identical — the sidebar item itself is untouched and still
 * defaults to upright with its icon shown. Called from both the toolbar's
 * quick-add button and the canvas right-click menu. */
export function addStickyNote(centerPoint) {
  const def = getComponentById('shape-note');
  if (!def) return null;
  const rotation = Math.round((Math.random() - 0.5) * 10); // roughly -5..5 degrees
  return addCustomShapeNode(def, centerPoint, { iconVisible: false, rotation });
}

function screenCenterCanvasPoint() {
  const rect = viewportEl.getBoundingClientRect();
  return viewport.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

/**
 * Applies a normalized "AI edit" patch (see io/aiEditDesign.js#normalizePatch
 * and the preview modals/aiEditModal.js shows before calling this) against
 * the live project, as one atomic dispatch/undo step. New node/edge ids the
 * patch declares are honored when they don't collide with anything already
 * on the canvas; a collision (or a missing id) gets a fresh one instead,
 * with every `addEdges`/`updateEdges` reference to that declared id
 * transparently remapped — the same "don't drop content over an id
 * mismatch" philosophy every other import path in this app follows. An
 * add/update entry that still doesn't resolve to a real node (a
 * hallucinated id the patch's own addNodes never actually created) is
 * silently skipped, exactly as the preview already warned it would be.
 */
export function applyAiEditPatch(patch) {
  const state = store.getState();
  const liveNodeIds = new Set(state.nodes.map((n) => n.id));
  const liveEdgeIds = new Set(state.edges.map((e) => e.id));
  const idRemap = new Map(); // patch-declared id -> the id actually used

  const newNodes = [];
  for (const raw of patch.addNodes) {
    const overrides = sanitizeAddNode(raw);
    if (!overrides) continue;
    const declaredId = overrides.id || null;
    let finalId = declaredId;
    if (!finalId || liveNodeIds.has(finalId)) finalId = nextId('node');
    liveNodeIds.add(finalId);
    if (declaredId && declaredId !== finalId) idRemap.set(declaredId, finalId);
    newNodes.push(createNode(null, overrides.x ?? 0, overrides.y ?? 0, { ...overrides, id: finalId }));
  }

  const resolveNodeRef = (id) => idRemap.get(id) || id;

  const newEdges = [];
  for (const raw of patch.addEdges) {
    const overrides = sanitizeAddEdge(raw);
    if (!overrides) continue;
    const from = resolveNodeRef(overrides.from);
    const to = resolveNodeRef(overrides.to);
    if (!liveNodeIds.has(from) || !liveNodeIds.has(to)) continue;
    let finalId = overrides.id;
    if (!finalId || liveEdgeIds.has(finalId)) finalId = nextId('edge');
    liveEdgeIds.add(finalId);
    newEdges.push(createEdge(from, to, { ...overrides, id: finalId }));
  }

  if (!newNodes.length && !newEdges.length && !patch.updateNodes.length && !patch.updateEdges.length
    && !patch.removeNodeIds.length && !patch.removeEdgeIds.length) return;

  store.dispatch((draft) => {
    draft.nodes.push(...newNodes);
    draft.edges.push(...newEdges);
    for (const raw of patch.updateNodes) {
      const node = draft.nodes.find((n) => n.id === raw.id);
      const fields = sanitizeNodeUpdateFields(raw);
      if (!node || !fields) continue;
      Object.assign(node, fields);
    }
    for (const raw of patch.updateEdges) {
      const edge = draft.edges.find((e) => e.id === raw.id);
      const fields = sanitizeEdgeUpdateFields(raw);
      if (!edge || !fields) continue;
      if (fields.from) { const r = resolveNodeRef(fields.from); if (liveNodeIds.has(r)) fields.from = r; else delete fields.from; }
      if (fields.to) { const r = resolveNodeRef(fields.to); if (liveNodeIds.has(r)) fields.to = r; else delete fields.to; }
      Object.assign(edge, fields);
    }
    for (const id of patch.removeNodeIds) removeNodeFromProject(draft, id);
    for (const id of patch.removeEdgeIds) removeEdgeFromProject(draft, id);
  });
}

/**
 * Applies an "AI Beautify Layout" reposition list (see
 * io/aiLayoutSuggest.js#sanitizeLayoutPatch — already filtered to real,
 * live node ids with finite coordinates) as one atomic dispatch/undo step.
 * Position-only, same as Auto-arrange (autoArrangeAll below) — shape,
 * text, color, and every connection are left untouched either way.
 */
export function applyLayoutRepositions(repositions) {
  if (!repositions.length) return;
  store.dispatch((draft) => {
    for (const { id, x, y } of repositions) {
      const node = draft.nodes.find((n) => n.id === id);
      if (node) { node.x = x; node.y = y; }
    }
  });
  fitToScreen();
}

/**
 * Draws a connector between two existing components with no drag gesture
 * at all — the mouse-free counterpart of dragging from one node's
 * connection dot to another, used by canvas/keyboardConnect.js's numbered-
 * badge gesture. Anchor sides come from `pickBestSides` (actual relative
 * position), same as `addRelatedComponent` above, so the result looks the
 * same as if it had been drawn by hand.
 */
export function connectNodesByKeyboard(fromNodeId, toNodeId) {
  const state = store.getState();
  const fromNode = state.nodes.find((n) => n.id === fromNodeId);
  const toNode = state.nodes.find((n) => n.id === toNodeId);
  if (!fromNode || !toNode) return;
  const sides = pickBestSides(fromNode, toNode);
  const edge = createEdge(fromNodeId, toNodeId, sides);
  store.dispatch((draft) => { draft.edges.push(edge); });
  store.select([], [edge.id]);
  showToast('Connected — Ctrl/Cmd+Z to undo.', 'success', 1800);
}

/**
 * One-click remediation for the two Check Diagram findings that have an
 * unambiguous, mechanical fix (see core/diagramLint.js#computeDiagramLint's
 * `fix` field) — the third built-in check ("orphan component") and every
 * custom rule (io/customLintRules.js) intentionally have none, since there's
 * no single correct way to guess what an unconnected/policy-violating
 * component *should* connect to. Both fixes are a single dispatch (one undo
 * step), following the same "build the new node/edge outside dispatch, push
 * inside it" shape applyAiEditPatch above already uses.
 */
export function applyLintAutoFix(fix) {
  if (!fix) return;
  const state = store.getState();

  if (fix.type === 'insert-service-layer') {
    const clientNode = state.nodes.find((n) => n.id === fix.clientId);
    const dbNode = state.nodes.find((n) => n.id === fix.dbId);
    if (!clientNode || !dbNode) return;
    const midX = Math.round((clientNode.x + dbNode.x) / 2);
    const midY = Math.round((clientNode.y + dbNode.y) / 2);
    const serviceNode = createNode(null, midX, midY, { text: 'Service Layer', icon: '⚙️' });
    const newEdge = createEdge(serviceNode.id, fix.dbId, {});
    store.dispatch((draft) => {
      draft.nodes.push(serviceNode);
      const edge = draft.edges.find((e) => e.id === fix.edgeId);
      // Redirects the existing client->db edge into client->service, and
      // adds a new service->db edge — the client's original edge id (and
      // any style/label it already had) survives, now pointing at the
      // service layer instead of straight at the database.
      if (edge) edge.to = serviceNode.id;
      draft.edges.push(newEdge);
    });
    return;
  }

  if (fix.type === 'add-load-balancer') {
    const members = state.nodes.filter((n) => fix.memberIds.includes(n.id));
    if (!members.length) return;
    const avgX = Math.round(members.reduce((sum, n) => sum + n.x, 0) / members.length);
    const minY = Math.min(...members.map((n) => n.y)) - 160;
    const lbNode = createNode(null, avgX, minY, { text: 'Load Balancer', icon: '⚖️' });
    const newEdges = fix.memberIds.map((id) => createEdge(lbNode.id, id, {}));
    store.dispatch((draft) => {
      draft.nodes.push(lbNode);
      draft.edges.push(...newEdges);
    });
  }
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

/** @param {{renameDuplicates?: boolean}} [opts] renameDuplicates (default
 * true) auto-increments a cloned node's name ("Auth Service" → "Auth
 * Service 2") the same way a file manager suggests "copy 2" — removes the
 * small manual rename step that duplicating a component used to always
 * leave behind. duplicateEntireCanvas below opts out: cloning *everything*
 * on the canvas is a whole-diagram mirror, not the "avoid two same-named
 * siblings" problem this exists to solve, so renaming every single node
 * there would just be noise. */
export function duplicateSelection({ renameDuplicates = true } = {}) {
  const selection = store.getSelection();
  if (!selection.nodeIds.length && !selection.edgeIds.length) return;
  const state = store.getState();
  const idMap = new Map();
  const groupIdMap = new Map();
  // A duplicated node from an instantiated pattern (patternInstanceId set)
  // must NOT keep the original's patternInstanceId — modals/groupExplanation
  // -Modal.js's "📖 Explain This Diagram" gathers every node sharing one
  // instantiation's patternInstanceId, and duplicating (a single node, or
  // the whole canvas) would otherwise either merge an unrelated stray copy
  // into the original template's explanation, or — duplicating the entire
  // canvas — leave two separate node-sets on the same canvas claiming the
  // same instantiation. `sourcePatternId` (which pattern it came from) is
  // fine to keep as-is; only the per-instantiation id needs a fresh value,
  // same reasoning as groupIdMap below.
  const patternInstanceIdMap = new Map();
  const usedNames = state.nodes.map((n) => n.text).filter(Boolean);
  const originals = selection.nodeIds.map((id) => state.nodes.find((n) => n.id === id)).filter(Boolean);
  const newNodes = originals
    .map((n) => {
      const { id: _oldId, x: _x, y: _y, groupId: oldGroupId, shrunkAnchorId: _oldShrunkAnchorId, patternInstanceId: oldPatternInstanceId, ...rest } = n;
      let newGroupId = null;
      if (oldGroupId) {
        if (!groupIdMap.has(oldGroupId)) groupIdMap.set(oldGroupId, nextId('group'));
        newGroupId = groupIdMap.get(oldGroupId);
      }
      let newPatternInstanceId;
      if (oldPatternInstanceId) {
        if (!patternInstanceIdMap.has(oldPatternInstanceId)) patternInstanceIdMap.set(oldPatternInstanceId, nextId('patterninstance'));
        newPatternInstanceId = patternInstanceIdMap.get(oldPatternInstanceId);
      }
      const text = renameDuplicates && n.text ? nextDuplicateName(n.text, usedNames) : n.text;
      if (text !== n.text) usedNames.push(text);
      const clone = createNode(null, n.x + 24, n.y + 24, { ...rest, text, groupId: newGroupId, patternInstanceId: newPatternInstanceId });
      idMap.set(n.id, clone.id);
      return clone;
    });
  // shrunkAnchorId names a specific node, so — like patternInstanceId's own
  // "resolve after every id exists" ordering just above — it can only be
  // remapped once idMap is fully populated; a duplicated member whose
  // anchor wasn't itself duplicated (only part of a shrunk group's members
  // was selected) surfaces as a normal, fully-visible node instead of
  // silently pointing at an id that isn't part of this batch at all.
  newNodes.forEach((clone, i) => {
    const oldAnchorId = originals[i].shrunkAnchorId;
    clone.shrunkAnchorId = oldAnchorId && idMap.has(oldAnchorId) ? idMap.get(oldAnchorId) : null;
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
    // sourcePatternId/patternInstanceId are provenance about *this specific*
    // instantiation (groupExplanation.js's "which library pattern, which
    // copy of it") — meaningless, stale data to bake into a newly-saved
    // reusable component, same reasoning as excluding groupId here.
    // instantiatePatternAtPoint always stamps its own fresh values after
    // spreading these overrides regardless, so this is cleanup, not a
    // functional fix.
    // shrunkAnchorId names a specific *node id* from the live canvas (not
    // this selection's own defId-keyed blueprint), so — same reasoning as
    // groupId just above — it would leak in as meaningless, dangling data.
    // Whether the saved component should itself reopen shrunk is captured
    // separately below (startShrunk/shrinkAnchorKey) and re-applied fresh
    // by instantiatePatternAtPoint, the same two-step split
    // groupOnInstantiate already uses for groupId.
    const { id: _id, x, y, zIndex: _zIndex, groupId: _groupId, shrunkAnchorId: _shrunkAnchorId, defId: _defId, sourcePatternId: _sourcePatternId, patternInstanceId: _patternInstanceId, ...overrides } = n;
    return { key, defId: n.defId || null, dx: x + n.w / 2 - centerX, dy: y + n.h / 2 - centerY, overrides };
  });

  const internalEdges = state.edges.filter((e) => keyById.has(e.from) && keyById.has(e.to));
  const selectedEdges = state.edges.filter((e) => selection.edgeIds.includes(e.id) && keyById.has(e.from) && keyById.has(e.to));
  const edgesToSave = [...new Map([...internalEdges, ...selectedEdges].map((e) => [e.id, e])).values()];
  const patternEdges = edgesToSave.map((e) => {
    const { id: _id, from, to, ...overrides } = e;
    return { from: keyById.get(from), to: keyById.get(to), overrides };
  });

  // "Group & Shrink" (see core/project.js's shrunkAnchorId field comment):
  // if the *whole* selection currently forms one shrunk group, remember
  // which member was its anchor (by the same `key` patternNodes above just
  // assigned it) so a saved custom component built from it reopens already
  // shrunk — the requirement instantiatePatternAtPoint's own
  // startShrunk/shrinkAnchorKey handling exists for. A selection that's
  // only *part* of a bigger shrunk group (the anchor wasn't included, or
  // members disagree) isn't a coherent "this whole thing is shrunk" case,
  // so it's saved as a normal, fully-visible component instead — same
  // reasoning excludes a lone anchor node saved by itself (nodes.length > 1
  // required): with no hidden members actually along for the ride, marking
  // it startShrunk would just cosmetically label a single ordinary node as
  // a "group of 1" with nothing to expand.
  const commonAnchorId = nodes.length > 1 && nodes.every((n) => n.shrunkAnchorId && n.shrunkAnchorId === nodes[0].shrunkAnchorId)
    ? nodes[0].shrunkAnchorId
    : null;
  const shrinkAnchorKey = commonAnchorId ? keyById.get(commonAnchorId) : null;

  return {
    nodeCount: nodes.length,
    pattern: { nodes: patternNodes, edges: patternEdges },
    startShrunk: !!shrinkAnchorKey,
    shrinkAnchorKey,
  };
}

/** Duplicates every node and connector currently on the canvas, offset in
 * place — the whole diagram, doubled, still in the same project. */
export function duplicateEntireCanvas() {
  const state = store.getState();
  if (!state.nodes.length && !state.edges.length) return;
  store.select(state.nodes.map((n) => n.id), state.edges.map((e) => e.id));
  duplicateSelection({ renameDuplicates: false });
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

/** "Group & Shrink" (right-click on a 2+ multi-selection): groups the
 * selection under a fresh groupId (same as groupSelection(), even if some
 * of it was already grouped — a clean regroup, not a merge) and collapses
 * it down to the on-screen footprint of its topmost-left member, which
 * becomes the anchor/placeholder (see core/project.js's shrunkAnchorId
 * field and canvas.js#computeShrunkGroups). Deterministic member order
 * (y then x) keeps repeat calls picking the same visual corner rather than
 * an arbitrary one. */
export function groupAndShrinkSelection() {
  const selection = store.getSelection();
  if (selection.nodeIds.length < 2) return;
  const state = store.getState();
  const selNodes = selection.nodeIds.map((id) => state.nodes.find((n) => n.id === id)).filter(Boolean);
  if (selNodes.length < 2) return;
  const anchor = [...selNodes].sort((a, b) => (a.y - b.y) || (a.x - b.x))[0];
  const groupId = nextId('group');
  store.dispatch((draft) => {
    for (const id of selection.nodeIds) {
      const n = draft.nodes.find((x) => x.id === id);
      if (n) { n.groupId = groupId; n.shrunkAnchorId = anchor.id; }
    }
  });
  store.select([anchor.id], []);
  showToast(`Grouped and shrunk ${selNodes.length} components — click 🔍 to view them.`, 'success', 2600);
}

/** "Expand" (right-click on a shrunk placeholder): restores every member of
 * `groupId` to full size without dissolving the grouping itself — the
 * inverse of groupAndShrinkSelection()'s own shrunkAnchorId assignment. */
export function expandShrunkGroup(groupId) {
  if (!groupId) return;
  store.dispatch((draft) => {
    for (const n of draft.nodes) {
      if (n.groupId === groupId) n.shrunkAnchorId = null;
    }
  });
  showToast('Expanded back to full size.', 'success', 1800);
}

/** "Ungroup" (בטל קיבוץ) on a shrunk placeholder: dissolves the grouping
 * *and* restores full size in one step, since a dissolved group has no
 * groupId left for a later Expand to even target. */
export function dissolveShrunkGroup(groupId) {
  if (!groupId) return;
  store.dispatch((draft) => {
    for (const n of draft.nodes) {
      if (n.groupId === groupId) { n.groupId = null; n.shrunkAnchorId = null; }
    }
  });
  showToast('Ungrouped — components are back to full size.', 'success', 1800);
}

/** Double-click a group's own frame label (renderGroupBackgrounds) to set
 * a custom name — persisted via `upsertGroupMeta`, replacing the computed
 * "N grouped"/"🗂️ N grouped" fallback text for that box from then on.
 * Works the same for a regular Group/Ungroup group and a "Group & Shrink"
 * group; not offered for a replication side (see renderGroupBackgrounds's
 * own comment on why). */
export function renameGroup(groupId, name) {
  store.dispatch((draft) => { upsertGroupMeta(draft, groupId, { name }); });
}

/** The small color swatch on a group's frame (renderGroupBackgrounds) —
 * recolors just that group's dashed border, same persistence/scope as
 * renameGroup above. */
export function setGroupColor(groupId, color) {
  store.dispatch((draft) => { upsertGroupMeta(draft, groupId, { color }); });
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
  const state = store.getState();
  const nodes = state.nodes;
  const comments = state.comments || [];
  if (!nodes.length && !comments.length) return null;

  const xs = [];
  const ys = [];
  for (const n of nodes) { xs.push(n.x, n.x + n.w); ys.push(n.y, n.y + n.h); }
  // A comment pin has a real on-screen footprint (~26px, see .comment-pin in
  // css/canvas.css) even though it's stored as a single point — pad by half
  // that so "Fit to Screen"/PNG export don't crop a pin sitting outside
  // every node's own bounds (e.g. a planning note dropped before anything
  // else exists yet).
  const COMMENT_PIN_RADIUS = 14;
  for (const c of comments) {
    xs.push(c.x - COMMENT_PIN_RADIUS, c.x + COMMENT_PIN_RADIUS);
    ys.push(c.y - COMMENT_PIN_RADIUS, c.y + COMMENT_PIN_RADIUS);
  }
  let minX = Math.min(...xs);
  let minY = Math.min(...ys);
  let maxX = Math.max(...xs);
  let maxY = Math.max(...ys);

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

/** Zooms/pans to fit just the selected node(s) — useful once a diagram gets
 * large enough that "Fit to screen" zooms out further than you want when
 * you only care about one subsystem right now. Falls back to fitToScreen()
 * when nothing's selected, so toolbar/zoomControls.js's "⛶" button can call
 * this unconditionally and always do something reasonable either way. */
export function fitToSelection() {
  const selection = store.getSelection();
  if (!selection.nodeIds.length) { fitToScreen(); return; }
  const state = store.getState();
  const nodes = state.nodes.filter((n) => selection.nodeIds.includes(n.id));
  const bounds = boundsOfBoxes(nodes);
  if (bounds) viewport.fitToContent(bounds);
  else fitToScreen();
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

/** "🔤 Fix Text Display" (Tools dropdown) — a long connector/message label
 * always wraps onto multiple lines when it renders (see connector.js, which
 * needs no action to trigger — that part is passive, the same way a node's
 * own label always wraps in HTML/CSS), but a long label can still visually
 * collide with a neighboring message or node if the layout around it was
 * never built with that extra height/width in mind — most visibly in a
 * sequence diagram like the "PKCE" template, where several long messages
 * (e.g. "verify code_verifier matches challenge") sit close enough together
 * that even wrapped, cramped text still overlaps. This one-click, undoable
 * action re-spaces things just enough to make room, without moving anything
 * that doesn't need it:
 * - Sequence diagram (any lifeline on the canvas): re-spaces every
 *   message's height along its lifeline(s) based on how tall its own
 *   wrapped label actually renders (core/sequenceDiagram.js#spaceMessagesForLabels)
 *   — a message with a long label gets proportionally more room than a
 *   short one, instead of every gap being forced equal the way "Distribute
 *   Evenly" does.
 * - Any other diagram: nudges the two ends of any labeled connector apart
 *   just far enough for that label's wrapped width to clear both nodes
 *   (core/labelSpacing.js#spreadNodesForLabels), leaving every other node
 *   and connector untouched. */
export function fixTextDisplay() {
  const state = store.getState();
  if (!state.nodes.length) {
    showToast('Nothing to fix yet — add some components first.', 'info', 2200);
    return;
  }
  const isSequenceDiagram = state.nodes.some((n) => n.shape === 'lifeline');
  if (isSequenceDiagram) {
    const offsetUpdates = spaceMessagesForLabels(state.nodes, state.edges);
    if (!offsetUpdates.size) {
      showToast('Add at least 2 messages to fix their text spacing.', 'info', 2400);
      return;
    }
    store.dispatch((draft) => {
      for (const [id, upd] of offsetUpdates) {
        const e = draft.edges.find((ed) => ed.id === id);
        if (!e) continue;
        if (upd.fromOffset != null) e.fromOffset = upd.fromOffset;
        if (upd.toOffset != null) e.toOffset = upd.toOffset;
      }
    });
  } else {
    const posUpdates = spreadNodesForLabels(state.nodes, state.edges);
    if (!posUpdates.size) {
      showToast('Every label already has room to display cleanly.', 'info', 2400);
      return;
    }
    store.dispatch((draft) => {
      for (const [id, pos] of posUpdates) {
        const n = draft.nodes.find((nd) => nd.id === id);
        if (n) { n.x = pos.x; n.y = pos.y; }
      }
    });
  }
  showToast('Adjusted spacing so every label displays clearly.', 'success', 2200);
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

/** Permanently recolors every component to a chosen palette (see
 * core/diagramTheme.js#applyDiagramTheme) — same "one-shot, undoable
 * transform" shape as scaleDiagram above, just for color instead of size. */
export function applyDiagramThemeToCanvas(themeKey) {
  const state = store.getState();
  if (!state.nodes.length) {
    showToast('Nothing to recolor yet — add some components first.', 'info', 2200);
    return;
  }
  store.dispatch((draft) => {
    draft.nodes = applyDiagramTheme(draft.nodes, themeKey);
  });
  const label = DIAGRAM_THEMES[themeKey]?.label || themeKey;
  showToast(`Applied the "${label}" theme.`, 'success', 2200);
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
    // A target node can already be display:none for an unrelated reason —
    // e.g. it's a "Group & Shrink" hidden member (see render()'s own
    // hiddenNodeIds) — in which case the capture must still show it: force
    // it visible rather than trusting whatever the ongoing render loop left
    // it at. The restore function's own render() call below reconciles this
    // back to the correct hidden state afterward, so nothing needs undoing
    // here specifically.
    else if (elRef.style.display === 'none') { elRef.style.display = ''; }
  }
  for (const [id, elRef] of edgeElements) {
    const edge = edgesById.get(id);
    if (!edge || !idSet.has(edge.from) || !idSet.has(edge.to)) { hidden.push(elRef); elRef.style.display = 'none'; }
    else if (elRef.style.display === 'none') { elRef.style.display = ''; }
  }
  const prevGroupBgDisplay = groupBgLayer.style.display;
  groupBgLayer.style.display = 'none';
  const prevHandleDisplay = edgeHandleLayer.style.display;
  edgeHandleLayer.style.display = 'none';
  return () => {
    for (const elRef of hidden) elRef.style.display = '';
    groupBgLayer.style.display = prevGroupBgDisplay;
    edgeHandleLayer.style.display = prevHandleDisplay;
    // Blindly restoring to '' above would incorrectly reveal a *different*
    // group's shrunk (non-anchor) members if one happens to exist elsewhere
    // on the canvas while this capture ran — a full render() reconciles
    // every element's display back to whatever the current shrink state
    // actually calls for, same as any other store-driven redraw.
    render(store.getState());
  };
}

// ---- context menus ----

function openNodeContextMenu(nodeId, evt) {
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  const items = [
    { label: 'Open details', icon: 'ⓘ', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-details', { detail: { nodeId } })) },
    { label: 'Duplicate', icon: '⧉', onClick: () => { store.select([nodeId], []); duplicateSelection(); } },
    { label: 'Blast Radius...', icon: '🎯', onClick: () => openBlastRadiusModal(nodeId) },
  ];
  // Only ever set on a node created by instantiating a library pattern/
  // template (see instantiatePatternAtPoint above) — a hand-built diagram
  // has nothing to look this up from, so the item is simply absent there
  // rather than opening to an empty explanation.
  if (node?.patternInstanceId) {
    items.push({ label: '📖 Explain This Diagram', icon: '📖', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-group-explanation', { detail: { patternInstanceId: node.patternInstanceId } })) });
  }
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
  // A shrunk placeholder (this specific node is its own group's anchor —
  // see core/project.js's shrunkAnchorId field) offers Expand/Ungroup
  // instead of the "Group & Shrink" offer below, which only makes sense on
  // a multi-selection that isn't shrunk yet.
  if (node?.shrunkAnchorId === nodeId) {
    items.push(
      'separator',
      { label: 'Expand', icon: '🔎', onClick: () => expandShrunkGroup(node.groupId) },
      { label: 'Ungroup', icon: '✂️', onClick: () => dissolveShrunkGroup(node.groupId) },
    );
  } else {
    const plainGroupItem = groupMenuItem(nodeId);
    const shrinkItem = groupAndShrinkMenuItem(nodeId);
    if (plainGroupItem || shrinkItem) items.push('separator');
    if (plainGroupItem) items.push(plainGroupItem);
    if (shrinkItem) items.push(shrinkItem);
  }
  items.push('separator', animationMenuItem('node', nodeId));
  const groupItem = selectionAnimationMenuItem('node', nodeId);
  if (groupItem) items.push(groupItem);
  items.push({ label: 'Delete', icon: '🗑️', danger: true, onClick: () => { store.select([nodeId], []); deleteSelection(); } });
  showContextMenu(evt.clientX, evt.clientY, items);
}

/** "Group" (right-click): the plain, no-shrink grouping action — previously
 * only reachable from the toolbar's contextual style row (🔗 icon), which
 * meant the right-click menu offered "Group & Shrink" with no way to just
 * group without collapsing. Same "act on the whole 2+ selection" gating as
 * groupAndShrinkMenuItem just below; returns null for a single-node
 * selection. */
function groupMenuItem(nodeId) {
  const sel = store.getSelection();
  if (sel.nodeIds.length < 2 || !sel.nodeIds.includes(nodeId)) return null;
  return { label: 'Group', icon: '🔗', onClick: groupSelection };
}

/** "Group & Shrink" (right-click): offered only when the right-clicked node
 * is part of a *current* multi-selection (2+ items) — same "act on the
 * whole selection, not just this one node" gating as
 * selectionAnimationMenuItem just below. Returns null (nothing pushed) for
 * a single-node selection. */
function groupAndShrinkMenuItem(nodeId) {
  const sel = store.getSelection();
  if (sel.nodeIds.length < 2 || !sel.nodeIds.includes(nodeId)) return null;
  return { label: 'Group & Shrink', icon: '📦', onClick: groupAndShrinkSelection };
}

/** Shared node/edge context-menu entry for Diagram Animation — toggles
 * whether this item is part of the animation's reveal sequence, without
 * requiring the animation panel to be open first. Removing acts on just
 * this one target even if it's grouped into a multi-target step alongside
 * others (see removeAnimationTarget). */
function animationMenuItem(targetType, targetId) {
  const step = findAnimationStepForTarget(targetType, targetId);
  return step
    ? { label: 'Remove from Animation', icon: '🎞️', onClick: () => removeAnimationTarget(step.id, targetType, targetId) }
    : { label: 'Add to Animation', icon: '🎞️', onClick: () => addAnimationStep({ targetType, targetId }) };
}

/** Offered only when the right-clicked item is part of a *current*
 * multi-selection (2+ items) — groups the whole selection into one new
 * step that reveals together, sharing a single order number (see
 * addAnimationStep and css/canvas.css's shared-badge styling). Returns null
 * (nothing pushed) for a single-item selection, where the plain
 * animationMenuItem() above already covers it one at a time. */
function selectionAnimationMenuItem(targetType, targetId) {
  const sel = store.getSelection();
  const count = sel.nodeIds.length + sel.edgeIds.length;
  const inSelection = targetType === 'node' ? sel.nodeIds.includes(targetId) : sel.edgeIds.includes(targetId);
  if (count < 2 || !inSelection) return null;
  return {
    label: `Add Selection to Animation (${count} items, one step)`,
    icon: '🎞️',
    onClick: () => addAnimationStep([
      ...sel.nodeIds.map((id) => ({ targetType: 'node', targetId: id })),
      ...sel.edgeIds.map((id) => ({ targetType: 'edge', targetId: id })),
    ]),
  };
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
  if (edge?.waypoints?.length) {
    items.push('separator');
    items.push({ label: 'Straighten connector (remove bend points)', icon: '📏', onClick: () => clearEdgeWaypoints(edgeId) });
  }
  items.push(
    'separator',
    { label: 'Duplicate', icon: '⧉', onClick: () => { store.select([], [edgeId]); duplicateSelection(); } },
    'separator',
    animationMenuItem('edge', edgeId),
  );
  const groupItem = selectionAnimationMenuItem('edge', edgeId);
  if (groupItem) items.push(groupItem);
  items.push({ label: 'Delete connector', icon: '🗑️', danger: true, onClick: () => { store.select([], [edgeId]); deleteSelection(); } });
  showContextMenu(evt.clientX, evt.clientY, items);
}

/** High-availability actions a user is likely to reach for from anywhere on
 * the canvas — surfaced here in addition to their usual toolbar/shortcut
 * homes, not instead of them. Command Palette/Undo/Redo/Auto-arrange/Check
 * Diagram/AI Design Review are each already reachable elsewhere; this menu
 * is a second, always-in-reach path so a user mid-diagram never has to hunt
 * across dropdowns for something this central. Command Palette, Check
 * Diagram, and AI Design Review are dispatched as sdb:open-* events (see
 * modals/commandPaletteModal.js, modals/diagramLintModal.js,
 * panel/aiReviewPanel.js) rather than imported directly, since each of
 * those files itself imports from this one — a direct import here would be
 * circular. */
function openCanvasContextMenu(evt) {
  const items = [
    { label: 'Command Palette…', icon: '⌘', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-command-palette')) },
    'separator',
    { label: 'Undo', icon: '↶', disabled: !store.canUndo(), onClick: () => store.undo() },
    { label: 'Redo', icon: '↷', disabled: !store.canRedo(), onClick: () => store.redo() },
    'separator',
    { label: 'Select all', icon: '▭', onClick: () => store.select(store.getState().nodes.map((n) => n.id), []) },
    { label: 'Fit to screen', icon: '🔍', onClick: fitToScreen },
    { label: 'Reset zoom to 100%', icon: '💯', onClick: () => viewport.zoomTo(1) },
    'separator',
    { label: 'Auto-arrange', icon: '🗺️', onClick: autoArrangeAll },
    { label: 'Check Diagram', icon: '🩺', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-diagram-lint')) },
    { label: 'AI Design Review', icon: '🤖', onClick: () => window.dispatchEvent(new CustomEvent('sdb:open-ai-review')) },
    'separator',
    { label: 'Add comment here', icon: '💬', onClick: () => addCommentAt(evt) },
    { label: 'Add sticky note here', icon: '🗒️', onClick: () => addStickyNote(viewport.screenToCanvas(evt.clientX, evt.clientY)) },
    'separator',
    { label: 'Duplicate entire canvas', icon: '⧉', onClick: duplicateEntireCanvas },
    { label: 'Duplicate as new project', icon: '📄', onClick: duplicateProjectAsNew },
    'separator',
    { label: 'Clear canvas', icon: '🧹', danger: true, onClick: clearCanvas },
  ];
  showContextMenu(evt.clientX, evt.clientY, items);
}

window.addEventListener('blur', hideContextMenu);
