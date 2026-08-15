// Top toolbar: global actions (row 1) + contextual style editor (row 2,
// shown only while something is selected).
import * as store from '../core/store.js';
import { createEmptyProject } from '../core/project.js';
import { el, clear } from '../utils/dom.js';
import { deleteSelection, duplicateSelection, groupSelection, ungroupSelection, selectionHasGroup, duplicateProjectAsNew } from '../canvas/canvas.js';
import { setMagicMode, isMagicModeActive } from '../canvas/connectorInteractions.js';
import { renderNodeStyleEditor } from './styleEditor.js';
import { renderEdgeStyleEditor } from './arrowEditor.js';
import { renderZoomControls } from './zoomControls.js';
import { exportProjectToFile, pickJSONFile, parseProjectFile } from '../io/fileIO.js';
import { exportPNG } from '../io/exportImage.js';
import { exportPDF } from '../io/exportPdf.js';
import { openSaveAsModal } from '../modals/saveAsModal.js';
import { openLoadProjectModal } from '../modals/loadProjectModal.js';
import { openCustomComponentModal } from '../modals/customComponentModal.js';
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

export function initToolbar(root) {
  root.classList.add('toolbar');

  const row1 = el('div', { class: 'toolbar-row toolbar-row-main' });
  row1.appendChild(buildBrand());
  row1.appendChild(buildHistoryGroup());
  row1.appendChild(buildFileGroup());
  row1.appendChild(buildCreateGroup());
  row1.appendChild(buildExportGroup());
  const spacer = el('div', { class: 'toolbar-spacer' });
  row1.appendChild(spacer);
  row1.appendChild(renderZoomControls());
  row1.appendChild(buildViewGroup());
  row1.appendChild(buildHelpGroup());
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

function buildFileGroup() {
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
    type: 'button', class: 'btn btn-icon', title: 'Duplicate this project into a new one (the original stays untouched)', text: '📄',
    onClick: duplicateProjectAsNew,
  });
  return group(newBtn, saveAsBtn, loadBtn, duplicateProjectBtn);
}

function buildCreateGroup() {
  const newComponentBtn = el('button', {
    type: 'button', class: 'btn', title: 'Build a custom saved component', text: '✨ New Component',
    onClick: () => {
      const selection = store.getSelection();
      const state = store.getState();
      const seedFromNode = selection.nodeIds.length === 1 ? state.nodes.find((n) => n.id === selection.nodeIds[0]) : null;
      openCustomComponentModal({ seedFromNode });
    },
  });
  const addShapeBtn = el('button', { type: 'button', class: 'btn', title: 'Add a basic shape', text: '🔷 Add Shape', onClick: openCustomShapeModal });
  const generateDesignBtn = el('button', { type: 'button', class: 'btn', title: 'Generate a design from a spec, with AI help', text: '🧠 Generate Design', onClick: openGenerateDesignModal });
  const replicateBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Replicate: link components to auto-mirror across two sides', text: '🔁', onClick: openReplicationModal });
  const defaultsBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Default settings for new components', text: '🎛️', onClick: openDefaultSettingsModal });
  return group(newComponentBtn, addShapeBtn, generateDesignBtn, replicateBtn, defaultsBtn);
}

function buildExportGroup() {
  const exportJsonBtn = el('button', { type: 'button', class: 'btn', title: 'Export project as JSON', text: '⬇️ JSON', onClick: () => exportProjectToFile(store.getState()) });
  const importJsonBtn = el('button', {
    type: 'button', class: 'btn', title: 'Import project from JSON', text: '⬆️ JSON',
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
    type: 'button', class: 'btn', title: 'Export diagram as PNG image', text: '🖼️ PNG',
    onClick: async () => {
      showToast('Rendering PNG…', 'info', 1500);
      const result = await exportPNG(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    },
  });
  const pdfBtn = el('button', {
    type: 'button', class: 'btn', title: 'Export diagram as PDF', text: '📄 PDF',
    onClick: async () => {
      showToast('Rendering PDF…', 'info', 1500);
      const result = await exportPDF(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    },
  });
  const backupBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Backup & restore everything', text: '🗄️', onClick: openBackupModal });
  const aiReviewBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'AI Design Review', text: '🤖', onClick: toggleAiReviewPanel });
  return group(exportJsonBtn, importJsonBtn, pngBtn, pdfBtn, backupBtn, aiReviewBtn);
}

function buildViewGroup() {
  const prefs = readJSON('prefs', {});
  const gridBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: 'Toggle grid background', text: '▦',
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

  const magicBtn = el('button', {
    type: 'button', class: 'btn btn-icon magic-arrow-btn', title: 'Magic Arrow: arm to auto-route the next connector around every other component', text: '🪄',
    onClick: () => {
      const next = !isMagicModeActive();
      setMagicMode(next);
      magicBtn.classList.toggle('active', next);
      if (next) showToast('Magic Arrow armed — drag from a connection point to draw an auto-routed connector.', 'info', 2600);
    },
  });
  return group(gridBtn, magicBtn);
}

function buildHelpGroup() {
  const helpBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: 'Help & user guide', text: '❓',
    onClick: () => window.open('help.html', '_blank', 'noopener'),
  });
  const hintsBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: 'Show hints again', text: '💡',
    onClick: () => { resetHints(); updateHintsToggle(); showToast('Hints restarted.', 'info', 1800); },
  });
  const hintsToggleBtn = el('button', {
    type: 'button', class: 'btn btn-icon', onClick: () => { setHintsEnabled(!areHintsEnabled()); updateHintsToggle(); },
  });
  function updateHintsToggle() {
    const on = areHintsEnabled();
    hintsToggleBtn.textContent = on ? '🔔' : '🔕';
    hintsToggleBtn.title = on ? 'Hide hints' : 'Show hints';
    hintsToggleBtn.classList.toggle('active', on);
  }
  updateHintsToggle();
  const whatsNewBtn = el('button', {
    type: 'button', class: 'btn btn-icon', title: "What's new", text: '🆕',
    onClick: () => openWhatsNewModal(),
  });
  return group(helpBtn, hintsBtn, hintsToggleBtn, whatsNewBtn);
}

function renderContextRow(selection) {
  clear(contextRow);
  const hasNodes = selection.nodeIds.length > 0;
  const hasEdges = selection.edgeIds.length > 0;
  contextRow.hidden = !hasNodes && !hasEdges;
  if (!hasNodes && !hasEdges) return;

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
  contextRow.appendChild(controls);

  const actions = el('div', { class: 'toolbar-context-actions' });
  if (selection.nodeIds.length >= 2) {
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-icon', title: 'Group selection', text: '🔗', onClick: groupSelection }));
  }
  if (selectionHasGroup()) {
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-icon', title: 'Ungroup', text: '✂️', onClick: ungroupSelection }));
  }
  duplicateBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Duplicate (Ctrl+D)', text: '⧉', onClick: duplicateSelection });
  actions.appendChild(duplicateBtn);
  deleteBtn = el('button', { type: 'button', class: 'btn btn-icon btn-danger', title: 'Delete (Del)', text: '🗑️', onClick: deleteSelection });
  actions.appendChild(deleteBtn);
  contextRow.appendChild(actions);
}
