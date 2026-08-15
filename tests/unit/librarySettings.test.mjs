import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getLibrarySettings, saveLibrarySettings, onLibrarySettingsChange, DEFAULT_LIBRARY_SETTINGS } from '../../js/io/librarySettings.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getLibrarySettings returns the built-in defaults when nothing is saved', () => {
  assert.deepEqual(getLibrarySettings(), DEFAULT_LIBRARY_SETTINGS);
});

test('saveLibrarySettings persists a partial update, preserving the rest', () => {
  saveLibrarySettings({ hideStateMachines: true });
  assert.equal(getLibrarySettings().hideStateMachines, true);
});

test('onLibrarySettingsChange notifies listeners with the updated settings', () => {
  let received = null;
  const unsubscribe = onLibrarySettingsChange((settings) => { received = settings; });
  saveLibrarySettings({ hideStateMachines: true });
  assert.equal(received.hideStateMachines, true);
  unsubscribe();
});
