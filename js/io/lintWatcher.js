// Proactive nudge for core/diagramLint.js's own findings — previously the
// only way to see a real structural issue (an unconnected component, a
// client talking straight to a database, ...) was to remember to open
// "🔍 Check Diagram" yourself. This watches for settled diagram edits (same
// 800ms-debounce-on-store-'change' idea as io/autoSuggestWatcher.js, so a
// drag or a burst of keystrokes counts as the one edit it actually is, not
// dozens) and surfaces a toast the first time a *new* finding appears —
// deliberately never AI/API-backed like autoSuggestWatcher, so it needs no
// configuration and can just be on by default; nothing here ever makes a
// network call.
import * as store from '../core/store.js';
import { computeDiagramLint, computeCustomLint } from '../core/diagramLint.js';
import { getCustomLintRules } from './customLintRules.js';
import { getUiPrefs, onUiPrefsChange } from './uiPrefs.js';

const DEBOUNCE_MS = 800;

let debounceTimer = null;
let resolveDef = null;
let onNewFinding = null;
// Ids already surfaced this session (or already present when the watcher
// started) — never renotified even if the finding is still there, so
// fixing 4 of 5 issues and leaving 1 doesn't re-toast that same 1 on every
// subsequent edit. Resets on page reload, same as autoSuggestWatcher's own
// in-memory counters; nothing here is meant to be a persistent dismissal.
let seenFindingIds = new Set();
let initialized = false;

function computeAllFindings() {
  const state = store.getState();
  const builtIn = computeDiagramLint(state.nodes, state.edges, state.replicationPairs, resolveDef);
  const custom = computeCustomLint(state.nodes, state.edges, getCustomLintRules(), resolveDef);
  return [...builtIn, ...custom];
}

/** Pure decision core, unit-tested directly (tests/unit/lintWatcher.test.mjs)
 * without touching setTimeout/store — same "separate the part genuinely
 * worth testing from the timer/store plumbing" split as
 * io/autoSuggestWatcher.js#nextAutoSuggestState. Returns the first finding
 * not already in `seenIds` (or null), plus the full id set findings should
 * be compared against next time.
 * @param {{id:string}[]} findings
 * @param {Set<string>} seenIds */
export function pickNewFinding(findings, seenIds) {
  const nextSeenIds = new Set(findings.map((f) => f.id));
  const freshFinding = findings.find((f) => !seenIds.has(f.id)) || null;
  return { freshFinding, nextSeenIds };
}

function onSettledChange() {
  if (!getUiPrefs().proactiveLintNudges) return;
  const findings = computeAllFindings();
  const { freshFinding, nextSeenIds } = pickNewFinding(findings, seenFindingIds);
  seenFindingIds = nextSeenIds;
  if (freshFinding && onNewFinding) onNewFinding(freshFinding, findings.length);
}

/**
 * @param {(defId: string) => {categoryId?: string, name?: string}|null} resolveComponentDef
 * @param {(finding: object, totalCount: number) => void} readyCallback
 */
export function initLintWatcher(resolveComponentDef, readyCallback) {
  if (initialized) return;
  initialized = true;
  resolveDef = resolveComponentDef;
  onNewFinding = readyCallback;
  // Anything already wrong when the app loads (an imported project, a
  // reloaded page) shouldn't immediately toast — only a finding that
  // appears *after* this session starts editing is "new" in any useful
  // sense to the person currently at the keyboard.
  seenFindingIds = new Set(computeAllFindings().map((f) => f.id));
  store.subscribe('change', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onSettledChange, DEBOUNCE_MS);
  });
  // Turning the toggle back on shouldn't immediately dump every
  // already-existing issue as "new" — resync the baseline the same way
  // startup does, so only what changes *after* re-enabling gets toasted.
  onUiPrefsChange((prefs) => {
    if (prefs.proactiveLintNudges) seenFindingIds = new Set(computeAllFindings().map((f) => f.id));
  });
}
