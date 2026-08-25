// Persisted "open tabs" — an ordered list of saved-project ids the user has
// explicitly opened as a tab, plus which one is active. A thin layer over
// io/projects.js's existing named-saved-project storage, not a second,
// parallel document model: core/store.js still only ever holds one live
// project at a time, so switching tabs really is save-then-load (the same
// mechanism "Load" already used), and nothing about undo/redo, autosave, or
// the store's single-document assumption changes. See
// docs/ARCHITECTURE.md's "Diagram tabs" section.
import { readJSON, writeJSON } from './storage.js';
import { createEmptyProject } from '../core/project.js';
import { saveNamedProject, loadNamedProject, listSavedProjects } from './projects.js';
import * as store from '../core/store.js';

const KEY = 'openProjectTabs';

// Separate from store.subscribe('change', ...): closing/opening a tab that
// isn't the *active* one never touches store.loadProject, so it never fires
// the store's 'change' event — but toolbar/projectTabsBar.js still needs to
// know the tab list itself changed. writeState is the single choke point
// every tab-list mutation goes through, so notifying from here covers all
// of them (active-tab or not) without projectTabsBar having to guess which
// store events happen to correlate with a tab-list change.
const tabsChangedListeners = new Set();
export function subscribeTabsChanged(fn) {
  tabsChangedListeners.add(fn);
  return () => tabsChangedListeners.delete(fn);
}

function readState() {
  return readJSON(KEY, { tabIds: [] });
}

function writeState(state) {
  writeJSON(KEY, state);
  tabsChangedListeners.forEach((fn) => fn());
}

export function getOpenTabIds() {
  return readState().tabIds;
}

function addTabId(id) {
  const state = readState();
  if (!state.tabIds.includes(id)) {
    state.tabIds.push(id);
    writeState(state);
  }
}

export function closeTabId(id) {
  const state = readState();
  state.tabIds = state.tabIds.filter((t) => t !== id);
  writeState(state);
}

/** Resolves each open tab id to a display name — from the saved-projects
 * list, or (a tab that's the current live project but hasn't been
 * persisted as a real saved project yet — see ensurePersisted below, this
 * is a brief transitional state, not a normal one) from the live state
 * itself. */
export function getTabDisplayInfo(liveState) {
  const savedById = new Map(listSavedProjects().map((p) => [p.id, p]));
  return getOpenTabIds().map((id) => ({
    id,
    name: savedById.get(id)?.name || (liveState.id === id ? liveState.name : 'Untitled'),
  }));
}

function ensurePersisted(project) {
  const exists = listSavedProjects().some((p) => p.id === project.id);
  if (!exists) saveNamedProject(project);
}

/** Persists whatever's live right now back into its own saved-project slot
 * — called before switching away from it, so in-progress edits in the tab
 * being left aren't lost the next time it's switched back to (only one tab
 * is ever "live" in the store at a time; the rest sit in storage). */
function persistCurrent() {
  const state = store.getState();
  if (getOpenTabIds().includes(state.id)) saveNamedProject(state);
}

/** Bootstraps the tab list the first time it's used — the live canvas
 * becomes tab #1 (persisted for real if it wasn't already saved), so
 * opening a second tab has something to switch back to. Safe to call
 * repeatedly; a no-op once at least one tab is already registered. */
export function ensureCurrentTabRegistered() {
  if (getOpenTabIds().length) return;
  const state = store.getState();
  ensurePersisted(state);
  addTabId(state.id);
}

/** Switches the live canvas to the saved project `id`, opening it as a tab
 * if it wasn't already one. Saves the outgoing tab first. `addTabId(id)`
 * runs *before* `store.loadProject` deliberately — that call fires the
 * store's 'change' event synchronously, and anything re-rendering off of
 * it (toolbar/projectTabsBar.js) needs the tab-id bookkeeping to already
 * be in its final state by then, not updated a line later. */
export function switchToProjectTab(id) {
  ensureCurrentTabRegistered();
  if (id === store.getState().id) return;
  const result = loadNamedProject(id);
  if (!result.ok) return;
  persistCurrent();
  addTabId(id);
  store.loadProject(result.project);
}

/** Opens a brand-new blank diagram as an additional tab. See
 * switchToProjectTab's comment for why `addTabId` runs before
 * `store.loadProject`, not after. */
export function openNewProjectTab() {
  ensureCurrentTabRegistered();
  persistCurrent();
  const project = createEmptyProject();
  saveNamedProject(project);
  addTabId(project.id);
  store.loadProject(project);
}

/** Closes a tab (does not delete the underlying saved project). Closing the
 * active tab switches the live canvas to another open tab; the very last
 * remaining tab can't be closed — there must always be something open.
 * `closeTabId` runs before `store.loadProject` for the same reason
 * switchToProjectTab's `addTabId` does — see its comment. */
export function closeProjectTab(id) {
  const wasActive = id === store.getState().id;
  const remainingIds = getOpenTabIds().filter((t) => t !== id);
  if (wasActive) {
    if (!remainingIds.length) return;
    persistCurrent();
    const result = loadNamedProject(remainingIds[remainingIds.length - 1]);
    if (result.ok) {
      closeTabId(id);
      store.loadProject(result.project);
      return;
    }
  }
  closeTabId(id);
}
