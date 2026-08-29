// App entry point: wires every module together. See docs/ARCHITECTURE.md.
import * as store from './core/store.js';
import { createEmptyProject } from './core/project.js';
import { initCanvas, deleteSelection, duplicateSelection, stopAnimationPlayback } from './canvas/canvas.js';
import { hideContextMenu } from './canvas/contextMenu.js';
import { initSidebar, configureSidebar } from './sidebar/sidebar.js';
import { initToolbar } from './toolbar/toolbar.js';
import { initDetailsPanel, close as closeDetailsPanel } from './panel/detailsPanel.js';
import { initAiReviewPanel, close as closeAiReviewPanel } from './panel/aiReviewPanel.js';
import { initAiChatPanel, close as closeAiChatPanel } from './panel/aiChatPanel.js';
import { initOutlinePanel } from './panel/outlinePanel.js';
import { initAnimationPanel } from './panel/animationPanel.js';
import { initAnimationOverlay } from './canvas/animationOverlay.js';
import {
  isAnimationPlaying, isAnimationFrozen, nextStep, prevStep, setFrozen,
} from './core/animationPlayback.js';
import { initAutosave, restoreAutosavedProject } from './io/autosave.js';
import { initStorageBackend } from './io/storage.js';
import { loadProjectFromHash } from './io/shareLink.js';
import { openCustomComponentModal } from './modals/customComponentModal.js';
import { initHints } from './hints/hints.js';
import { initOnboardingChecklistWidget } from './hints/onboardingChecklistWidget.js';
import { saveNamedProject } from './io/projects.js';
import { showToast } from './utils/toast.js';
import { checkWhatsNew, markVersionSeen } from './io/whatsNew.js';
import { openWhatsNewModal } from './modals/whatsNewModal.js';
import * as viewport from './canvas/viewport.js';
import { setToolMode, setSpaceHeld } from './canvas/toolMode.js';
import { openCommandPaletteModal } from './modals/commandPaletteModal.js';
import { initTheme } from './io/theme.js';
import { isKioskMode, setKioskMode } from './core/kioskMode.js';
import { initKioskModeUi } from './toolbar/kioskModeUi.js';
import { initDuplicateTabWarning } from './io/duplicateTabWarning.js';
import { registerServiceWorker } from './io/serviceWorker.js';
import { startKeyboardConnect, isKeyboardConnectActive } from './canvas/keyboardConnect.js';
import { initScene3DOverlay } from './canvas/scene3dOverlay.js';
import { applyFirstVisitDefaultsIfNeeded } from './io/firstVisitDefaults.js';
import { recordSessionStart } from './io/usageStats.js';
import { maybeShowFeatureSuggestionBanner } from './hints/featureSuggestionBanner.js';

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
    if (mod && e.key.toLowerCase() === 'k') {
      // Opens even while a text input is focused, same as Ctrl/Cmd+S above —
      // "quick action" search should work from anywhere in the app.
      e.preventDefault();
      openCommandPaletteModal();
      return;
    }
    if (isTypingTarget(document.activeElement)) return;
    if (isAnimationPlaying()) {
      // Diagram Animation playback takes over the keyboard entirely while
      // presenting — none of the normal editing shortcuts below make sense
      // with the toolbar/sidebar hidden (kiosk mode) and nothing meant to
      // be interacted with except the animation itself.
      if (e.key === 'Escape') {
        e.preventDefault();
        // One level at a time: exit drawing first if that's active, only
        // stop the whole presentation on a second Escape.
        if (isAnimationFrozen()) setFrozen(false);
        else stopAnimationPlayback();
        return;
      }
      if (!isAnimationFrozen() && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        nextStep();
        return;
      }
      if (!isAnimationFrozen() && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        prevStep();
        return;
      }
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setFrozen(!isAnimationFrozen());
        return;
      }
      return;
    }
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
      closeAiChatPanel();
      if (isKioskMode()) setKioskMode(false);
    } else if (e.key === ' ' && !e.repeat) {
      // Hold Space to temporarily pan (Hand tool) no matter which tool is
      // active, Figma-style — released back to whatever was active before.
      e.preventDefault();
      setSpaceHeld(true);
    } else if (!mod && e.key.toLowerCase() === 'h') {
      setToolMode('hand');
    } else if (!mod && e.key.toLowerCase() === 'v') {
      setToolMode('select');
    } else if (!mod && e.key.toLowerCase() === 'c' && !isKeyboardConnectActive()) {
      // Keyboard-only "draw a connector" — the mouse-free counterpart of
      // dragging from a node's connection dot. Needs exactly one node
      // selected (Tab to one first — canvas/node.js's `focus` listener
      // keeps selection in sync with keyboard focus for exactly this case).
      const nodeIds = store.getSelection().nodeIds;
      if (nodeIds.length === 1) {
        e.preventDefault();
        startKeyboardConnect(nodeIds[0]);
      }
    } else if (!mod && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      // Nudges the selected node(s) by keyboard — the only way to reposition
      // a component without a mouse/touch drag, so this is load-bearing for
      // keyboard-only and switch-device use, not just a nice-to-have. Shift
      // for a bigger step, same convention as Figma/Illustrator.
      const nodeIds = store.getSelection().nodeIds;
      if (!nodeIds.length) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      store.dispatch((draft) => {
        for (const id of nodeIds) {
          const n = draft.nodes.find((x) => x.id === id);
          if (n) { n.x += dx; n.y += dy; }
        }
      });
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') setSpaceHeld(false);
  });
}

async function boot() {
  // Must resolve before anything else touches storage: a no-op when the
  // default 'localStorage' backend is active, but when the opt-in
  // IndexedDB backend is active this loads its contents into storage.js's
  // in-memory cache first — see io/storage.js's header comment for why
  // every other module can keep reading storage synchronously either way.
  await initStorageBackend();

  // io/whatsNew.js#checkWhatsNew has its own, unrelated "is storage
  // completely empty" brand-new-visitor check — it has to run and capture
  // its result *before* applyFirstVisitDefaultsIfNeeded()/
  // recordSessionStart() below write anything, or it would see this boot's
  // own writes and wrongly conclude "a returning visitor with no tracked
  // version", popping the "What's New" modal on a real brand-new visitor's
  // very first-ever load. `markVersionSeen()` and actually showing the
  // modal both still happen later, in their original spot — only the
  // *check* needs to move this early.
  const whatsNew = checkWhatsNew();

  // Also must resolve before anything else touches storage — see this
  // function's own header comment for why (a brand-new-visitor check that
  // must see storage in its true "before this boot" state).
  applyFirstVisitDefaultsIfNeeded();
  recordSessionStart();

  // Already applied synchronously by index.html's inline <head> script
  // (before this module even loaded) — called again here so the rest of
  // the app (the toolbar's theme toggle) can rely on io/theme.js's applied
  // state being in sync with io/uiPrefs.js's stored one from this point on.
  initTheme();

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
  initAiChatPanel(document.getElementById('ai-chat-panel'));
  initOutlinePanel(document.getElementById('outline-panel'));
  initAnimationPanel(document.getElementById('animation-panel'));

  configureSidebar({ onEditCustomComponent: (def) => openCustomComponentModal({ editDef: def }) });
  initKioskModeUi();
  initAnimationOverlay();
  initScene3DOverlay();
  initDuplicateTabWarning(showToast);

  initKeyboardShortcuts();
  requestAnimationFrame(() => initHints());
  requestAnimationFrame(() => initOnboardingChecklistWidget());
  requestAnimationFrame(() => maybeShowFeatureSuggestionBanner());
  registerServiceWorker();

  markVersionSeen();
  if (whatsNew.show) requestAnimationFrame(() => openWhatsNewModal(whatsNew.highlights));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
