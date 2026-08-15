// Tracks which app version a visitor last saw, driving the "What's New"
// modal (see modals/whatsNewModal.js). A brand-new visitor (nothing at all
// in storage yet) skips it — the hints tour already covers onboarding —
// but a returning visitor (any prior app data, even from before version
// tracking existed) sees it once, listing every version's highlights newer
// than what they last saw.
import { readJSON, writeJSON, listKeysWithPrefix } from './storage.js';
import { APP_VERSION, VERSION_HISTORY } from '../version.js';

const KEY = 'lastSeenVersion';

export function getLastSeenVersion() {
  return readJSON(KEY, null);
}

export function markVersionSeen(version = APP_VERSION) {
  writeJSON(KEY, version);
}

/** Highlights strictly newer than `fromVersion`, newest first. Unknown/missing version = everything. */
export function getUnseenHighlights(fromVersion) {
  const idx = VERSION_HISTORY.findIndex((v) => v.version === fromVersion);
  return idx === -1 ? VERSION_HISTORY : VERSION_HISTORY.slice(0, idx);
}

/** Whether to auto-show the "What's New" modal on this boot, and what to show. */
export function checkWhatsNew() {
  const last = getLastSeenVersion();
  if (last === APP_VERSION) return { show: false, highlights: [] };
  if (last === null && listKeysWithPrefix('').length === 0) {
    return { show: false, highlights: [] };
  }
  return { show: true, highlights: getUnseenHighlights(last) };
}
