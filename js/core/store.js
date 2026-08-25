// Single source of truth for the whole app. See ARCHITECTURE.md "State flow".
import { History } from './history.js';
import { createEmptyProject, touch } from './project.js';
import { syncReplication } from './replication.js';

const listeners = { change: new Set(), selection: new Set() };
const history = new History();

let state = createEmptyProject();
let selection = { nodeIds: [], edgeIds: [] };
history.init(state);

function emit(event, payload) {
  for (const fn of listeners[event]) fn(payload);
}

export function getState() {
  return state;
}

export function getSelection() {
  return selection;
}

/** @param {'change'|'selection'} event */
export function subscribe(event, fn) {
  listeners[event].add(fn);
  return () => listeners[event].delete(fn);
}

/**
 * Apply `mutator(draft)` to a clone of the current state and publish it.
 * Pass `{ coalesce: true }` for high-frequency updates (drag/resize) so a
 * whole gesture becomes a single undo step — call `commitHistory()` once
 * the gesture ends.
 */
export function dispatch(mutator, opts = {}) {
  const prev = state;
  const draft = structuredClone(state);
  mutator(draft);
  // Diffing against `prev` (the state as it was just before this mutation)
  // is what lets syncReplication tell which side of a pair actually
  // changed in this one action — see core/replication.js.
  const synced = syncReplication(prev, draft);
  touch(synced);
  state = synced;
  if (!opts.coalesce) history.commit(state);
  emit('change', state);
}

export function commitHistory() {
  history.commit(state);
}

export function select(nodeIds = [], edgeIds = []) {
  selection = { nodeIds, edgeIds };
  emit('selection', selection);
}

export function clearSelection() {
  select([], []);
}

export function loadProject(project) {
  // Self-diff (same object as both prev/next): only structural fixups run
  // — a pair's unmapped-but-eligible members get mirrored, an orphaned
  // mapping gets dropped — never content propagation, since there's no
  // real "before" state to diff a freshly-loaded project against. This is
  // what makes an imported/pasted/AI-generated project's replicationPairs
  // "detect the existing state" correctly on first load — see
  // core/replication.js#syncReplication.
  state = syncReplication(project, project);
  selection = { nodeIds: [], edgeIds: [] };
  history.init(state);
  emit('change', state);
  emit('selection', selection);
}

export function undo() {
  const prev = history.undo();
  if (!prev) return;
  state = prev;
  select([], []);
  emit('change', state);
}

export function redo() {
  const next = history.redo();
  if (!next) return;
  state = next;
  select([], []);
  emit('change', state);
}

export function canUndo() {
  return history.canUndo();
}

export function canRedo() {
  return history.canRedo();
}

/** For modals/historyTimelineModal.js — see History#getTimeline. */
export function getHistoryTimeline() {
  return history.getTimeline();
}

/** For modals/historyTimelineModal.js — see History#jumpTo. */
export function jumpToHistoryIndex(index) {
  const snap = history.jumpTo(index);
  if (!snap) return;
  state = snap;
  select([], []);
  emit('change', state);
}
