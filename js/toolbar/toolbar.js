// Top toolbar: global actions (row 1) + contextual style editor (row 2,
// shown only while something is selected).
//
// Row 1 groups related one-off actions behind a handful of dropdown
// buttons (see toolbarDropdown.js) rather than laying every action out
// flat — a flat row grows unbounded as features are added and was the
// direct cause of a past mobile overflow bug (see docs/AI_AGENT_GUIDE.md
// "Add a toolbar button"). Frequently-used, always-relevant controls
// (undo/redo, the Select/Hand tool toggle, zoom) stay flat regardless.
//
// EVERY button — flat or inside a dropdown — must set a clear `title`
// describing what it does; see docs/AI_AGENT_GUIDE.md "Add a toolbar
// button" for the convention this file follows.
import * as store from '../core/store.js';
import { createEmptyProject, countUnresolvedComments } from '../core/project.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import {
  deleteSelection, duplicateSelection, groupSelection, ungroupSelection, selectionHasGroup, duplicateProjectAsNew,
  getSelectionScreenRect, autoArrangeAll, distributeSequenceDiagram, setFocusMode, setFlowSimulationEnabled,
  resolveComponentDef, fixTextDisplay, autoBuildAndPlayAnimation, addStickyNote, render as renderCanvas,
} from '../canvas/canvas.js';
import { getBaseToolMode, setToolMode, onToolModeChange } from '../canvas/toolMode.js';
import { onViewportChange, centerOn } from '../canvas/viewport.js';
import { renderNodeStyleEditor } from './styleEditor.js';
import { renderEdgeStyleEditor } from './arrowEditor.js';
import { renderZoomControls } from './zoomControls.js';
import { buildToolbarDropdown, onDropdownOpenChange } from './toolbarDropdown.js';
import { exportProjectToFile, pickJSONFile, parseProjectFile } from '../io/fileIO.js';
import { exportPNG } from '../io/exportImage.js';
import { exportPDF } from '../io/exportPdf.js';
import { exportSVG } from '../io/exportSvg.js';
import { openSaveAsModal } from '../modals/saveAsModal.js';
import { openLoadProjectModal } from '../modals/loadProjectModal.js';
import { openGlobalSearchModal } from '../modals/globalSearchModal.js';
import { openCustomComponentModal } from '../modals/customComponentModal.js';
import { openSaveComponentGroupModal } from '../modals/saveComponentGroupModal.js';
import { openCustomShapeModal } from '../modals/customShapeModal.js';
import { openDefaultSettingsModal } from '../modals/defaultSettingsModal.js';
import { openBackupModal } from '../modals/backupModal.js';
import { openWhatsNewModal } from '../modals/whatsNewModal.js';
import { openKeyboardShortcutsModal } from '../modals/keyboardShortcutsModal.js';
import { getComponentById, CATEGORIES } from '../data/index.js';

const CATEGORY_LABEL_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c.label]));
import { openReplicationModal } from '../modals/replicationModal.js';
import { openAiEditModal } from '../modals/aiEditModal.js';
import { openAiConversationModal } from '../modals/aiConversationModal.js';
import { openAiLayoutModal } from '../modals/aiLayoutModal.js';
import { openDiagramDescriptionModal } from '../modals/diagramDescriptionModal.js';
import { openInterviewModeModal } from '../modals/interviewModeModal.js';
import { openImportFromUrlModal } from '../modals/importFromUrlModal.js';
import { openSystemMapModal } from '../modals/systemMapModal.js';
import { openExportPosterModal } from '../modals/exportPosterModal.js';
import { openReviewStatusModal } from '../modals/reviewStatusModal.js';
import { onInterviewChange, getRemainingMs, formatRemaining } from '../core/interviewMode.js';
import { setScene3DActive } from '../core/scene3dMode.js';
import { openSequenceDiagramModal } from '../modals/sequenceDiagramModal.js';
import { openTemplateGalleryModal } from '../modals/templateGalleryModal.js';
import { openDemoProjectsModal } from '../modals/demoProjectsModal.js';
import { openImportSequenceMermaidModal } from '../modals/importSequenceMermaidModal.js';
import { openImportSqlModal } from '../modals/importSqlModal.js';
import { openC4ContextModal } from '../modals/c4ContextModal.js';
import { openExportDiagramModal } from '../modals/exportDiagramModal.js';
import { openShareLinkModal } from '../modals/shareLinkModal.js';
import { openVersionHistoryModal } from '../modals/versionHistoryModal.js';
import { openHistoryTimelineModal } from '../modals/historyTimelineModal.js';
import { openPresentationsModal } from '../modals/presentationsModal.js';
import { openDiagramLintModal } from '../modals/diagramLintModal.js';
import { openCommentsListModal } from '../modals/commentsListModal.js';
import { openScaleDiagramModal } from '../modals/scaleDiagramModal.js';
import { openFindReplaceModal } from '../modals/findReplaceModal.js';
import { openDiagramThemeModal } from '../modals/diagramThemeModal.js';
import { setMinimapVisible } from '../canvas/minimap.js';
import { toggleOutlinePanel } from '../panel/outlinePanel.js';
import { toggleAnimationPanel } from '../panel/animationPanel.js';
import { initProjectTabsBar } from './projectTabsBar.js';
import { initPinnedActionsBar } from './pinnedActionsBar.js';
import { openAddTabModal } from '../modals/addTabModal.js';
import { openCommandPaletteModal } from '../modals/commandPaletteModal.js';
import { openCostBreakdownModal } from '../modals/costBreakdownModal.js';
// Registers this modal's `sdb:open-subdiagram` window listener (see
// modals/subDiagramModal.js) — reached from the 🔍 icon on a sequence-
// diagram group's canvas background, not from a toolbar button of its own,
// so nothing else here calls it directly; the import alone is what's needed.
import '../modals/subDiagramModal.js';
// Same reasoning as subDiagramModal.js just above — reached only via the
// `sdb:open-comment` event (see canvas.js#addCommentAt/#addCommentAtCenter
// and canvas/commentPins.js's pin click handler), not a toolbar button.
import '../modals/commentModal.js';
import { toggleAiReviewPanel, openWithAutoSuggestions } from '../panel/aiReviewPanel.js';
import { toggleAiChatPanel } from '../panel/aiChatPanel.js';
import { openCliSetupModal } from '../modals/cliSetupModal.js';
import { initAutoSuggestWatcher } from '../io/autoSuggestWatcher.js';
import { initLintWatcher } from '../io/lintWatcher.js';
import { openGenerateDesignModal } from '../modals/generateDesignModal.js';
import { openImportFromImageModal } from '../modals/importFromImageModal.js';
import { openQuickStartModal } from '../modals/quickStartModal.js';
import { openCollaborationModal, isCollabConnected, onCollabStatusChange } from '../modals/collaborationModal.js';
import { confirmAction } from '../modals/confirmModal.js';
import { showToast } from '../utils/toast.js';
import { resetHints, areHintsEnabled, setHintsEnabled } from '../hints/hints.js';
import { openOnboardingChecklistWidget } from '../hints/onboardingChecklistWidget.js';
import { getUiPrefs, saveUiPrefs, onUiPrefsChange, THEME_MODES, LANGUAGES } from '../io/uiPrefs.js';
import { t, getLanguage, setLanguage } from '../io/i18n.js';
import { setTheme } from '../io/theme.js';
import { isKioskMode, toggleKioskMode, onKioskModeChange } from '../core/kioskMode.js';
import { onSuggestionsVisibilityChange } from '../canvas/suggestions.js';
import { FEATURE_PACKS, isPackEnabled } from '../core/featureLevels.js';
import { getFeatureLevelPrefs, onFeatureLevelChange } from '../io/featureLevelPrefs.js';

let contextRow = null;
let toolbarRootEl = null;
let undoBtn = null;
let redoBtn = null;
let deleteBtn = null;
let duplicateBtn = null;
// Whether the contextual style-editor row is shrunk to a slim header strip
// (see renderContextRow) — reset to expanded each time the row goes from
// hidden to shown, same convention as the details panel always opening
// expanded for a newly opened component.
let contextCollapsed = false;
// The selection last passed to renderContextRow — kept so viewport pan/zoom
// and window-resize triggers (which don't carry a selection of their own)
// can still reposition the floating row against whatever's still selected.
let lastSelection = { nodeIds: [], edgeIds: [] };
// Whether any toolbar dropdown panel (File/Create/Tools/Help) is currently
// open — floating mode hides itself while true (see
// updateFloatingDropdownGate) rather than risk visually covering, or being
// covered by, that other floating panel.
let anyDropdownOpen = false;
// Canvas element search — see buildCanvasSearchGroup(). Kept separate from
// the sidebar's own search (which searches the *component library*, not
// what's already placed): `searchMatches` is the current query's node/edge
// hits, `searchIndex` which one Enter last jumped to (for cycling), and the
// input/count elements are kept so runCanvasSearch can update the "N of M"
// label without a full toolbar re-render.
let searchMatches = [];
let searchIndex = -1;
let canvasSearchInput = null;
let canvasSearchCount = null;

const EDGE_MARGIN = 8;

/** Assembles one dropdown panel's contents from an always-visible "core"
 * list plus zero or more pack-gated sections — see core/featureLevels.js.
 * Every pack's buttons are always built and inserted (behind their own
 * `.toolbar-dropdown-section-label` header, wrapped in one
 * `.toolbar-dropdown-pack-section[data-pack-id]` container) — grouping
 * this app's largest dropdown (Tools, 24+ buttons) into labeled sections
 * is valuable regardless of whether anything is actually hidden. Whether a
 * section starts *hidden* reflects the feature-level prefs at build time;
 * `refreshPackSectionVisibility` (called from `onFeatureLevelChange`)
 * re-derives that later without rebuilding any button, so none of a
 * pack's buttons ever lose the live subscriptions/badges they set up when
 * first created. A section with an empty `buttons` array is skipped
 * outright (a pack that contributed nothing to this particular panel).
 *
 * Only the `'tools'` dropdown's sections get a clickable, collapsible
 * label (persisted per-packId in `io/uiPrefs.js#collapsedToolsSections`) —
 * File and Create's own sections stay plain, non-interactive headers, since
 * Tools is the one dropdown long enough (5 sections, 24+ buttons) for
 * collapsing to actually help. The buttons themselves always live in a
 * separate inner `.toolbar-dropdown-section-body` wrapper so collapsing
 * only hides *that*, never the label — matches
 * `toolbarDropdown.js#filterDropdownPanel`'s expectation of finding one.
 * @param {string} dropdownId 'file' | 'create' | 'tools' — gates whether
 *   this panel's sections get the collapsible-label treatment
 * @param {HTMLElement[]} coreButtons
 * @param {{packId: string, buttons: HTMLElement[]}[]} packSections
 */
function buildGatedButtonList(dropdownId, coreButtons, packSections) {
  const prefs = getFeatureLevelPrefs();
  const collapsed = new Set(getUiPrefs().collapsedToolsSections);
  const out = [...coreButtons];
  for (const { packId, buttons } of packSections) {
    if (!buttons.length) continue;
    const pack = FEATURE_PACKS.find((p) => p.id === packId);
    const section = el('div', { class: 'toolbar-dropdown-pack-section', 'data-pack-id': packId, hidden: !isPackEnabled(prefs, packId) });
    const body = el('div', { class: 'toolbar-dropdown-section-body' });
    for (const b of buttons) body.appendChild(b);
    if (dropdownId === 'tools') {
      const startCollapsed = collapsed.has(packId);
      body.classList.toggle('collapsed', startCollapsed);
      const chevron = el('span', { class: 'toolbar-dropdown-section-chevron', text: startCollapsed ? '▸' : '▾', 'aria-hidden': 'true' });
      const labelBtn = el('button', {
        type: 'button',
        class: 'toolbar-dropdown-section-label toolbar-dropdown-section-toggle',
        title: `${pack.description} Click to ${startCollapsed ? 'expand' : 'collapse'}.`,
        'aria-expanded': String(!startCollapsed),
        onClick: () => {
          const next = !body.classList.contains('collapsed');
          body.classList.toggle('collapsed', next);
          labelBtn.setAttribute('aria-expanded', String(!next));
          labelBtn.title = `${pack.description} Click to ${next ? 'expand' : 'collapse'}.`;
          chevron.textContent = next ? '▸' : '▾';
          const current = new Set(getUiPrefs().collapsedToolsSections);
          if (next) current.add(packId); else current.delete(packId);
          saveUiPrefs({ collapsedToolsSections: [...current] });
        },
      }, [chevron, el('span', { text: `${pack.icon} ${pack.label}` })]);
      section.appendChild(labelBtn);
    } else {
      section.appendChild(el('div', { class: 'toolbar-dropdown-section-label', text: `${pack.icon} ${pack.label}`, title: pack.description }));
    }
    section.appendChild(body);
    out.push(section);
  }
  return out;
}

/** Re-applies the current Basic/Advanced/Custom choice to every already-
 * built `.toolbar-dropdown-pack-section` inside one dropdown panel's root
 * — see buildGatedButtonList's header comment for why this exists instead
 * of rebuilding the panel's buttons. */
function refreshPackSectionVisibility(panelRoot) {
  const prefs = getFeatureLevelPrefs();
  panelRoot.querySelectorAll('.toolbar-dropdown-pack-section').forEach((section) => {
    section.hidden = !isPackEnabled(prefs, section.dataset.packId);
  });
}

export function initToolbar(root) {
  root.classList.add('toolbar');
  toolbarRootEl = root;

  const row1 = el('div', { class: 'toolbar-row toolbar-row-main' });
  row1.appendChild(buildBrand());
  row1.appendChild(buildHistoryGroup());
  row1.appendChild(buildCommandPaletteGroup());
  row1.appendChild(buildNavToolGroup());
  row1.appendChild(buildQuickCreateGroup());
  const fileDropdown = buildToolbarDropdown(t('toolbar.file'), '🗂️', t('toolbar.file.title'), buildFileGroupButtons());
  const createDropdown = buildToolbarDropdown(t('toolbar.create'), '✨', t('toolbar.create.title'), buildCreateGroupButtons());
  row1.appendChild(fileDropdown);
  row1.appendChild(createDropdown);
  const spacer = el('div', { class: 'toolbar-spacer' });
  row1.appendChild(spacer);
  row1.appendChild(renderZoomControls());
  const toolsDropdown = buildToolbarDropdown(t('toolbar.tools'), '🛠️', t('toolbar.tools.title'), buildToolsGroupButtons(), { searchable: true });
  row1.appendChild(toolsDropdown);
  row1.appendChild(buildToolbarDropdown(t('toolbar.help'), '❓', t('toolbar.help.title'), buildHelpGroupButtons()));
  // Every pack's buttons are always built (see buildGatedButtonList) —
  // only their `.toolbar-dropdown-pack-section` wrapper's `hidden` reflects
  // the current Basic/Advanced/Custom choice. So a settings change never
  // needs to rebuild these panels (which would mean tearing down and
  // recreating live badge subscriptions like the AI auto-suggest/comments/
  // interview-timer/review-status badges — easy to leak): it just flips
  // `hidden` on whichever sections changed. See
  // io/featureLevelPrefs.js's header comment for why this listens on its
  // own narrow pub-sub rather than uiPrefs.js's much noisier one.
  onFeatureLevelChange(() => {
    for (const panelRoot of [fileDropdown, createDropdown, toolsDropdown]) refreshPackSectionVisibility(panelRoot);
  });
  // Appended last (not before the spacer): at common desktop widths this
  // row already has zero slack (the row-main children's combined width
  // sits right at the container edge — see git history around the canvas
  // search feature's introduction), so *any* new item inserted earlier in
  // the flow shifts the flex-wrap line-break point and can drag an extra
  // dropdown trigger onto row 2 with it, in an unpredictable spot. Adding
  // this last instead means it's always the thing that wraps (if
  // anything does), leaving File/Create/Tools/Help's own wrap behavior
  // undisturbed — this is what fixed a real bug where a wrapped Help panel
  // landed on top of the first-run tour's hint bubble.
  row1.appendChild(buildCanvasSearchGroup());
  // Also appended last, same reasoning as buildCanvasSearchGroup() above —
  // this is a rarely-toggled accessibility/discoverability aid, not a
  // continuously-used control, so it's fine to be the thing that wraps.
  const descBtn = el('button', {
    type: 'button',
    class: `btn${getUiPrefs().showActionDescriptions ? ' active' : ''}`,
    title: 'Show Action Descriptions: display every dropdown button\'s tooltip explanation inline, instead of only on hover — handy when browsing many actions at once, or on a touch device',
    text: '📖 Show Descriptions',
    onClick: () => {
      const next = !getUiPrefs().showActionDescriptions;
      saveUiPrefs({ showActionDescriptions: next });
      descBtn.classList.toggle('active', next);
    },
  });
  row1.appendChild(descBtn);
  root.appendChild(row1);

  // Hidden (not just empty) until the user has pinned at least one action —
  // see toolbar/pinnedActionsBar.js's own header comment.
  const pinnedActionsRow = el('div', { class: 'toolbar-row toolbar-row-pinned', hidden: true });
  root.appendChild(pinnedActionsRow);
  initPinnedActionsBar(pinnedActionsRow);

  // Hidden (not just empty) until a second tab actually exists — see
  // toolbar/projectTabsBar.js's own header comment.
  const tabsRow = el('div', { class: 'toolbar-row toolbar-row-tabs', hidden: true });
  root.appendChild(tabsRow);
  initProjectTabsBar(tabsRow);

  // Not appended anywhere yet — mountContextRow() (inside renderContextRowInner)
  // moves this single persistent element into whichever container matches
  // the current display mode (pinned to #toolbar, pinned as the last child
  // of #app, or floating directly under document.body) — see "Contextual
  // style-editor row" in docs/ARCHITECTURE.md for why one element is reused
  // across modes instead of building a separate one per mode.
  contextRow = el('div', { class: 'toolbar-row toolbar-row-context', hidden: true });

  store.subscribe('selection', renderContextRow);
  store.subscribe('change', () => {
    renderContextRow(store.getSelection());
    syncHistoryButtons();
  });
  // Floating mode needs repositioning on its own triggers beyond selection/
  // data changes: panning/zooming moves the selected node on screen without
  // any store change, and the window can simply be resized.
  onViewportChange(() => positionFloatingRow());
  window.addEventListener('resize', () => positionFloatingRow());
  // #canvas-viewport itself can also resize without the window doing so —
  // opening/closing the details or AI review panel animates its width over
  // 180ms (see css/layout.css), and neither panel has any pub-sub of its
  // own to hook (they're plain classList.toggle('open') with no event).
  // A ResizeObserver on the one element positionFloatingRow's bounds
  // actually depend on is the general fix: it fires for *any* reason that
  // element's box changes — repeatedly during the panel's own open/close
  // transition too, which keeps the card tracking smoothly instead of
  // jumping once at the end — rather than chasing down every individual
  // trigger (a stale-position bug caught by "paste an AI response" timing
  // out because the floating card, positioned before the AI panel opened
  // and shrank the canvas, silently drifted over that panel's own button).
  if (window.ResizeObserver) {
    const canvasViewportEl = document.getElementById('canvas-viewport');
    if (canvasViewportEl) new ResizeObserver(() => positionFloatingRow()).observe(canvasViewportEl);
  }
  // The Default Settings modal can also change the mode directly.
  onUiPrefsChange(() => renderContextRow(store.getSelection()));
  onDropdownOpenChange((open) => { anyDropdownOpen = open; updateFloatingDropdownGate(); });
  // The "Smart Suggestions" banner (canvas/suggestions.js) is its own
  // `position: fixed` element pinned to the bottom-center of the screen,
  // shown right after placing a component with a curated companion — it
  // can appear (and disappear again after ~9s, or a self-dismiss) without
  // any selection/data/canvas-size change of its own, so it needs its own
  // reposition trigger too; see positionFloatingRow's own bounds-shrinking
  // for how this is actually used.
  onSuggestionsVisibilityChange(() => positionFloatingRow());

  renderContextRow(store.getSelection());
  syncHistoryButtons();
}

function group(...children) {
  const wrap = el('div', { class: 'toolbar-group' });
  for (const c of children) wrap.appendChild(c);
  return wrap;
}

function buildBrand() {
  const menuBtn = el('button', {
    type: 'button',
    class: 'btn btn-icon sidebar-toggle-btn',
    title: 'Toggle component library',
    'aria-label': 'Toggle component library',
    text: '☰',
    onClick: () => document.querySelector('.sidebar')?.classList.toggle('open'),
  });
  return el('div', { class: 'toolbar-brand' }, [
    menuBtn,
    el('span', { class: 'brand-icon', text: '🧩', 'aria-hidden': 'true' }),
    el('span', { class: 'brand-title', text: 'System Design Diagram Builder' }),
  ]);
}

function buildHistoryGroup() {
  undoBtn = el('button', { type: 'button', class: 'btn btn-icon', title: `${t('toolbar.undo')} (Ctrl+Z)`, 'aria-label': t('toolbar.undo'), text: '↶', onClick: () => store.undo() });
  redoBtn = el('button', { type: 'button', class: 'btn btn-icon', title: `${t('toolbar.redo')} (Ctrl+Shift+Z)`, 'aria-label': t('toolbar.redo'), text: '↷', onClick: () => store.redo() });
  return group(undoBtn, redoBtn);
}

function syncHistoryButtons() {
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
}

/** Kept flat (not in a dropdown) — it's the fastest way to reach *any*
 * other action or add *any* component, so burying it behind a click would
 * defeat the point. See modals/commandPaletteModal.js. */
function buildCommandPaletteGroup() {
  const btn = el('button', {
    type: 'button', class: 'btn btn-icon', title: 'Quick Actions (Ctrl/Cmd+K): search actions or add a component', 'aria-label': 'Quick Actions', text: '⌘',
    onClick: () => openCommandPaletteModal(),
  });
  return group(btn);
}

/** Select (default click/marquee-drag) vs Hand (pan-anywhere, never moves a
 * component) tool toggle — see canvas/toolMode.js. Kept flat (not in a
 * dropdown) since it's a mode switched constantly while working, not a
 * one-off action. Holding Space temporarily switches to Hand no matter
 * which of these is pressed; releasing it restores whichever was active. */
function buildNavToolGroup() {
  const selectBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: `${t('toolbar.selectTool')} (V): click to select, drag empty space to marquee-select`, 'aria-label': t('toolbar.selectTool'), text: '🖱️',
    onClick: () => setToolMode('select'),
  });
  const handBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: `${t('toolbar.handTool')} (H, or hold Space): drag anywhere to pan the canvas without moving components`, 'aria-label': t('toolbar.handTool'), text: '✋',
    onClick: () => setToolMode('hand'),
  });
  const sync = () => {
    const active = getBaseToolMode();
    selectBtn.classList.toggle('active', active === 'select');
    handBtn.classList.toggle('active', active === 'hand');
  };
  onToolModeChange(sync);
  sync();
  return group(selectBtn, handBtn);
}

/** "Add Shape" stays flat (not in a dropdown) — it's a quick, frequent,
 * one-click action used while actively drawing a diagram, not an
 * occasional setup/admin action like the rest of Create/Tools, so burying
 * it behind a dropdown click would slow down exactly the moment it's
 * needed. (The former "🪄 Magic Arrow" toggle that used to live next to it
 * was removed — every connector already gets the same obstacle-avoiding
 * routing by default now, see connector.js#buildEdgePath, so arming it
 * ahead of a draw never did anything the default didn't already do. The
 * 'magic' routing value itself — and its glow style — still exists and
 * stays reachable per-edge from the arrow editor's Routing dropdown for
 * anyone who wants it explicitly.) */
function buildQuickCreateGroup() {
  const addShapeBtn = el('button', { type: 'button', class: 'btn', title: 'Add a basic shape', text: '🔷 Add Shape', onClick: openCustomShapeModal });
  // Same "quick, frequent, one-click" reasoning as Add Shape above, but
  // skips its picker modal entirely — a sticky note is used often enough,
  // and is unambiguous enough (there's only one), that a second click to
  // confirm "yes, a sticky note" would just be friction. See
  // canvas.js#addStickyNote for the small styling defaults (no icon, a
  // slight random tilt) this quick-add path gives it that dragging the
  // "Sticky Note" library item itself doesn't.
  const addNoteBtn = el('button', { type: 'button', class: 'btn', title: 'Add a sticky note for free-form comments', text: '🗒️ Add Sticky Note', onClick: () => addStickyNote() });
  return group(addShapeBtn, addNoteBtn);
}

/** Searches components/connectors already placed *on the canvas* by their
 * text/label — distinct from the sidebar's search, which searches the
 * component *library* to add something new. Selects and centers the
 * viewport (without changing zoom, so the jump doesn't disorient) on the
 * first match as you type; Enter/Shift+Enter cycle forward/backward
 * through the rest without re-searching, same convention as a browser's
 * own page-search "N of M" behavior. */
function buildCanvasSearchGroup() {
  const wrap = el('div', { class: 'toolbar-canvas-search' });
  wrap.appendChild(el('span', { class: 'toolbar-canvas-search-icon', text: '🔎', 'aria-hidden': 'true' }));
  canvasSearchInput = el('input', {
    type: 'search',
    placeholder: 'Find on canvas…',
    title: 'Find a component or connector already on the canvas, by name/label',
    'aria-label': 'Find a component or connector on the canvas',
    onInput: (e) => runCanvasSearch(e.target.value),
    onKeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      jumpToMatch(e.shiftKey ? -1 : 1);
    },
  });
  canvasSearchCount = el('span', { class: 'toolbar-canvas-search-count', hidden: true });
  wrap.appendChild(canvasSearchInput);
  wrap.appendChild(canvasSearchCount);
  return wrap;
}

/** Canvas-space center point to pan to for a search match — a node's own
 * center, or the midpoint between the two nodes a matching connector
 * spans (its label sits roughly there, and it puts both endpoints on
 * screen at once). */
function matchCenter(match, state) {
  if (match.type === 'node') {
    const n = state.nodes.find((x) => x.id === match.id);
    return n && { x: n.x + n.w / 2, y: n.y + n.h / 2 };
  }
  const e = state.edges.find((x) => x.id === match.id);
  if (!e) return null;
  const from = state.nodes.find((n) => n.id === e.from);
  const to = state.nodes.find((n) => n.id === e.to);
  if (!from || !to) return null;
  return {
    x: (from.x + from.w / 2 + to.x + to.w / 2) / 2,
    y: (from.y + from.h / 2 + to.y + to.h / 2) / 2,
  };
}

/** Whether `node` should count as a match for `q` beyond its own visible
 * name — a loose, offline "understands what this is" fallback: matches the
 * category label or any search tag of the underlying library component
 * (e.g. "database" finds every node built from a `category: 'databases'`
 * or `tags: ['database', ...]` component, regardless of what the user
 * actually renamed it to). Deliberately not a real NLP/AI match — just
 * reusing metadata this app's own library already carries — so it costs
 * nothing, needs no setup, and is safe to run on every keystroke. */
function nodeMatchesCategoryOrTag(node, q) {
  if (!node.defId) return false;
  const def = getComponentById(node.defId);
  if (!def) return false;
  const category = CATEGORY_LABEL_BY_ID.get(def.categoryId)?.toLowerCase() || '';
  if (category.includes(q)) return true;
  return (def.tags || []).some((tag) => tag.toLowerCase().includes(q));
}

function runCanvasSearch(query) {
  const q = query.trim().toLowerCase();
  searchIndex = -1;
  if (!q) {
    searchMatches = [];
    canvasSearchCount.hidden = true;
    return;
  }
  const state = store.getState();
  const nameMatches = [
    ...state.nodes.filter((n) => n.text?.toLowerCase().includes(q)).map((n) => ({ type: 'node', id: n.id })),
    ...state.edges.filter((e) => e.label?.toLowerCase().includes(q)).map((e) => ({ type: 'edge', id: e.id })),
  ];
  // Only reached when nothing matched by name — a query specific enough to
  // hit a real name shouldn't also drag in every same-category node the
  // user didn't mean.
  const categoryMatches = nameMatches.length ? [] : state.nodes
    .filter((n) => nodeMatchesCategoryOrTag(n, q))
    .map((n) => ({ type: 'node', id: n.id }));
  searchMatches = [...nameMatches, ...categoryMatches];
  canvasSearchCount.hidden = false;
  canvasSearchCount.textContent = searchMatches.length ? `1/${searchMatches.length}` : 'No matches';
  canvasSearchCount.classList.toggle('no-matches', !searchMatches.length);
  if (searchMatches.length) jumpToMatch(1, { fromZero: true });
}

/** Moves `searchIndex` by `delta` (wrapping around both ends) and jumps
 * there — selects the match and centers the viewport on it. `fromZero`
 * (used right after a fresh search) starts from the first match instead
 * of stepping relative to whatever `searchIndex` was left at. */
function jumpToMatch(delta, { fromZero = false } = {}) {
  if (!searchMatches.length) return;
  searchIndex = fromZero ? 0 : (searchIndex + delta + searchMatches.length) % searchMatches.length;
  canvasSearchCount.textContent = `${searchIndex + 1}/${searchMatches.length}`;
  const match = searchMatches[searchIndex];
  const state = store.getState();
  const center = matchCenter(match, state);
  if (center) centerOn(center.x, center.y);
  if (match.type === 'node') store.select([match.id], []);
  else store.select([], [match.id]);
}

function buildFileGroupButtons() {
  const newBtn = el('button', {
    type: 'button', class: 'btn', title: 'New diagram', text: '🆕 New',
    onClick: async () => {
      const ok = await confirmAction({
        title: 'Start a new diagram?',
        message: 'This clears the canvas. If you want to keep the current diagram, use "Save As" first — undo (Ctrl/Cmd+Z) can also bring it right back.',
        confirmLabel: 'Start new',
        danger: false,
      });
      if (ok) store.loadProject(createEmptyProject());
    },
  });
  const saveAsBtn = el('button', { type: 'button', class: 'btn', title: 'Save this diagram with a name', text: '💾 Save As', onClick: openSaveAsModal });
  const loadBtn = el('button', { type: 'button', class: 'btn', title: 'Load a saved diagram', text: '📂 Load', onClick: openLoadProjectModal });
  const globalSearchBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'Search All Projects: find text across every saved project in this browser, not just the one open now',
    text: '🔎 Search All Projects',
    onClick: openGlobalSearchModal,
  });
  const addTabBtn = el('button', { type: 'button', class: 'btn', title: 'Open another diagram in a new tab, switchable from a tab strip without reloading each time', text: '🗂️ Open in New Tab...', onClick: openAddTabModal });
  const duplicateProjectBtn = el('button', {
    type: 'button', class: 'btn', title: 'Duplicate this project into a new one (the original stays untouched)', text: '📄 Duplicate project',
    onClick: duplicateProjectAsNew,
  });
  const exportJsonBtn = el('button', { type: 'button', class: 'btn', title: 'Export project as JSON', text: '⬇️ Export JSON', onClick: () => exportProjectToFile(store.getState()) });
  const importJsonBtn = el('button', {
    type: 'button', class: 'btn', title: 'Import project from JSON', text: '⬆️ Import JSON',
    onClick: async () => {
      const text = await pickJSONFile();
      if (!text) return;
      const result = parseProjectFile(text);
      if (!result.ok) { showToast(`Could not load file: ${result.error}`, 'error'); return; }
      store.loadProject(result.project);
      showToast(`Loaded "${result.project.name}".`, 'success');
    },
  });
  const importUrlBtn = el('button', {
    type: 'button', class: 'btn', title: 'Import a diagram JSON hosted elsewhere — a GitHub raw file link, a public Gist, or any URL that returns this app\'s JSON format', text: '🔗 Import from URL/Gist',
    onClick: openImportFromUrlModal,
  });
  const systemMapBtn = el('button', {
    type: 'button', class: 'btn', title: 'System Map: a visual graph of every saved diagram and how they relate to each other — click one to open it', text: '🗺️ System Map',
    onClick: openSystemMapModal,
  });
  const pngBtn = el('button', {
    type: 'button', class: 'btn', title: 'Export diagram as PNG image', text: '🖼️ Export PNG',
    onClick: async () => {
      showToast('Rendering PNG…', 'info', 1500);
      const result = await exportPNG(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    },
  });
  const pdfBtn = el('button', {
    type: 'button', class: 'btn', title: 'Export diagram as PDF', text: '📄 Export PDF',
    onClick: async () => {
      showToast('Rendering PDF…', 'info', 1500);
      const result = await exportPDF(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    },
  });
  const exportPosterBtn = el('button', {
    type: 'button', class: 'btn', title: 'Export PDF (Poster): splits a large diagram across several same-size printable pages to assemble into one big poster', text: '🧩 Export PDF (Poster)',
    onClick: openExportPosterModal,
  });
  const svgBtn = el('button', {
    type: 'button', class: 'btn', title: 'Export diagram as a vector SVG image — scales to any size with no quality loss',
    text: '🔺 Export SVG',
    onClick: async () => {
      const result = await exportSVG(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    },
  });
  const backupBtn = el('button', { type: 'button', class: 'btn', title: 'Backup & restore everything, and choose where it\'s all stored (localStorage or IndexedDB)', text: '🗄️ Backup & Restore', onClick: openBackupModal });
  const exportDiagramBtn = el('button', { type: 'button', class: 'btn', title: 'Export the whole diagram to Mermaid, draw.io, or Lucidchart', text: '🌐 Export to...', onClick: openExportDiagramModal });
  const shareBtn = el('button', { type: 'button', class: 'btn', title: 'Get a shareable link that encodes this diagram (no backend — a local copy for whoever opens it)', text: '🔗 Share', onClick: openShareLinkModal });
  const versionHistoryBtn = el('button', { type: 'button', class: 'btn', title: 'Save named snapshots of this diagram, revert to one, or compare two', text: '📸 Version History', onClick: openVersionHistoryModal });
  const historyTimelineBtn = el('button', { type: 'button', class: 'btn', title: 'Visual undo/redo timeline — jump straight to any past step instead of pressing undo repeatedly', text: '🕘 Undo History', onClick: openHistoryTimelineModal });
  const presentationsBtn = el('button', { type: 'button', class: 'btn', title: 'Build a slideshow out of saved versions, play it, or export it to PowerPoint', text: '🎬 Presentations', onClick: openPresentationsModal });
  // Core: the file lifecycle actions anyone needs regardless of experience
  // level (create/save/load/duplicate/basic export). Everything else here
  // is comparatively occasional/specialized — bulk-search, multi-diagram
  // navigation, less-common export formats, versioning/history, backups —
  // and lives behind the 'advanced-io' pack (see core/featureLevels.js).
  return buildGatedButtonList(
    'file',
    [newBtn, saveAsBtn, loadBtn, duplicateProjectBtn, exportJsonBtn, importJsonBtn, pngBtn, pdfBtn],
    [{ packId: 'advanced-io', buttons: [globalSearchBtn, addTabBtn, importUrlBtn, systemMapBtn, exportPosterBtn, svgBtn, exportDiagramBtn, shareBtn, versionHistoryBtn, historyTimelineBtn, presentationsBtn, backupBtn] }],
  );
}

function buildCreateGroupButtons() {
  const newComponentBtn = el('button', {
    type: 'button', class: 'btn', title: 'Build a custom saved component', text: '✨ New Component',
    onClick: () => {
      const selection = store.getSelection();
      const state = store.getState();
      const seedFromNode = selection.nodeIds.length === 1 ? state.nodes.find((n) => n.id === selection.nodeIds[0]) : null;
      openCustomComponentModal({ seedFromNode });
    },
  });
  const quickStartBtn = el('button', { type: 'button', class: 'btn', title: 'New to this app? Describe your system in plain words and let AI propose a starting diagram, with an explanation of its choices', text: '🪄 AI Quick Start', onClick: openQuickStartModal });
  const generateDesignBtn = el('button', { type: 'button', class: 'btn', title: 'Generate a design from a spec, with AI help', text: '🧠 Generate Design', onClick: openGenerateDesignModal });
  const importFromImageBtn = el('button', { type: 'button', class: 'btn', title: 'Import a diagram from an image (screenshot, photo, or sketch), with AI help', text: '🖼️ Import from Image', onClick: openImportFromImageModal });
  const aiEditBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'Edit with AI: describe a change in plain language and apply it as a patch to the current diagram, with AI help',
    text: '💬 Edit with AI',
    onClick: openAiEditModal,
  });
  const aiConversationBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'AI Conversation: an ongoing back-and-forth about this diagram — every message carries the full conversation so far, so your AI (including an AI CLI tool) never needs re-briefing',
    text: '🗨️ AI Conversation',
    onClick: openAiConversationModal,
  });
  const replicateBtn = el('button', { type: 'button', class: 'btn', title: 'Replicate: link components to auto-mirror across two sides', text: '🔁 Replicate', onClick: openReplicationModal });
  const sequenceDiagramBtn = el('button', { type: 'button', class: 'btn', title: 'Create a sequence/communication-flow diagram: titled lifelines with messages between them', text: '🔀 Sequence Diagram', onClick: openSequenceDiagramModal });
  const importMermaidBtn = el('button', { type: 'button', class: 'btn', title: 'Import a sequence diagram from pasted Mermaid sequenceDiagram text', text: '📥 Import from Mermaid', onClick: openImportSequenceMermaidModal });
  const importSqlBtn = el('button', { type: 'button', class: 'btn', title: 'Import an ER diagram from pasted SQL CREATE TABLE statements', text: '📥 Import from SQL', onClick: openImportSqlModal });
  const c4ContextBtn = el('button', { type: 'button', class: 'btn', title: 'Create a C4 Model System Context diagram: a central system, its users, and external systems it depends on', text: '🧩 C4 Context Diagram', onClick: openC4ContextModal });
  const defaultsBtn = el('button', { type: 'button', class: 'btn', title: 'Default settings for new components', text: '🎛️ Default Settings', onClick: openDefaultSettingsModal });
  const templateGalleryBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'Template Gallery: browse Reference Architectures and Design Patterns visually, with a preview thumbnail for each',
    text: '🖼️ Template Gallery',
    onClick: openTemplateGalleryModal,
  });
  const demoProjectsBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'Demo Projects: load a ready-made example diagram showing off a different diagram kind (or a combo of two), and clear it again when done',
    text: '🎓 Demo Projects',
    onClick: openDemoProjectsModal,
  });
  // Core: building blocks and beginner on-ramps (New Component, both AI
  // starting-point wizards, the two browse-first-then-drop entry points,
  // and Default Settings itself — which now also hosts the Feature Level
  // section, so it must never be gated behind its own setting). The two
  // more specialized AI actions and the diagram-type-specific wizards
  // (sequence diagrams, C4, Replicate, Mermaid/SQL import) live behind
  // packs — see core/featureLevels.js.
  return buildGatedButtonList(
    'create',
    [newComponentBtn, quickStartBtn, generateDesignBtn, templateGalleryBtn, demoProjectsBtn, defaultsBtn],
    [
      { packId: 'ai-tools', buttons: [importFromImageBtn, aiEditBtn, aiConversationBtn] },
      { packId: 'diagram-types', buttons: [replicateBtn, sequenceDiagramBtn, importMermaidBtn, importSqlBtn, c4ContextBtn] },
    ],
  );
}

function buildToolsGroupButtons() {
  const prefs = getUiPrefs();
  const gridBtn = el('button', {
    type: 'button', class: 'btn', title: 'Toggle grid background', text: '▦ Toggle Grid',
    onClick: () => {
      const next = !document.querySelector('.canvas-viewport')?.classList.contains('show-grid');
      document.querySelector('.canvas-viewport')?.classList.toggle('show-grid', next);
      saveUiPrefs({ showGrid: next });
      gridBtn.classList.toggle('active', next);
    },
  });
  if (prefs.showGrid) {
    requestAnimationFrame(() => {
      document.querySelector('.canvas-viewport')?.classList.add('show-grid');
      gridBtn.classList.add('active');
    });
  }

  const minimapBtn = el('button', {
    type: 'button', class: `btn${prefs.showMinimap ? ' active' : ''}`,
    title: 'Minimap: show a small overview map in the corner of the canvas — click or drag on it to jump the view',
    text: '🧭 Minimap',
    onClick: () => {
      const next = !minimapBtn.classList.contains('active');
      saveUiPrefs({ showMinimap: next });
      minimapBtn.classList.toggle('active', next);
      setMinimapVisible(next);
    },
  });
  if (prefs.showMinimap) {
    requestAnimationFrame(() => setMinimapVisible(true));
  }

  const focusModeBtn = el('button', {
    type: 'button', class: `btn${prefs.focusMode ? ' active' : ''}`,
    title: 'Focus Mode: dim every component except the current selection and its directly-connected neighbors',
    text: '🔦 Focus Mode',
    onClick: () => {
      const next = !focusModeBtn.classList.contains('active');
      saveUiPrefs({ focusMode: next });
      focusModeBtn.classList.toggle('active', next);
      setFocusMode(next);
    },
  });
  if (prefs.focusMode) {
    requestAnimationFrame(() => setFocusMode(true));
  }

  // Ambient "Check Diagram" badges directly on canvas nodes (io/uiPrefs.js#
  // inlineLintBadges) — a UI-only preference, so the toggle forces a redraw
  // by calling canvas.js's exported `render` directly rather than
  // store.dispatch (which would add a spurious undo-history entry for a
  // change that isn't project data — see render()'s own export comment).
  const inlineLintBadgesBtn = el('button', {
    type: 'button', class: `btn${prefs.inlineLintBadges ? ' active' : ''}`,
    title: 'Inline Diagnostics: show a ⚠️ badge directly on any component involved in a "Check Diagram" finding',
    text: '⚠️ Inline Diagnostics',
    onClick: () => {
      const next = !inlineLintBadgesBtn.classList.contains('active');
      saveUiPrefs({ inlineLintBadges: next });
      inlineLintBadgesBtn.classList.toggle('active', next);
      renderCanvas(store.getState());
    },
  });

  // Hand-drawn "Sketch Mode" (css/canvas.css) — purely visual, a body-level
  // class toggle, so it needs no store re-render at all.
  const sketchModeBtn = el('button', {
    type: 'button', class: `btn${prefs.sketchMode ? ' active' : ''}`,
    title: 'Sketch Mode: give every component and connector a hand-drawn, wireframe look',
    text: '✏️ Sketch Mode',
    onClick: () => {
      const next = !sketchModeBtn.classList.contains('active');
      saveUiPrefs({ sketchMode: next });
      sketchModeBtn.classList.toggle('active', next);
      document.body.classList.toggle('sketch-mode', next);
    },
  });
  if (prefs.sketchMode) {
    requestAnimationFrame(() => document.body.classList.add('sketch-mode'));
  }

  const alignGuidesBtn = el('button', {
    type: 'button', class: `btn${prefs.alignGuides !== false ? ' active' : ''}`,
    title: 'Snap Guides: show Figma-like alignment guides and snap into place while dragging a component',
    text: '🧲 Snap Guides',
    onClick: () => {
      const next = !alignGuidesBtn.classList.contains('active');
      saveUiPrefs({ alignGuides: next });
      alignGuidesBtn.classList.toggle('active', next);
    },
  });

  const THEME_ICON = { system: '🌓', light: '☀️', dark: '🌙' };
  const THEME_LABEL = { system: 'Match System', light: 'Light', dark: 'Dark' };
  const themeBtn = el('button', {
    type: 'button', class: 'btn',
    title: `Theme: ${THEME_LABEL[prefs.theme]} (click to switch)`,
    text: `${THEME_ICON[prefs.theme]} Theme: ${THEME_LABEL[prefs.theme]}`,
    onClick: () => {
      const nextIndex = (THEME_MODES.indexOf(getUiPrefs().theme) + 1) % THEME_MODES.length;
      const next = THEME_MODES[nextIndex];
      setTheme(next);
      themeBtn.title = `Theme: ${THEME_LABEL[next]} (click to switch)`;
      themeBtn.textContent = `${THEME_ICON[next]} Theme: ${THEME_LABEL[next]}`;
    },
  });

  const LANGUAGE_LABEL = { en: 'English', he: 'עברית' };
  const languageBtn = el('button', {
    type: 'button', class: 'btn',
    title: `${t('toolbar.language')}: ${LANGUAGE_LABEL[getLanguage()]} (click to switch — reloads the page)`,
    text: `🌐 ${t('toolbar.language')}: ${LANGUAGE_LABEL[getLanguage()]}`,
    onClick: () => {
      const nextIndex = (LANGUAGES.indexOf(getLanguage()) + 1) % LANGUAGES.length;
      setLanguage(LANGUAGES[nextIndex]);
      window.location.reload();
    },
  });

  const autoSuggestBadge = el('span', { class: 'toolbar-count-badge toolbar-auto-suggest-badge', hidden: true, title: 'New AI suggestions ready — click to view' });
  let pendingAutoSuggestFindings = null;
  const aiReviewBtn = el('button', {
    type: 'button', class: 'btn', title: 'AI Design Review: get an AI critique of this diagram — review, explain, suggestions, or a security-focused pass', onClick: () => {
      if (pendingAutoSuggestFindings) {
        const findings = pendingAutoSuggestFindings;
        pendingAutoSuggestFindings = null;
        autoSuggestBadge.hidden = true;
        openWithAutoSuggestions(findings);
        return;
      }
      toggleAiReviewPanel();
    },
  }, [el('span', { text: '🤖 AI Design Review' }), autoSuggestBadge]);
  const aiChatBtn = el('button', {
    type: 'button', class: 'btn',
    title: '🤖 AI Chat: a fast, in-app live chat with your Direct API / Local AI setup — dock it to the side, the bottom, or float it anywhere on screen',
    text: '🤖 AI Chat',
    onClick: () => toggleAiChatPanel(),
  });
  initAutoSuggestWatcher((findings) => {
    pendingAutoSuggestFindings = findings;
    autoSuggestBadge.textContent = '💡';
    autoSuggestBadge.hidden = false;
  });
  const collabBadge = el('span', { class: 'toolbar-count-badge toolbar-collab-badge', hidden: true, title: 'Live collaboration connected' });
  const collabBtn = el('button', {
    type: 'button', class: 'btn', title: 'Live Collaboration: work on this diagram with one other person in real time, no server or account needed',
    onClick: openCollaborationModal,
  }, [el('span', { text: '🤝 Collaborate' }), collabBadge]);
  onCollabStatusChange((connected) => {
    collabBadge.textContent = '🟢';
    collabBadge.hidden = !connected;
  });
  collabBadge.hidden = !isCollabConnected();

  const commentsBadge = el('span', { class: 'toolbar-count-badge toolbar-comments-badge', hidden: true });
  const commentsBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'Comments: browse every pinned comment on this diagram, unresolved ones first',
    onClick: openCommentsListModal,
  }, [el('span', { text: '💬 Comments' }), commentsBadge]);
  const updateCommentsBadge = () => {
    const count = countUnresolvedComments(store.getState().comments);
    commentsBadge.textContent = String(count);
    commentsBadge.hidden = count === 0;
  };
  store.subscribe('change', updateCommentsBadge);
  updateCommentsBadge();
  const outlineBtn = el('button', {
    type: 'button', class: 'btn',
    title: 'Outline: a searchable list of every component and connector on the canvas — click one to jump to it, or select on the canvas to find it here',
    text: '📋 Outline',
    onClick: toggleOutlinePanel,
  });
  const autoArrangeBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Auto-arrange: rearrange every component into a top-to-bottom layout that follows connector direction',
    text: '🗺️ Auto-arrange',
    onClick: () => {
      autoArrangeAll();
      showToast('Rearranged the diagram.', 'success', 1800);
    },
  });
  const aiLayoutBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'AI Beautify Layout: ask an AI to suggest a nicer arrangement of your existing components, using its own judgement instead of a fixed algorithm — only positions change',
    text: '🪄 AI Beautify Layout',
    onClick: openAiLayoutModal,
  });
  const distributeBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Distribute evenly: re-space a sequence diagram\'s lifeline columns and message heights evenly, keeping their current order',
    text: '↔️ Distribute Evenly',
    onClick: distributeSequenceDiagram,
  });
  const scaleBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Scale Diagram: permanently resize every component (and its text) by a percentage — unlike zoom, this changes the actual data',
    text: '📐 Scale Diagram',
    onClick: openScaleDiagramModal,
  });
  const findReplaceBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Find & Replace: rename a term across every component/connector label and notes field at once, in one undoable step',
    text: '🔎 Find & Replace',
    onClick: openFindReplaceModal,
  });
  const fixTextDisplayBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Fix Text Display: re-space cramped labels (like a busy sequence diagram\'s messages) so wrapped text has room to display cleanly, without moving anything that doesn\'t need it',
    text: '🔤 Fix Text Display',
    onClick: fixTextDisplay,
  });
  const lintNudgeBadge = el('span', { class: 'toolbar-count-badge toolbar-lint-nudge-badge', hidden: true, title: 'A new issue was found — click to view' });
  const lintBtn = el('button', {
    type: 'button', class: 'btn', title: 'Check Diagram: a few quick, offline structural checks (e.g. a client talking straight to a database, an unconnected component)', onClick: () => {
      lintNudgeBadge.hidden = true;
      openDiagramLintModal();
    },
  }, [el('span', { text: '🔍 Check Diagram' }), lintNudgeBadge]);
  const lintNudgesBtn = el('button', {
    type: 'button', class: `btn${getUiPrefs().proactiveLintNudges !== false ? ' active' : ''}`,
    title: 'Diagram Nudges: get a quiet notification the moment "Check Diagram" would find something new, instead of only finding out when you open it yourself',
    text: '🔔 Diagram Nudges',
    onClick: () => {
      const next = !lintNudgesBtn.classList.contains('active');
      saveUiPrefs({ proactiveLintNudges: next });
      lintNudgesBtn.classList.toggle('active', next);
      if (!next) lintNudgeBadge.hidden = true;
    },
  });
  initLintWatcher(resolveComponentDef, (finding, totalCount) => {
    lintNudgeBadge.textContent = String(totalCount);
    lintNudgeBadge.hidden = false;
  });
  const costBtn = el('button', {
    type: 'button', class: 'btn', title: 'Cost Breakdown: list every component with an estimated monthly cost (set per-component in its details panel) and the running total', text: '💰 Cost Breakdown',
    onClick: openCostBreakdownModal,
  });
  const describeBtn = el('button', {
    type: 'button', class: 'btn', title: 'Describe Diagram: an instant, offline plain-text summary of this diagram\'s structure — no AI, handy for screen readers or a quick copy-paste readout', text: '📃 Describe Diagram',
    onClick: openDiagramDescriptionModal,
  });
  const interviewBadge = el('span', { class: 'toolbar-count-badge toolbar-interview-badge', hidden: true });
  const interviewBtn = el('button', {
    type: 'button', class: 'btn', title: 'Interview Mode: practice a system design interview question against a timer, then get AI feedback on the diagram you built', onClick: openInterviewModeModal,
  }, [el('span', { text: '🎓 Interview Mode' }), interviewBadge]);
  let interviewTimerInterval = null;
  onInterviewChange((session) => {
    clearInterval(interviewTimerInterval);
    if (!session) { interviewBadge.hidden = true; return; }
    interviewBadge.hidden = false;
    const update = () => {
      const remaining = getRemainingMs();
      interviewBadge.textContent = remaining === null ? '🎓' : formatRemaining(remaining);
    };
    update();
    interviewTimerInterval = setInterval(update, 1000);
  });
  const reviewStatusBadge = el('span', { class: 'toolbar-count-badge toolbar-review-status-badge' });
  const reviewStatusBtn = el('button', {
    type: 'button', class: 'btn', title: 'Review Status: a shared draft/in-review/approved label for this diagram', onClick: openReviewStatusModal,
  }, [el('span', { text: '📝 Review Status' }), reviewStatusBadge]);
  const REVIEW_STATUS_BADGE_TEXT = { draft: 'Draft', 'in-review': 'In Review', approved: 'Approved' };
  const updateReviewStatusBadge = () => {
    const status = store.getState().reviewStatus || 'draft';
    reviewStatusBadge.textContent = REVIEW_STATUS_BADGE_TEXT[status] || status;
    reviewStatusBadge.className = `toolbar-count-badge toolbar-review-status-badge toolbar-review-status-${status}`;
  };
  store.subscribe('change', updateReviewStatusBadge);
  updateReviewStatusBadge();
  const diagramThemeBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Diagram Theme: permanently recolor every component to a chosen palette, keeping same-colored components grouped together',
    text: '🎨 Diagram Theme',
    onClick: openDiagramThemeModal,
  });
  const presenterModeBtn = el('button', {
    type: 'button',
    class: `btn${isKioskMode() ? ' active' : ''}`,
    title: 'Presenter Mode: hide the toolbar, sidebar and side panels for a full-bleed, distraction-free view — Esc or the floating Exit button brings them back',
    text: '🖥️ Presenter Mode',
    onClick: toggleKioskMode,
  });
  onKioskModeChange((active) => presenterModeBtn.classList.toggle('active', active));
  const animationBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Diagram Animation: build a numbered reveal sequence out of components and connectors, then play it back step by step',
    text: '🎞️ Diagram Animation',
    onClick: toggleAnimationPanel,
  });
  const autoPlayBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: 'Auto-Play Diagram: instantly builds a walkthrough animation from every component and connector already on the canvas, in the order they were added, and starts playing it right away — no manual setup needed',
    text: '🪄 Auto-Play Diagram',
    onClick: autoBuildAndPlayAnimation,
  });
  const flowSimBtn = el('button', {
    type: 'button',
    class: `btn${prefs.flowSimulation ? ' active' : ''}`,
    title: 'Flow Simulation: animate small dots continuously flowing along every connector in its direction, to visualize traffic',
    text: '💫 Flow Simulation',
    onClick: () => {
      const next = !flowSimBtn.classList.contains('active');
      saveUiPrefs({ flowSimulation: next });
      flowSimBtn.classList.toggle('active', next);
      setFlowSimulationEnabled(next);
    },
  });
  requestAnimationFrame(() => setFlowSimulationEnabled(prefs.flowSimulation));
  const scene3dBtn = el('button', {
    type: 'button',
    class: 'btn',
    title: '3D Presentation: view the current diagram as a rotatable 3D scene for presenting — components become extruded blocks, connectors become animated cables',
    text: '🧊 3D Presentation',
    onClick: () => {
      if (store.getState().nodes.length < 1) { showToast('Add at least one component first.', 'error'); return; }
      setScene3DActive(true);
    },
  });
  // Core: cosmetic/accessibility prefs (grid, snap guides, theme,
  // language) plus two navigation aids whose *creation* path is already
  // always available regardless of gating — Outline (a pure navigation
  // list) and Comments (pinning a comment is a canvas right-click action,
  // not gated; hiding just the "browse comments" button would leave a
  // Basic-mode user able to create comments but not find them again).
  // Everything else groups into a pack — see core/featureLevels.js.
  return buildGatedButtonList(
    'tools',
    [gridBtn, alignGuidesBtn, themeBtn, languageBtn, outlineBtn, commentsBtn],
    [
      { packId: 'ai-tools', buttons: [aiReviewBtn, aiChatBtn, aiLayoutBtn] },
      { packId: 'collaboration', buttons: [collabBtn] },
      { packId: 'analysis', buttons: [lintBtn, lintNudgesBtn, inlineLintBadgesBtn, costBtn, describeBtn, interviewBtn, reviewStatusBtn] },
      { packId: 'layout-tools', buttons: [autoArrangeBtn, distributeBtn, scaleBtn, findReplaceBtn, fixTextDisplayBtn] },
      { packId: 'visual-extras', buttons: [minimapBtn, focusModeBtn, sketchModeBtn, diagramThemeBtn, presenterModeBtn, animationBtn, autoPlayBtn, flowSimBtn, scene3dBtn] },
    ],
  );
}

function buildHelpGroupButtons() {
  const helpBtn = el('button', {
    type: 'button', class: 'btn', title: 'Help & user guide', text: '❓ Help & Guide',
    onClick: () => window.open('help.html', '_blank', 'noopener'),
  });
  const aiIntegrationBtn = el('button', {
    type: 'button', class: 'btn', title: 'A guide for AI agents/CLI tools (Claude Code, etc.) to generate a diagram for this app and hand it to you', text: '🤖 AI / CLI Integration',
    onClick: () => window.open('docs/AI_INTEGRATION.md', '_blank', 'noopener'),
  });
  const cliSetupBtn = el('button', {
    type: 'button', class: 'btn', title: 'The exact address to give an AI CLI tool so it can start working with this app', text: '🖥️ Working with CLI',
    onClick: () => openCliSetupModal(),
  });
  const hintsBtn = el('button', {
    type: 'button', class: 'btn', title: 'Show hints again', text: '💡 Show hints again',
    onClick: () => { resetHints(); updateHintsToggle(); showToast('Hints restarted.', 'info', 1800); },
  });
  const hintsToggleBtn = el('button', { type: 'button', class: 'btn' });
  hintsToggleBtn.addEventListener('click', () => { setHintsEnabled(!areHintsEnabled()); updateHintsToggle(); });
  function updateHintsToggle() {
    const on = areHintsEnabled();
    hintsToggleBtn.textContent = on ? '🔔 Hide hints' : '🔕 Show hints';
    hintsToggleBtn.title = on ? 'Hide hints' : 'Show hints';
    hintsToggleBtn.classList.toggle('active', on);
  }
  updateHintsToggle();
  const whatsNewBtn = el('button', {
    type: 'button', class: 'btn', title: "What's new", text: '🆕 What\'s New',
    onClick: () => openWhatsNewModal(),
  });
  const onboardingBtn = el('button', {
    type: 'button', class: 'btn', title: 'Show the getting-started checklist again', text: '🚀 Getting Started',
    onClick: openOnboardingChecklistWidget,
  });
  const shortcutsBtn = el('button', {
    type: 'button', class: 'btn', title: 'A reference list of every keyboard shortcut this app has (also opens with "?")', text: '⌨️ Keyboard Shortcuts',
    onClick: () => openKeyboardShortcutsModal(),
  });
  return [helpBtn, aiIntegrationBtn, cliSetupBtn, hintsBtn, hintsToggleBtn, whatsNewBtn, onboardingBtn, shortcutsBtn];
}

/** Short human summary of the current selection, shown in the contextual
 * row's header — e.g. "ElastiCache" for a single node, "3 components, 1
 * connector" for a mixed multi-selection. */
function contextSummary(selection, state) {
  if (selection.nodeIds.length === 1 && !selection.edgeIds.length) {
    return state.nodes.find((n) => n.id === selection.nodeIds[0])?.text || 'Component';
  }
  const parts = [];
  if (selection.nodeIds.length) parts.push(`${selection.nodeIds.length} component${selection.nodeIds.length === 1 ? '' : 's'}`);
  if (selection.edgeIds.length) parts.push(`${selection.edgeIds.length} connector${selection.edgeIds.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

/** Moves the single persistent `contextRow` element into whichever
 * container matches `mode` — a no-op if it's already there. 'pinned-top'
 * lives inside #toolbar (original, in-flow behavior); 'pinned-bottom' is
 * appended as the last child of #app, which (being a flex column) puts it
 * below .app-body exactly the way #toolbar sits above it, shrinking
 * .app-body from the bottom instead of the top; 'floating' is appended
 * straight to document.body for `position: fixed` viewport coordinates,
 * the same host contextMenu.js/toolbarDropdown.js already use for their
 * own floating UI. */
function mountContextRow(mode) {
  const targetParent = mode === 'pinned-top' ? toolbarRootEl
    : mode === 'pinned-bottom' ? document.getElementById('app')
      : document.body;
  if (targetParent && contextRow.parentElement !== targetParent) targetParent.appendChild(contextRow);
}

/** Floating mode only: positions `contextRow` (already mounted + built)
 * directly below or above the current selection's on-screen bounding box —
 * whichever side has more room in #canvas-viewport (not the full window,
 * so it can never cover the toolbar, sidebar, details panel or AI review
 * panel, which all sit outside that element). `top` is always computed
 * *away* from the anchor on the chosen side and is deliberately never
 * clamped back toward it afterwards — an earlier version clamped both
 * candidates into the canvas bounds independently and fell back to
 * whichever came first if neither fit perfectly, which could still slide
 * the card back over the very selection it's next to (e.g. a "rows"-shape
 * node tall enough that neither the below nor above candidate fully fit —
 * see docs/AI_AGENT_GUIDE.md). If the card doesn't fully fit vertically
 * it's still placed at the correct offset from the anchor and simply
 * scrolls internally instead (see .toolbar-row-context.floating's
 * max-height/overflow-y in css/toolbar.css) rather than being pulled back
 * on-screen at the cost of covering the anchor. Only the horizontal axis is
 * clamped, since sliding left/right can never cause that overlap. No-op
 * outside floating mode, while hidden, or if nothing in the selection still
 * has a live DOM element. */
function positionFloatingRow() {
  if (getUiPrefs().contextRowMode !== 'floating' || contextRow.hidden) return;
  const anchor = getSelectionScreenRect(lastSelection.nodeIds, lastSelection.edgeIds);
  if (!anchor) return;
  const boundsEl = document.getElementById('canvas-viewport');
  const bounds = boundsEl ? boundsEl.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

  const spaceBelow = bounds.bottom - anchor.bottom;
  const spaceAbove = anchor.top - bounds.top;
  // Biased toward "below" — not just "whichever side has more room" — since
  // "above" pushes the card's *top* edge further up the canvas the taller
  // the card is, which risks reaching content well away from the anchor
  // itself (e.g. another node positioned above it). "Below" only grows
  // downward from a fixed point right under the anchor, so it can never do
  // that. MIN_BELOW is just enough to show the row's own header even when
  // "above" would technically have more total room.
  const MIN_BELOW = 60;
  const below = spaceBelow >= MIN_BELOW || spaceBelow >= spaceAbove;

  // Cap the card's own rendered height to whatever room actually exists in
  // the chosen direction *before* reading its height for the position math
  // below — a static CSS max-height doesn't help here, since `top` is never
  // clamped back toward the anchor (seeing why is gotcha #4 item 2 in
  // docs/ARCHITECTURE.md): a naturally-tall card (e.g. a mixed node+edge
  // selection) could still render well past the bottom of the window with
  // `top` alone unclamped. Overflow content scrolls internally instead
  // (`overflow-y: auto`, already set in css/toolbar.css) rather than the
  // card extending off-screen. EDGE_MARGIN*2 leaves room at both ends of
  // the available space; a sane floor keeps this from collapsing to
  // nothing on a very cramped viewport.
  let available = below ? spaceBelow : spaceAbove;
  // The "Smart Suggestions" banner (canvas/suggestions.js) is a separate
  // `position: fixed` element pinned to the bottom-center of the screen,
  // outside #canvas-viewport's own box. Only trims the *height cap* here,
  // not `spaceBelow` itself above — folding it into `spaceBelow` would also
  // change the below-vs-above decision, undermining the "below" bias this
  // function relies on to avoid reaching other content (the banner only
  // matters once "below" is already chosen and the card is heading toward
  // the bottom of the screen; it's irrelevant to an "above" placement).
  if (below) {
    // Query by the `hidden` attribute, not the `.visible` class — the
    // class is only added on the next animation frame (see suggestions.js,
    // for its own fade/slide-in transition), but `onSuggestionsVisibilityChange`
    // notifies synchronously right after `hidden` is cleared. Querying
    // `.visible` here would miss a banner that just appeared, since this
    // runs *before* that class exists. The element is already at (or a
    // negligible ~12px from) its final layout position the moment `hidden`
    // clears, since only opacity/transform animate in, not layout.
    const banner = document.querySelector('.suggestion-banner:not([hidden])');
    if (banner) available = Math.min(available, banner.getBoundingClientRect().top - EDGE_MARGIN - anchor.bottom);
  }
  contextRow.style.maxHeight = `${Math.max(120, available - EDGE_MARGIN * 2)}px`;
  const rowRect = contextRow.getBoundingClientRect();

  let top = below ? anchor.bottom + EDGE_MARGIN : anchor.top - rowRect.height - EDGE_MARGIN;
  // `top` is deliberately never clamped back toward the anchor (see
  // docs/ARCHITECTURE.md gotcha #4 item 2) — sliding it back risks landing
  // on top of the very node/edge the row is for, silently swallowing clicks
  // meant for it. The one case that actually needs a fallback is when the
  // *anchor itself* — not just `available` room, which the Smart
  // Suggestions banner trim above can also push negative for a perfectly
  // normal, comfortably-fitting anchor — doesn't fit inside `bounds` at all
  // (e.g. two sequence-diagram lifelines, ~640px each, on a ~720px-tall
  // screen): the `Math.max(120, ...)` height floor still renders the row at
  // a real, clickable size regardless, and with no anchor edge inside
  // `bounds` to stay clear of in the first place, placing it right off the
  // (already out-of-bounds) `anchor.bottom`/`anchor.top` pushes it straight
  // off the opposite edge of the actual browser window instead,
  // unreachable. Checking the anchor directly (not `available`) is what
  // keeps this from misfiring on the banner-trim case — an earlier version
  // gated on `available < 0` instead and caused exactly that regression:
  // a comfortably-fitting anchor near a visible suggestions banner got
  // pulled back on top of itself, breaking the connect-a-new-edge gesture
  // that needs to click *through* the node underneath.
  const anchorOutOfBounds = below ? anchor.bottom > bounds.bottom : anchor.top < bounds.top;
  if (anchorOutOfBounds) {
    top = Math.max(bounds.top + EDGE_MARGIN, Math.min(top, bounds.bottom - rowRect.height - EDGE_MARGIN));
  }
  const maxLeft = bounds.right - rowRect.width - EDGE_MARGIN;
  let left = Math.max(bounds.left + EDGE_MARGIN, Math.min(anchor.left, maxLeft));

  // The minimap (canvas/minimap.js) is a `position: absolute` panel pinned to
  // #canvas-viewport's bottom-right corner — unlike the Smart Suggestions
  // banner above (full-width, so trimming vertical `available` was enough),
  // it only ever occupies that one corner, so only nudge `left` here, and
  // only when the row's vertical span would actually land over it; shrinking
  // height whenever the minimap merely happens to be visible, regardless of
  // where the row is, would be needlessly conservative for a selection
  // nowhere near that corner.
  const minimapEl = document.querySelector('.minimap:not([hidden])');
  if (minimapEl) {
    const mm = minimapEl.getBoundingClientRect();
    const verticallyOverlaps = top < mm.bottom && top + rowRect.height > mm.top;
    if (verticallyOverlaps && left + rowRect.width > mm.left) {
      left = Math.max(bounds.left + EDGE_MARGIN, mm.left - rowRect.width - EDGE_MARGIN);
    }
  }
  contextRow.style.left = `${left}px`;
  contextRow.style.top = `${top}px`;
}

/** Floating mode visually hides itself (but stays mounted/laid out) while
 * any toolbar dropdown panel is open — both are independently-positioned
 * floating UI, and a dropdown's contents (e.g. a tall File-group panel) can
 * legitimately extend down over the same screen region as the style card.
 * Reappears the moment the dropdown closes. No-op in the pinned modes,
 * which never overlap a dropdown panel since they stay inside the normal
 * page flow. */
function updateFloatingDropdownGate() {
  const mode = getUiPrefs().contextRowMode;
  contextRow.classList.toggle('dropdown-suppressed', mode === 'floating' && anyDropdownOpen);
}

// The context row rebuilds its entire DOM on every store 'change' event
// (including the one dispatched by each keystroke in one of its own text/
// number/color fields, via renderNodeStyleEditor/renderEdgeStyleEditor) —
// wrapping the rebuild lets a field that had focus keep it (and its cursor
// position) across the rebuild instead of losing focus every keystroke.
// See utils/dom.js#rerenderPreservingUiState and each field's
// `data-focus-key` in styleEditor.js/arrowEditor.js.
function renderContextRow(selection) {
  rerenderPreservingUiState(contextRow, () => renderContextRowInner(selection));
}

function renderContextRowInner(selection) {
  lastSelection = selection;
  const mode = getUiPrefs().contextRowMode;
  mountContextRow(mode);
  contextRow.classList.remove('floating', 'pinned-top', 'pinned-bottom');
  contextRow.classList.add(mode);
  updateFloatingDropdownGate();
  // positionFloatingRow sets an inline max-height (see its own comment for
  // why) that would otherwise linger and clip a pinned row's content after
  // switching away from floating.
  if (mode !== 'floating') contextRow.style.maxHeight = '';

  clear(contextRow);
  const hasNodes = selection.nodeIds.length > 0;
  const hasEdges = selection.edgeIds.length > 0;
  contextRow.hidden = !hasNodes && !hasEdges;
  if (!hasNodes && !hasEdges) {
    contextCollapsed = false;
    contextRow.classList.remove('collapsed');
    return;
  }
  contextRow.classList.toggle('collapsed', contextCollapsed);

  // Header: what's selected, a pin/float toggle (mode === 'floating' shows
  // "pin to top"; either pinned mode shows "unpin" back to floating — the
  // Default Settings modal is the only way to reach 'pinned-bottom'
  // specifically, this button only ever toggles floating <-> pinned-top),
  // a collapse toggle to shrink this row down to just this slim strip
  // (freeing up canvas space — most useful on mobile, where the full field
  // grid can otherwise fill most of the screen), and a "done editing"
  // close button, since until now the only way to dismiss this row was
  // deselecting by clicking elsewhere or pressing Escape — not an obvious
  // affordance, especially on touch.
  const header = el('div', { class: 'toolbar-context-header' });
  header.appendChild(el('span', { class: 'toolbar-context-summary', text: contextSummary(selection, store.getState()) }));
  header.appendChild(mode === 'floating'
    ? el('button', {
      type: 'button', class: 'btn btn-icon toolbar-context-pin',
      text: '📌', title: 'Pin to top of screen', 'aria-label': 'Pin style editor to top of screen',
      onClick: () => saveUiPrefs({ contextRowMode: 'pinned-top' }),
    })
    : el('button', {
      type: 'button', class: 'btn btn-icon toolbar-context-pin active',
      text: '📌', title: 'Unpin (float near selection instead)', 'aria-label': 'Unpin style editor, float near the selection instead',
      onClick: () => saveUiPrefs({ contextRowMode: 'floating' }),
    }));
  header.appendChild(el('button', {
    type: 'button', class: 'btn btn-icon toolbar-context-collapse-toggle',
    text: contextCollapsed ? '‹' : '›',
    title: contextCollapsed ? 'Expand style editor' : 'Collapse style editor',
    'aria-label': contextCollapsed ? 'Expand style editor' : 'Collapse style editor',
    onClick: () => { contextCollapsed = !contextCollapsed; renderContextRow(store.getSelection()); },
  }));
  header.appendChild(el('button', {
    type: 'button', class: 'btn btn-icon toolbar-context-done',
    text: '✕', title: 'Done editing (deselect)', 'aria-label': 'Done editing, deselect',
    onClick: () => store.select([], []),
  }));
  contextRow.appendChild(header);
  if (contextCollapsed) {
    if (mode === 'floating') positionFloatingRow();
    return;
  }

  const body = el('div', { class: 'toolbar-context-body' });
  const controls = el('div', { class: 'toolbar-context-controls' });
  // Both editors render together for a mixed node+edge selection, so
  // selecting a cluster of components and connectors lets you restyle
  // everything in one pass instead of picking one type at a time. Each
  // gets its own sub-container — both renderNodeStyleEditor and
  // renderEdgeStyleEditor clear() their container on entry, so sharing one
  // directly would let the second call wipe out the first's fields.
  if (hasNodes) {
    const nodeControls = el('div', { class: 'toolbar-context-controls-group' });
    renderNodeStyleEditor(nodeControls, selection.nodeIds);
    controls.appendChild(nodeControls);
  }
  if (hasEdges) {
    const edgeControls = el('div', { class: 'toolbar-context-controls-group' });
    renderEdgeStyleEditor(edgeControls, selection.edgeIds);
    controls.appendChild(edgeControls);
  }
  body.appendChild(controls);

  const actions = el('div', { class: 'toolbar-context-actions' });
  if (selection.nodeIds.length >= 2) {
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-icon', title: 'Group selection', 'aria-label': 'Group selection', text: '🔗', onClick: groupSelection }));
  }
  if (selectionHasGroup()) {
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-icon', title: 'Ungroup', 'aria-label': 'Ungroup', text: '✂️', onClick: ungroupSelection }));
  }
  if (hasNodes) {
    // Works whether or not the selection was grouped first — a saved custom
    // component just needs the nodes (+ any connectors between them) to
    // exist, not a shared groupId. A single node with no edges instead opens
    // the richer, editable "New Component" flow (customComponentModal.js)
    // so its shape/colors/etc. stay tweakable before saving.
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', title: 'Save selection as a reusable custom component', 'aria-label': 'Save selection as a reusable custom component', text: '⭐',
      onClick: () => {
        if (selection.nodeIds.length === 1 && !hasEdges) {
          const node = store.getState().nodes.find((n) => n.id === selection.nodeIds[0]);
          openCustomComponentModal({ seedFromNode: node });
        } else {
          openSaveComponentGroupModal();
        }
      },
    }));
  }
  duplicateBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Duplicate (Ctrl+D)', 'aria-label': 'Duplicate', text: '⧉', onClick: duplicateSelection });
  actions.appendChild(duplicateBtn);
  deleteBtn = el('button', { type: 'button', class: 'btn btn-icon btn-danger', title: 'Delete (Del)', 'aria-label': 'Delete', text: '🗑️', onClick: deleteSelection });
  actions.appendChild(deleteBtn);
  body.appendChild(actions);
  contextRow.appendChild(body);
  if (mode === 'floating') positionFloatingRow();
}
