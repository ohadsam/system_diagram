// Generic "recently used" tracker shared by every menu that wants a
// "recent" section — the components sidebar, the Command Palette, and each
// toolbar dropdown (File/Create/Tools/Help). One storage-backed module
// instead of a bespoke list-and-cap per surface, so "how many to remember"
// is a single per-scope setting a user can tune from Default Settings
// (see js/modals/defaultSettingsModal.js's "🕐 Recently Used" section)
// instead of each surface hardcoding its own number.
//
// io/recentComponents.js (pre-dates this module) is now a thin wrapper
// around the 'components' scope here, keeping its own existing call sites
// (sidebar.js, canvas.js) and tests untouched.
import { readJSON, writeJSON } from './storage.js';

const LIMITS_KEY = 'recentItemLimits';
const idsKey = (scopeId) => `recentItems:${scopeId}`;

/** Every scope with a "Recently Used" area, and the bounds a user can tune
 * its retention count to. `defaultLimit` mirrors what each surface would
 * have hardcoded on its own — e.g. the components sidebar previously capped
 * at a fixed 8; 20 gives a browsing session more headroom now that it's
 * user-adjustable. Add an entry here (plus a getRecentItemIds/recordItemUsed
 * call site) for any future menu that wants the same treatment. */
export const RECENT_SCOPES = [
  { id: 'components', label: 'Components sidebar ("Recently Used")', defaultLimit: 20, min: 5, max: 50 },
  { id: 'commands', label: 'Command Palette (⌘/Ctrl+K)', defaultLimit: 5, min: 3, max: 20 },
  { id: 'file-menu', label: '"File" toolbar menu', defaultLimit: 5, min: 3, max: 15 },
  { id: 'create-menu', label: '"Create" toolbar menu', defaultLimit: 5, min: 3, max: 15 },
  { id: 'tools-menu', label: '"Tools" toolbar menu', defaultLimit: 5, min: 3, max: 15 },
  { id: 'help-menu', label: '"Help" toolbar menu', defaultLimit: 3, min: 3, max: 10 },
];

function scopeDef(scopeId) {
  return RECENT_SCOPES.find((s) => s.id === scopeId) || { id: scopeId, defaultLimit: 5, min: 1, max: 50 };
}

function clampLimit(scopeId, value) {
  const def = scopeDef(scopeId);
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return def.defaultLimit;
  return Math.max(def.min, Math.min(def.max, n));
}

const limitListeners = new Set();

export function getRecentItemLimits() {
  const stored = readJSON(LIMITS_KEY, {});
  const out = {};
  for (const scope of RECENT_SCOPES) out[scope.id] = clampLimit(scope.id, stored?.[scope.id] ?? scope.defaultLimit);
  return out;
}

/** Merges `partial` ({scopeId: limit}) into the saved limits, clamping each
 * value to its scope's [min, max]. Also immediately trims any already-
 * longer stored recent list down to a newly-lowered limit — otherwise a
 * surface would keep showing more items than the new setting until its next
 * recordItemUsed call happened to push the list back under the cap. */
export function saveRecentItemLimits(partial) {
  const next = { ...getRecentItemLimits() };
  for (const [scopeId, value] of Object.entries(partial)) next[scopeId] = clampLimit(scopeId, value);
  writeJSON(LIMITS_KEY, next);
  for (const scopeId of Object.keys(partial)) {
    const ids = readIds(scopeId);
    if (ids.length > next[scopeId]) writeIds(scopeId, ids.slice(0, next[scopeId]));
  }
  for (const fn of limitListeners) fn(next);
  return next;
}

export function onRecentItemLimitsChange(fn) {
  limitListeners.add(fn);
  return () => limitListeners.delete(fn);
}

function readIds(scopeId) {
  const parsed = readJSON(idsKey(scopeId), []);
  return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : [];
}

const itemListeners = new Map(); // scopeId -> Set(fn)

function writeIds(scopeId, ids) {
  writeJSON(idsKey(scopeId), ids);
  for (const fn of itemListeners.get(scopeId) || []) fn();
}

export function getRecentItemIds(scopeId) {
  const limit = getRecentItemLimits()[scopeId] ?? scopeDef(scopeId).defaultLimit;
  return readIds(scopeId).slice(0, limit);
}

/** Moves `id` to the front of `scopeId`'s recency list (or inserts it),
 * capped to that scope's current limit. */
export function recordItemUsed(scopeId, id) {
  if (!id) return;
  const limit = getRecentItemLimits()[scopeId] ?? scopeDef(scopeId).defaultLimit;
  const ids = readIds(scopeId).filter((existing) => existing !== id);
  ids.unshift(id);
  writeIds(scopeId, ids.slice(0, limit));
}

export function onRecentItemsChange(scopeId, fn) {
  if (!itemListeners.has(scopeId)) itemListeners.set(scopeId, new Set());
  itemListeners.get(scopeId).add(fn);
  return () => itemListeners.get(scopeId)?.delete(fn);
}

export function clearRecentItems(scopeId) {
  writeIds(scopeId, []);
}
