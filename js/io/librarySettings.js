// App-level component-library visibility settings — currently just
// whether to hide the "State Machines" category/patterns from the
// sidebar, for users who don't want that content cluttering the picker.
// Purely a browse/search filter: it never touches state-machine content
// that's already placed on a diagram.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'librarySettings';
const listeners = new Set();

export const DEFAULT_LIBRARY_SETTINGS = {
  hideStateMachines: false,
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
