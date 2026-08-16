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
import { createEmptyProject } from '../core/project.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import {
  deleteSelection, duplicateSelection, groupSelection, ungroupSelection, selectionHasGroup, duplicateProjectAsNew,
} from '../canvas/canvas.js';
import { setMagicMode, isMagicModeActive } from '../canvas/connectorInteractions.js';
import { getBaseToolMode, setToolMode, onToolModeChange } from '../canvas/toolMode.js';
import { renderNodeStyleEditor } from './styleEditor.js';
import { renderEdgeStyleEditor } from './arrowEditor.js';
import { renderZoomControls } from './zoomControls.js';
import { buildToolbarDropdown } from './toolbarDropdown.js';
import { exportProjectToFile, pickJSONFile, parseProjectFile } from '../io/fileIO.js';
import { exportPNG } from '../io/exportImage.js';
import { exportPDF } from '../io/exportPdf.js';
import { openSaveAsModal } from '../modals/saveAsModal.js';
import { openLoadProjectModal } from '../modals/loadProjectModal.js';
import { openCustomComponentModal } from '../modals/customComponentModal.js';
import { openSaveComponentGroupModal } from '../modals/saveComponentGroupModal.js';
import { openCustomShapeModal } from '../modals/customShapeModal.js';
import { openDefaultSettingsModal } from '../modals/defaultSettingsModal.js';
import { openBackupModal } from '../modals/backupModal.js';
import { openWhatsNewModal } from '../modals/whatsNewModal.js';
import { openReplicationModal } from '../modals/replicationModal.js';
import { toggleAiReviewPanel } from '../panel/aiReviewPanel.js';
import { openGenerateDesignModal } from '../modals/generateDesignModal.js';
import { confirmAction } from '../modals/confirmModal.js';
import { showToast } from '../utils/toast.js';
import { readJSON, writeJSON } from '../io/storage.js';
import { resetHints, areHintsEnabled, setHintsEnabled } from '../hints/hints.js';

let contextRow = null;
let undoBtn = null;
let redoBtn = null;
let deleteBtn = null;
let duplicateBtn = null;
// Whether the contextual style-editor row is shrunk to a slim header strip
// (see renderContextRow) — reset to expanded each time the row goes from
// hidden to shown, same convention as the details panel always opening
// expanded for a newly opened component.
let contextCollapsed = false;

export function initToolbar(root) {
  root.classList.add('toolbar');

  const row1 = el('div', { class: 'toolbar-row toolbar-row-main' });
  row1.appendChild(buildBrand());
  row1.appendChild(buildHistoryGroup());
  row1.appendChild(buildNavToolGroup());
  row1.appendChild(buildQuickCreateGroup());
  row1.appendChild(buildToolbarDropdown('File', '🗂️', 'File: new, save, load, duplicate, import/export, backup', buildFileGroupButtons()));
  row1.appendChild(buildToolbarDropdown('Create', '✨', 'Create: custom component, generated design, replication, defaults', buildCreateGroupButtons()));
  const spacer = el('div', { class: 'toolbar-spacer' });
  row1.appendChild(spacer);
  row1.appendChild(renderZoomControls());
  row1.appendChild(buildToolbarDropdown('Tools', '🛠️', 'Tools: grid, AI Design Review', buildToolsGroupButtons()));
  row1.appendChild(buildToolbarDropdown('Help', '❓', 'Help: user guide, hints, what\'s new', buildHelpGroupButtons()));
  root.appendChild(row1);

  contextRow = el('div', { class: 'toolbar-row toolbar-row-context', hidden: true });
  root.appendChild(contextRow);

  store.subscribe('selection', renderContextRow);
  store.subscribe('change', () => {
    renderContextRow(store.getSelection());
    syncHistoryButtons();
  });
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
  undoBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Undo (Ctrl+Z)', text: '↶', onClick: () => store.undo() });
  redoBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Redo (Ctrl+Shift+Z)', text: '↷', onClick: () => store.redo() });
  return group(undoBtn, redoBtn);
}

function syncHistoryButtons() {
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
}

/** Select (default click/marquee-drag) vs Hand (pan-anywhere, never moves a
 * component) tool toggle — see canvas/toolMode.js. Kept flat (not in a
 * dropdown) since it's a mode switched constantly while working, not a
 * one-off action. Holding Space temporarily switches to Hand no matter
 * which of these is pressed; releasing it restores whichever was active. */
function buildNavToolGroup() {
  const selectBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: 'Select tool (V): click to select, drag empty space to marquee-select', text: '🖱️',
    onClick: () => setToolMode('select'),
  });
  const handBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: 'Hand tool (H, or hold Space): drag anywhere to pan the canvas without moving components', text: '✋',
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

/** "Add Shape" and "Magic Arrow" stay flat (not in a dropdown) — both are
 * quick, frequent, one-click actions used while actively drawing a
 * diagram, not occasional setup/admin actions like the rest of Create/
 * Tools, so burying them behind a dropdown click would slow down exactly
 * the moment they're needed. */
function buildQuickCreateGroup() {
  const addShapeBtn = el('button', { type: 'button', class: 'btn', title: 'Add a basic shape', text: '🔷 Add Shape', onClick: openCustomShapeModal });
  const magicBtn = el('button', {
    type: 'button', class: 'btn magic-arrow-btn', title: 'Magic Arrow: arm to auto-route the next connector around every other component', text: '🪄 Magic Arrow',
    onClick: () => {
      const next = !isMagicModeActive();
      setMagicMode(next);
      magicBtn.classList.toggle('active', next);
      if (next) showToast('Magic Arrow armed — drag from a connection point to draw an auto-routed connector.', 'info', 2600);
    },
  });
  return group(addShapeBtn, magicBtn);
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
  const backupBtn = el('button', { type: 'button', class: 'btn', title: 'Backup & restore everything', text: '🗄️ Backup & Restore', onClick: openBackupModal });
  return [newBtn, saveAsBtn, loadBtn, duplicateProjectBtn, exportJsonBtn, importJsonBtn, pngBtn, pdfBtn, backupBtn];
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
  const generateDesignBtn = el('button', { type: 'button', class: 'btn', title: 'Generate a design from a spec, with AI help', text: '🧠 Generate Design', onClick: openGenerateDesignModal });
  const replicateBtn = el('button', { type: 'button', class: 'btn', title: 'Replicate: link components to auto-mirror across two sides', text: '🔁 Replicate', onClick: openReplicationModal });
  const defaultsBtn = el('button', { type: 'button', class: 'btn', title: 'Default settings for new components', text: '🎛️ Default Settings', onClick: openDefaultSettingsModal });
  return [newComponentBtn, generateDesignBtn, replicateBtn, defaultsBtn];
}

function buildToolsGroupButtons() {
  const prefs = readJSON('prefs', {});
  const gridBtn = el('button', {
    type: 'button', class: 'btn', title: 'Toggle grid background', text: '▦ Toggle Grid',
    onClick: () => {
      const next = !document.querySelector('.canvas-viewport')?.classList.contains('show-grid');
      document.querySelector('.canvas-viewport')?.classList.toggle('show-grid', next);
      writeJSON('prefs', { ...readJSON('prefs', {}), showGrid: next });
      gridBtn.classList.toggle('active', next);
    },
  });
  if (prefs.showGrid) {
    requestAnimationFrame(() => {
      document.querySelector('.canvas-viewport')?.classList.add('show-grid');
      gridBtn.classList.add('active');
    });
  }

  const aiReviewBtn = el('button', { type: 'button', class: 'btn', title: 'AI Design Review', text: '🤖 AI Design Review', onClick: toggleAiReviewPanel });
  return [gridBtn, aiReviewBtn];
}

function buildHelpGroupButtons() {
  const helpBtn = el('button', {
    type: 'button', class: 'btn', title: 'Help & user guide', text: '❓ Help & Guide',
    onClick: () => window.open('help.html', '_blank', 'noopener'),
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
  return [helpBtn, hintsBtn, hintsToggleBtn, whatsNewBtn];
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

  // Header: what's selected, a collapse toggle to shrink this row down to
  // just this slim strip (freeing up canvas space — most useful on
  // mobile, where the full field grid can otherwise fill most of the
  // screen), and a "done editing" close button, since until now the only
  // way to dismiss this row was deselecting by clicking elsewhere or
  // pressing Escape — not an obvious affordance, especially on touch.
  const header = el('div', { class: 'toolbar-context-header' });
  header.appendChild(el('span', { class: 'toolbar-context-summary', text: contextSummary(selection, store.getState()) }));
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
  if (contextCollapsed) return;

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
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-icon', title: 'Group selection', text: '🔗', onClick: groupSelection }));
  }
  if (selectionHasGroup()) {
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-icon', title: 'Ungroup', text: '✂️', onClick: ungroupSelection }));
  }
  if (hasNodes) {
    // Works whether or not the selection was grouped first — a saved custom
    // component just needs the nodes (+ any connectors between them) to
    // exist, not a shared groupId. A single node with no edges instead opens
    // the richer, editable "New Component" flow (customComponentModal.js)
    // so its shape/colors/etc. stay tweakable before saving.
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', title: 'Save selection as a reusable custom component', text: '⭐',
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
  duplicateBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Duplicate (Ctrl+D)', text: '⧉', onClick: duplicateSelection });
  actions.appendChild(duplicateBtn);
  deleteBtn = el('button', { type: 'button', class: 'btn btn-icon btn-danger', title: 'Delete (Del)', text: '🗑️', onClick: deleteSelection });
  actions.appendChild(deleteBtn);
  body.appendChild(actions);
  contextRow.appendChild(body);
}
