// App entry point: wires every module together. See docs/ARCHITECTURE.md.
import * as store from './core/store.js';
import { createEmptyProject } from './core/project.js';
import { initCanvas, deleteSelection, duplicateSelection } from './canvas/canvas.js';
import { hideContextMenu } from './canvas/contextMenu.js';
import { initSidebar, configureSidebar } from './sidebar/sidebar.js';
import { initToolbar } from './toolbar/toolbar.js';
import { initDetailsPanel, close as closeDetailsPanel } from './panel/detailsPanel.js';
import { initAiReviewPanel, close as closeAiReviewPanel } from './panel/aiReviewPanel.js';
import { initAutosave, restoreAutosavedProject } from './io/autosave.js';
import { loadProjectFromHash } from './io/shareLink.js';
import { openCustomComponentModal } from './modals/customComponentModal.js';
import { initHints } from './hints/hints.js';
import { saveNamedProject } from './io/projects.js';
import { showToast } from './utils/toast.js';
import { checkWhatsNew, markVersionSeen } from './io/whatsNew.js';
import { openWhatsNewModal } from './modals/whatsNewModal.js';
import * as viewport from './canvas/viewport.js';
import { setToolMode, setSpaceHeld } from './canvas/toolMode.js';

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
    } else if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      viewport.zoomTo(viewport.getViewport().zoom + 0.1);
    } else if (mod && e.key === '-') {
      e.preventDefault();
      viewport.zoomTo(viewport.getViewport().zoom - 0.1);
    } else if (mod && e.key === '0') {
      e.preventDefault();
      viewport.zoomTo(1);
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
      closeAiReviewPanel();
    } else if (e.key === ' ' && !e.repeat) {
      // Hold Space to temporarily pan (Hand tool) no matter which tool is
      // active, Figma-style — released back to whatever was active before.
      e.preventDefault();
      setSpaceHeld(true);
    } else if (!mod && e.key.toLowerCase() === 'h') {
      setToolMode('hand');
    } else if (!mod && e.key.toLowerCase() === 'v') {
      setToolMode('select');
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') setSpaceHeld(false);
  });
}

async function boot() {
  // A "#share=..." URL (io/shareLink.js) takes priority over the normal
  // autosave-restore path — opening one loads a local copy of that
  // project, same as any other Load, not a live-synced session.
  const shared = await loadProjectFromHash(location.hash);
  if (shared) {
    store.loadProject(shared);
    history.replaceState(null, '', location.pathname + location.search);
    requestAnimationFrame(() => showToast('Opened from a share link — this is your own local copy; use File > Save As to keep it.', 'info', 5000));
  } else {
    const restored = restoreAutosavedProject();
    store.loadProject(restored || createEmptyProject());
  }
  initAutosave();

  initCanvas(document.getElementById('canvas-viewport'));
  initSidebar(document.getElementById('sidebar'));
  initToolbar(document.getElementById('toolbar'));
  initDetailsPanel(document.getElementById('details-panel'));
  initAiReviewPanel(document.getElementById('ai-review-panel'));

  configureSidebar({ onEditCustomComponent: (def) => openCustomComponentModal({ editDef: def }) });

  initKeyboardShortcuts();
  requestAnimationFrame(() => initHints());

  const whatsNew = checkWhatsNew();
  markVersionSeen();
  if (whatsNew.show) requestAnimationFrame(() => openWhatsNewModal(whatsNew.highlights));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
