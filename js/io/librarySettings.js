// App-level component-library settings: whether to hide the "State
// Machines" category/patterns from the sidebar (purely a browse/search
// filter — never touches state-machine content already placed on a
// diagram), whether to show the "Smart Suggestions" banner
// (canvas/suggestions.js) after placing a component, and whether the
// sidebar defaults to a compact view (Favorites/Recently Used/My
// Components only, full category browser one click away — see
// sidebar.js's own toggle button) or the full always-expanded category
// list it originally shipped with.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'librarySettings';
const listeners = new Set();

export const DEFAULT_LIBRARY_SETTINGS = {
  hideStateMachines: false,
  suggestionsEnabled: true,
  // 'false' (show every category by default) is the pure fallback here —
  // identical to this app's original sidebar. The *actual* default for a
  // brand-new visitor ('true', compact) is applied once, explicitly, by
  // io/firstVisitDefaults.js, mirroring featureLevelPrefs.js's own
  // fallback-vs-first-visit split.
  compactSidebar: false,
};

export function getLibrarySettings() {
  return { ...DEFAULT_LIBRARY_SETTINGS, ...readJSON(KEY, {}) };
}

export function saveLibrarySettings(partial) {
  const next = { ...getLibrarySettings(), ...partial };
  writeJSON(KEY, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function onLibrarySettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
