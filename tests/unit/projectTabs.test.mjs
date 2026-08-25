import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { createEmptyProject } from '../../js/core/project.js';
import * as store from '../../js/core/store.js';
import { listSavedProjects } from '../../js/io/projects.js';
import {
  getOpenTabIds, getTabDisplayInfo, ensureCurrentTabRegistered,
  switchToProjectTab, openNewProjectTab, closeProjectTab,
} from '../../js/io/projectTabs.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => {
  resetStorage();
  store.loadProject(createEmptyProject('Untitled Diagram'));
});

test('ensureCurrentTabRegistered persists the live project and registers it as the first tab', () => {
  const before = store.getState();
  assert.equal(listSavedProjects().length, 0, 'a brand-new unsaved project should not exist in saved projects yet');
  ensureCurrentTabRegistered();
  assert.deepEqual(getOpenTabIds(), [before.id]);
  assert.equal(listSavedProjects().length, 1, 'ensureCurrentTabRegistered auto-saves it for real');
});

test('ensureCurrentTabRegistered is a no-op once a tab is already registered', () => {
  ensureCurrentTabRegistered();
  const idsAfterFirst = getOpenTabIds();
  ensureCurrentTabRegistered();
  assert.deepEqual(getOpenTabIds(), idsAfterFirst);
});

test('openNewProjectTab creates a second tab and switches the live canvas to it', () => {
  const first = store.getState();
  openNewProjectTab();
  const second = store.getState();
  assert.notEqual(second.id, first.id);
  assert.deepEqual(getOpenTabIds(), [first.id, second.id]);
  // The outgoing tab's content was persisted, not lost.
  assert.equal(listSavedProjects().find((p) => p.id === first.id)?.id, first.id);
});

test('switchToProjectTab saves the outgoing tab and loads the target', () => {
  const first = store.getState();
  openNewProjectTab();
  const second = store.getState();

  // Make an edit on tab 2, then switch back to tab 1.
  store.dispatch((draft) => { draft.name = 'Renamed Second'; });
  switchToProjectTab(first.id);
  assert.equal(store.getState().id, first.id);

  // Switching back to tab 2 should show the edit made just before leaving it.
  switchToProjectTab(second.id);
  assert.equal(store.getState().name, 'Renamed Second');
});

test('switchToProjectTab to the already-active tab is a harmless no-op', () => {
  ensureCurrentTabRegistered();
  const id = store.getState().id;
  switchToProjectTab(id);
  assert.equal(store.getState().id, id);
  assert.deepEqual(getOpenTabIds(), [id]);
});

test('closeProjectTab removes it from the list without deleting the saved project', () => {
  const first = store.getState();
  openNewProjectTab();
  const second = store.getState();
  closeProjectTab(first.id);
  assert.deepEqual(getOpenTabIds(), [second.id]);
  assert.ok(listSavedProjects().some((p) => p.id === first.id), 'closing a tab must not delete the underlying saved project');
});

test('closeProjectTab on the active tab switches the live canvas to another open tab', () => {
  const first = store.getState();
  openNewProjectTab();
  const second = store.getState();
  closeProjectTab(second.id);
  assert.equal(store.getState().id, first.id);
  assert.deepEqual(getOpenTabIds(), [first.id]);
});

test('closeProjectTab refuses to close the last remaining tab', () => {
  ensureCurrentTabRegistered();
  const id = store.getState().id;
  closeProjectTab(id);
  assert.deepEqual(getOpenTabIds(), [id]);
});

test('getTabDisplayInfo resolves names from saved projects, falling back to the live state for an unsaved current tab', () => {
  const state = store.getState();
  // Simulate a tab id that's the live project but not yet in openTabIds/saved.
  const info = getTabDisplayInfo(state);
  assert.deepEqual(info, []); // nothing registered yet
  ensureCurrentTabRegistered();
  const info2 = getTabDisplayInfo(store.getState());
  assert.equal(info2[0].name, 'Untitled Diagram');
});
