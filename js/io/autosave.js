// Always-on autosave: every store change is debounced and written to a
// fixed localStorage slot, restored automatically on next page load.
import * as store from '../core/store.js';
import { readJSON, writeJSON } from './storage.js';
import { validateProject } from '../core/project.js';
import { debounce } from '../utils/debounce.js';

const KEY = 'autosave';
const DEBOUNCE_MS = 500;

export function restoreAutosavedProject() {
  const raw = readJSON(KEY, null);
  if (!raw) return null;
  const result = validateProject(raw);
  return result.ok ? result.project : null;
}

export function hasAutosave() {
  return !!readJSON(KEY, null);
}

const persist = debounce((state) => writeJSON(KEY, state), DEBOUNCE_MS);

export function initAutosave() {
  store.subscribe('change', persist);
}

export function clearAutosave() {
  writeJSON(KEY, null);
}
