// Background trigger for io/autoSuggest.js#runAutomaticSuggestions — runs
// the "💡 Suggestions" check on its own, without the AI Design Review
// panel needing to be open, once enough distinct diagram edits pile up.
// Deliberately counts edits, not elapsed time (see
// io/aiProviderKeys.js#DEFAULTS.autoSuggest's header comment for why:
// someone away from the keyboard for an hour shouldn't trigger an
// unprompted API call just because a timer elapsed, but someone who just
// added/edited a handful of components probably wants the check to run).
//
// "One edit" is the trailing edge of a short debounce window on store
// 'change' events, not a raw 'change' count — a single drag or resize
// gesture (or a burst of rapid keystrokes editing a label) fires 'change'
// on every frame/keystroke, which would wildly over-count a single
// intended action as dozens of "edits". Debouncing collapses a burst back
// down to the one edit it actually represents.
import * as store from '../core/store.js';
import { getAiProviderSettings, isAutomaticSendConfigured } from './aiProviderKeys.js';
import { runAutomaticSuggestions } from './autoSuggest.js';

const DEBOUNCE_MS = 800;

let debounceTimer = null;
let changesSinceLastRun = 0;
let running = false;
let onReady = null;

/** Pure decision core, unit-tested directly (tests/unit/autoSuggestWatcher.test.mjs)
 * without touching setTimeout/store: given the current settings/count/
 * in-flight state, decide whether this settled-change event should fire a
 * background run, and what the counter becomes either way. Kept separate
 * from onSettledChange() below so the counting/threshold logic (the part
 * genuinely worth testing) isn't entangled with the timer/store plumbing
 * (which isn't). */
export function nextAutoSuggestState({ enabled, everyNChanges, configured, changesSinceLastRun, running }) {
  if (!enabled || !configured) return { shouldRun: false, changesSinceLastRun: 0 };
  // A run already in flight: don't pile up concurrent calls or let the
  // counter cross the threshold again mid-flight — the next edit after
  // this run finishes starts counting fresh.
  if (running) return { shouldRun: false, changesSinceLastRun };
  const next = changesSinceLastRun + 1;
  if (next < everyNChanges) return { shouldRun: false, changesSinceLastRun: next };
  return { shouldRun: true, changesSinceLastRun: 0 };
}

/** @param {(findings: object[]) => void} readyCallback called with a
 * non-empty findings array once a background run parses cleanly. */
export function initAutoSuggestWatcher(readyCallback) {
  onReady = readyCallback;
  store.subscribe('change', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onSettledChange, DEBOUNCE_MS);
  });
}

function onSettledChange() {
  const { autoSuggest } = getAiProviderSettings();
  const decision = nextAutoSuggestState({
    enabled: autoSuggest.enabled,
    everyNChanges: autoSuggest.everyNChanges,
    configured: isAutomaticSendConfigured(),
    changesSinceLastRun,
    running,
  });
  changesSinceLastRun = decision.changesSinceLastRun;
  if (!decision.shouldRun) return;

  running = true;
  runAutomaticSuggestions()
    .then((result) => {
      running = false;
      if (result.ok && result.data.length && onReady) onReady(result.data);
    })
    // never surface an error for an unattended background check
    .catch(() => { running = false; });
}
