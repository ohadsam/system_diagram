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
// 'system' follows the OS-level prefers-color-scheme; 'light'/'dark' is an
// explicit override — see css/variables.css's dark-mode token block and
// io/theme.js, which is what actually applies this to the page.
export const THEME_MODES = ['system', 'light', 'dark'];

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
};

export function getUiPrefs() {
  const stored = readJSON(KEY, {});
  return {
    ...DEFAULT_UI_PREFS,
    ...stored,
    contextRowMode: CONTEXT_ROW_MODES.includes(stored.contextRowMode) ? stored.contextRowMode : DEFAULT_UI_PREFS.contextRowMode,
    theme: THEME_MODES.includes(stored.theme) ? stored.theme : DEFAULT_UI_PREFS.theme,
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
