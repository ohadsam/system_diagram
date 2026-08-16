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

export const DEFAULT_UI_PREFS = {
  showGrid: false,
  contextRowMode: 'floating',
};

export function getUiPrefs() {
  const stored = readJSON(KEY, {});
  return {
    ...DEFAULT_UI_PREFS,
    ...stored,
    contextRowMode: CONTEXT_ROW_MODES.includes(stored.contextRowMode) ? stored.contextRowMode : DEFAULT_UI_PREFS.contextRowMode,
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
