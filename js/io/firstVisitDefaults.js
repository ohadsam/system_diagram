// One-time decision, made exactly once per browser: should this visitor's
// toolbar/sidebar start simplified (a brand-new visitor, nothing at all in
// storage yet) or exactly as before (a returning visitor, who may already
// rely on a toolbar button or sidebar layout this batch would otherwise
// hide)? Mirrors io/whatsNew.js's own "nothing at all in storage" check
// for the exact same reason: `getFeatureLevelPrefs()`/`getLibrarySettings()`
// alone can't tell "never touched" apart from "explicitly chose the
// default value", and a returning visitor must never be regressed by a
// batch that ships new hide-by-default behavior.
//
// Must run before anything else touches storage (same requirement as
// initStorageBackend — see main.js#boot), and gates itself with its own
// flag key so a page reload *during* someone's very first session doesn't
// re-run this with autosave/prefs keys now present and wrongly conclude
// they're "returning".
import { readJSON, writeJSON, listKeysWithPrefix } from './storage.js';
import { saveFeatureLevelPrefs } from './featureLevelPrefs.js';
import { saveLibrarySettings } from './librarySettings.js';

const FLAG_KEY = 'firstVisitDefaultsApplied';

export function applyFirstVisitDefaultsIfNeeded() {
  if (readJSON(FLAG_KEY, false)) return;
  const isBrandNewVisitor = listKeysWithPrefix('').length === 0;
  if (isBrandNewVisitor) {
    saveFeatureLevelPrefs({ featureMode: 'basic' });
    saveLibrarySettings({ compactSidebar: true });
  }
  writeJSON(FLAG_KEY, true);
}
