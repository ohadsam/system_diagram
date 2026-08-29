// Small "misc UI chrome" preferences — the canvas grid toggle and the
// contextual style row's display mode (floating near the selection, or
// pinned to the top/bottom of the screen). Same read/write/subscribe shape
// as librarySettings.js, kept under the same 'prefs' localStorage key the
// grid toggle already used before this module existed (not renamed, so an
// existing visitor's grid preference isn't silently reset).
import { readJSON, writeJSON } from './storage.js';

const KEY = 'prefs';
const listeners = new Set();

export const CONTEXT_ROW_MODES = ['floating', 'pinned-top', 'pinned-bottom'];
// panel/aiChatPanel.js's own screen position — 'right' behaves like the AI
// Design Review panel (in-flow, docked), 'bottom' is a fixed drawer along
// the bottom edge, 'floating' is a freely draggable card (see
// aiChatFloatingPos below).
export const AI_CHAT_DOCK_MODES = ['right', 'bottom', 'floating'];
// 'system' follows the OS-level prefers-color-scheme; 'light'/'dark' is an
// explicit override — see css/variables.css's dark-mode token block and
// io/theme.js, which is what actually applies this to the page.
export const THEME_MODES = ['system', 'light', 'dark'];
export const LANGUAGES = ['en', 'he'];

export const DEFAULT_UI_PREFS = {
  showGrid: false,
  contextRowMode: 'floating',
  // Figma-like "snap into place" guides while dragging a node/selection —
  // see core/alignmentGuides.js. On by default; canvas/nodeInteractions.js
  // reads this on every drag move.
  alignGuides: true,
  theme: 'system',
  // On-canvas minimap overlay (see canvas/minimap.js) — off by default,
  // same reasoning as showGrid: useful chrome that would otherwise clutter
  // every new visitor's first look at an empty canvas.
  showMinimap: false,
  // Dim everything not directly connected to the current selection — see
  // canvas/canvas.js#applyFocusDimming. Off by default; only takes effect
  // once something is actually selected.
  focusMode: false,
  // Animated dots flowing along every connector in its direction, to
  // visualize traffic — see canvas/canvas.js#setFlowSimulationEnabled. Off
  // by default, same reasoning as showGrid/showMinimap.
  flowSimulation: false,
  // UI chrome language — see io/i18n.js. Component library names,
  // descriptions, and help.html are deliberately untranslated (a much
  // larger, separate content-translation project); this only affects the
  // toolbar/panels/modals' own copy.
  language: 'en',
  aiChatDockMode: 'right',
  // Only meaningful in 'floating' mode — the floating card's last dragged
  // position ({x, y} viewport px from the top-left) so it reopens where it
  // was left instead of snapping back to a default corner every time. null
  // until the user has dragged it at least once.
  aiChatFloatingPos: null,
};

export function getUiPrefs() {
  const stored = readJSON(KEY, {});
  return {
    ...DEFAULT_UI_PREFS,
    ...stored,
    contextRowMode: CONTEXT_ROW_MODES.includes(stored.contextRowMode) ? stored.contextRowMode : DEFAULT_UI_PREFS.contextRowMode,
    theme: THEME_MODES.includes(stored.theme) ? stored.theme : DEFAULT_UI_PREFS.theme,
    language: LANGUAGES.includes(stored.language) ? stored.language : DEFAULT_UI_PREFS.language,
    aiChatDockMode: AI_CHAT_DOCK_MODES.includes(stored.aiChatDockMode) ? stored.aiChatDockMode : DEFAULT_UI_PREFS.aiChatDockMode,
    aiChatFloatingPos: (stored.aiChatFloatingPos && typeof stored.aiChatFloatingPos.x === 'number' && typeof stored.aiChatFloatingPos.y === 'number')
      ? { x: stored.aiChatFloatingPos.x, y: stored.aiChatFloatingPos.y }
      : null,
  };
}

export function saveUiPrefs(partial) {
  const next = { ...getUiPrefs(), ...partial };
  writeJSON(KEY, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function onUiPrefsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
