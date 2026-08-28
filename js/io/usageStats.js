// Minimal, privacy-local usage tracking — how many times this browser has
// booted the app, and the progressive-unlock nudge's own shown/dismissed
// state (core/featureLevels.js#getDueSuggestionMilestone reads this).
// Never leaves the browser and drives nothing except that one nudge.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'usageStats';

const DEFAULT_USAGE_STATS = {
  sessionCount: 0,
  suggestionsShownAtSessions: [],
  suggestionDismissedForever: false,
};

export function getUsageStats() {
  return { ...DEFAULT_USAGE_STATS, ...readJSON(KEY, {}) };
}

function save(partial) {
  const next = { ...getUsageStats(), ...partial };
  writeJSON(KEY, next);
  return next;
}

/** Call once per app boot (main.js). Returns the updated stats so the
 * caller can decide whether a suggestion nudge is due without a second read. */
export function recordSessionStart() {
  const current = getUsageStats();
  return save({ sessionCount: current.sessionCount + 1 });
}

export function markSuggestionShown(milestone) {
  const current = getUsageStats();
  if (current.suggestionsShownAtSessions.includes(milestone)) return current;
  return save({ suggestionsShownAtSessions: [...current.suggestionsShownAtSessions, milestone] });
}

export function dismissSuggestionForever() {
  return save({ suggestionDismissedForever: true });
}
