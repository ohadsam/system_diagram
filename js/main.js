// App entry point: wires every module together. See docs/ARCHITECTURE.md.
import * as store from './core/store.js';
import { createEmptyProject } from './core/project.js';
import { initCanvas, deleteSelection, duplicateSelection } from './canvas/canvas.js';
import { hideContextMenu } from './canvas/contextMenu.js';
import { initSidebar, configureSidebar } from './sidebar/sidebar.js';
import { initToolbar } from './toolbar/toolbar.js';
import { initDetailsPanel, close as closeDetailsPanel } from './panel/detailsPanel.js';
import { initAutosave, restoreAutosavedProject } from './io/autosave.js';
import { openCustomComponentModal } from './modals/customComponentModal.js';
import { initHints } from './hints/hints.js';
import { saveNamedProject } from './io/projects.js';
import { showToast } from './utils/toast.js';

function isTypingTarget(elRef) {
  if (!elRef) return false;
  const tag = elRef.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || elRef.isContentEditable || !!elRef.closest('dialog');
}

function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      // Always intercept — the browser's "Save Page" dialog has no use here,
      // and the diagram already autosaves, so this is a reassuring "save a
      // named checkpoint now" rather than a save that could ever be skipped.
      e.preventDefault();
      const project = store.getState();
      saveNamedProject(project);
      showToast(`Saved "${project.name}".`, 'success', 1800);
      return;
    }
    if (isTypingTarget(document.activeElement)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
      e.preventDefault();
      deleteSelection();
    } else if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
      e.preventDefault();
      store.redo();
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      store.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      store.redo();
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelection();
    } else if (e.key === 'Escape') {
      store.clearSelection();
      hideContextMenu();
      closeDetailsPanel();
    }
  });
}

function boot() {
  const restored = restoreAutosavedProject();
  store.loadProject(restored || createEmptyProject());
  initAutosave();

  initCanvas(document.getElementById('canvas-viewport'));
  initSidebar(document.getElementById('sidebar'));
  initToolbar(document.getElementById('toolbar'));
  initDetailsPanel(document.getElementById('details-panel'));

  configureSidebar({ onEditCustomComponent: (def) => openCustomComponentModal({ editDef: def }) });

  initKeyboardShortcuts();
  requestAnimationFrame(() => initHints());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
