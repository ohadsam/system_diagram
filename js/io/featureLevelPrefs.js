// Persisted choice for core/featureLevels.js's basic/advanced/custom
// toggle — same tiny read/write/subscribe shape as librarySettings.js, but
// deliberately its own storage key and listener set rather than folded
// into io/uiPrefs.js: uiPrefs.js's listeners fire on *every* misc UI
// toggle (grid, minimap, focus mode, ...), several of which flip
// constantly while working. toolbar.js needs to rebuild the gated
// dropdown panels (destroying and recreating their buttons, badges and
// subscriptions) whenever the feature-level choice actually changes — that
// would be far too disruptive to also run on an unrelated "toggled Snap
// Guides" write, so this stays a separate, narrowly-scoped pub-sub.
import { readJSON, writeJSON } from './storage.js';
import { FEATURE_PACK_IDS } from '../core/featureLevels.js';

const KEY = 'featureLevel';
const listeners = new Set();

// 'advanced' (show everything) is the safe pure fallback — identical to
// this app's behavior before this system existed. The *actual* default for
// a brand-new visitor ('basic') is applied once, explicitly, by
// io/firstVisitDefaults.js — never here, so this module's own defaults
// stay a simple, side-effect-free read.
export const DEFAULT_FEATURE_LEVEL_PREFS = {
  featureMode: 'advanced',
  enabledPacks: [...FEATURE_PACK_IDS],
};

export function getFeatureLevelPrefs() {
  const stored = readJSON(KEY, {});
  return { ...DEFAULT_FEATURE_LEVEL_PREFS, ...stored };
}

export function saveFeatureLevelPrefs(partial) {
  const next = { ...getFeatureLevelPrefs(), ...partial };
  writeJSON(KEY, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function onFeatureLevelChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
