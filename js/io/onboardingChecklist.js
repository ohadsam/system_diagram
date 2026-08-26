// Persisted on/off state for the "getting started" checklist widget (see
// core/onboardingChecklist.js for what it tracks and
// hints/onboardingChecklistWidget.js for the UI) — same tiny
// readJSON/writeJSON flag shape as hints.js's own enabled/dismissed keys.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'onboardingChecklistDismissed';

export function isOnboardingChecklistDismissed() {
  return readJSON(KEY, false) === true;
}

export function dismissOnboardingChecklist() {
  writeJSON(KEY, true);
}
