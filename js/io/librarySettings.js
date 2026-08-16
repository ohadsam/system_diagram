// App-level component-library settings: whether to hide the "State
// Machines" category/patterns from the sidebar (purely a browse/search
// filter — never touches state-machine content already placed on a
// diagram), and whether to show the "Smart Suggestions" banner
// (canvas/suggestions.js) after placing a component.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'librarySettings';
const listeners = new Set();

export const DEFAULT_LIBRARY_SETTINGS = {
  hideStateMachines: false,
  suggestionsEnabled: true,
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
