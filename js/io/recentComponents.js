// "Recently Used" components — the last few component defIds actually
// placed on the canvas (see canvas.js#createNodeFromDrop, the single choke
// point both drag-from-sidebar and click-to-add go through), shown as a
// pinned sidebar section alongside Favorites. Same storage.js-backed,
// listener-notified shape as io/librarySettings.js/io/favorites.js.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'recentComponents';
const MAX_RECENT = 8;

const listeners = new Set();

function readIds() {
  const parsed = readJSON(KEY, []);
  return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : [];
}

function writeIds(ids) {
  writeJSON(KEY, ids);
  for (const fn of listeners) fn();
}

export function getRecentComponentIds() {
  return readIds();
}

/** Moves `defId` to the front of the recency list (or inserts it), capped
 * to MAX_RECENT — called once per real placement, not for every internal
 * node-creation path (pattern/layer/replication-mirror sub-nodes aren't
 * "you chose this component from the sidebar" in the same sense). */
export function recordComponentUsed(defId) {
  if (!defId) return;
  const ids = readIds().filter((id) => id !== defId);
  ids.unshift(defId);
  writeIds(ids.slice(0, MAX_RECENT));
}

export function onRecentComponentsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
