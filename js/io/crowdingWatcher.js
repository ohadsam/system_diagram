// Proactive nudge for core/crowdingDetect.js's overlap/uneven-spacing
// detector, plus core/labelSpacing.js's own "a label doesn't have room"
// signal — surfaces a dismissible on-canvas suggestion
// (hints/crowdingSuggestionBanner.js) offering a one-click spacing fix
// (canvas/canvas.js#applyAutoSpacingFix) the moment a settled edit (adding
// a component, drawing a connector, typing a label, ...) leaves the
// diagram looking cramped. Same 800ms-debounce-on-store-'change' shape as
// io/lintWatcher.js/io/autoSuggestWatcher.js, and — like lintWatcher, never
// autoSuggestWatcher's AI/API-backed one — purely offline, so it can just
// be on by default.
import * as store from '../core/store.js';
import { detectCrowding, MIN_BREATHING_GAP_PX } from '../core/crowdingDetect.js';
import { spreadNodesForLabels } from '../core/labelSpacing.js';
import { getUiPrefs, onUiPrefsChange } from './uiPrefs.js';

const DEBOUNCE_MS = 800;

let debounceTimer = null;
let onSuggestion = null;
// The fingerprint (sorted, comma-joined affected node ids) of whichever
// crowding state was last surfaced-or-current — deliberately a single
// value, not a growing seen-set like lintWatcher's (this feature only ever
// has one "current" suggestion, not an independent list of findings).
// Comparing against it is what makes dismissal need no bookkeeping of its
// own: dismissing doesn't edit the diagram, so no new 'change' event fires,
// so this stays exactly as-is and the *same* still-unresolved state is
// never re-suggested — only a genuinely *different* affected set (or the
// same one reappearing after being fixed and reintroduced) looks "new"
// again, the same philosophy lintWatcher's seenFindingIds already uses.
let lastFingerprint = null;
let initialized = false;

function fingerprintOf(nodeIds) {
  return [...nodeIds].sort().join(',');
}

/** Pure decision core, unit-tested directly without touching setTimeout/
 * store — same split as io/lintWatcher.js#pickNewFinding/
 * io/autoSuggestWatcher.js#nextAutoSuggestState. Folds in
 * core/labelSpacing.js's own "would a label not fit" signal alongside
 * core/crowdingDetect.js's overlap/uneven-spacing one, since a connector
 * label crammed against its endpoints is the same kind of "this doesn't
 * read cleanly" problem "texts and arrows" are, per this feature's own
 * brief, even though it's detected by a different, already-existing rule.
 * @param {object[]} nodes @param {object[]} edges @param {string|null} prevFingerprint
 * @returns {{suggestion: {affectedNodeIds:string[], targetGap:number}|null, nextFingerprint: string|null}} */
export function pickCrowdingSuggestion(nodes, edges, prevFingerprint) {
  const crowding = detectCrowding(nodes);
  const labelMoves = spreadNodesForLabels(nodes, edges);
  const affected = new Set(crowding?.affectedNodeIds ?? []);
  for (const id of labelMoves.keys()) affected.add(id);
  if (!affected.size) return { suggestion: null, nextFingerprint: null };

  const fingerprint = fingerprintOf(affected);
  if (fingerprint === prevFingerprint) return { suggestion: null, nextFingerprint: fingerprint };
  return {
    suggestion: { affectedNodeIds: [...affected], targetGap: crowding?.targetGap ?? MIN_BREATHING_GAP_PX },
    nextFingerprint: fingerprint,
  };
}

function onSettledChange() {
  if (!getUiPrefs().proactiveSpacingNudges) return;
  const state = store.getState();
  const { suggestion, nextFingerprint } = pickCrowdingSuggestion(state.nodes, state.edges, lastFingerprint);
  lastFingerprint = nextFingerprint;
  if (suggestion && onSuggestion) onSuggestion(suggestion);
}

/** @param {(suggestion: {affectedNodeIds:string[], targetGap:number}) => void} readyCallback */
export function initCrowdingWatcher(readyCallback) {
  if (initialized) return;
  initialized = true;
  onSuggestion = readyCallback;
  // A diagram that was already crowded when the page loaded (an imported
  // project, a reload) shouldn't immediately nag — only a state that
  // *changes* after this session starts editing is worth interrupting for.
  const state = store.getState();
  const { nextFingerprint } = pickCrowdingSuggestion(state.nodes, state.edges, null);
  lastFingerprint = nextFingerprint;
  store.subscribe('change', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onSettledChange, DEBOUNCE_MS);
  });
  // Resync the baseline on re-enabling, so turning the toggle back on
  // doesn't immediately surface whatever's currently on screen — mirrors
  // lintWatcher's identical re-enable handling.
  onUiPrefsChange((prefs) => {
    if (prefs.proactiveSpacingNudges) {
      const s = store.getState();
      lastFingerprint = pickCrowdingSuggestion(s.nodes, s.edges, null).nextFingerprint;
    }
  });
}
