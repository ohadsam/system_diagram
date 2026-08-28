import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { applyFirstVisitDefaultsIfNeeded } from '../../js/io/firstVisitDefaults.js';
import { getFeatureLevelPrefs } from '../../js/io/featureLevelPrefs.js';
import { getLibrarySettings } from '../../js/io/librarySettings.js';
import { writeJSON } from '../../js/io/storage.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('a brand-new visitor (nothing at all in storage) gets simplified defaults', () => {
  applyFirstVisitDefaultsIfNeeded();
  assert.equal(getFeatureLevelPrefs().featureMode, 'basic');
  assert.equal(getLibrarySettings().compactSidebar, true);
});

test('a returning visitor (any prior app data, even unrelated) keeps the original full defaults', () => {
  // Some completely unrelated key already exists — e.g. this visitor once
  // toggled dark mode long before this feature shipped.
  writeJSON('somePreExistingKey', true);
  applyFirstVisitDefaultsIfNeeded();
  assert.equal(getFeatureLevelPrefs().featureMode, 'advanced');
  assert.equal(getLibrarySettings().compactSidebar, false);
});

test('is idempotent: a second call in a later session never re-applies or overrides an explicit later choice', () => {
  applyFirstVisitDefaultsIfNeeded();
  assert.equal(getFeatureLevelPrefs().featureMode, 'basic');

  // The visitor explicitly switches to Advanced afterward...
  writeJSON('featureLevel', { featureMode: 'advanced', enabledPacks: [] });
  // ...and a reload calls this again — must not stomp their explicit choice.
  applyFirstVisitDefaultsIfNeeded();
  assert.equal(getFeatureLevelPrefs().featureMode, 'advanced');
});

test('a reload during the very first session (storage no longer literally empty) still counts as brand-new', () => {
  // Simulates: initStorageBackend + this function run once already this
  // session (setting the one-time flag), then the page reloads before the
  // user does anything else. A second read of "is storage empty" would
  // wrongly see the flag key itself and conclude "returning" — the guard
  // must prevent that from ever being evaluated a second time.
  applyFirstVisitDefaultsIfNeeded();
  const afterFirstBoot = getFeatureLevelPrefs();
  assert.equal(afterFirstBoot.featureMode, 'basic');

  applyFirstVisitDefaultsIfNeeded(); // simulated reload, same never-touched-anything-else state
  assert.equal(getFeatureLevelPrefs().featureMode, 'basic');
});
