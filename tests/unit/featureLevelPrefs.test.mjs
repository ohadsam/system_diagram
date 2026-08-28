import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getFeatureLevelPrefs, saveFeatureLevelPrefs, onFeatureLevelChange, DEFAULT_FEATURE_LEVEL_PREFS } from '../../js/io/featureLevelPrefs.js';
import { FEATURE_PACK_IDS } from '../../js/core/featureLevels.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getFeatureLevelPrefs returns the built-in defaults when nothing is saved', () => {
  assert.deepEqual(getFeatureLevelPrefs(), DEFAULT_FEATURE_LEVEL_PREFS);
});

test('the pure default is "advanced" with every pack listed — never regresses an untouched caller', () => {
  assert.equal(DEFAULT_FEATURE_LEVEL_PREFS.featureMode, 'advanced');
  assert.deepEqual(DEFAULT_FEATURE_LEVEL_PREFS.enabledPacks, FEATURE_PACK_IDS);
});

test('saveFeatureLevelPrefs persists a partial update, preserving the rest', () => {
  saveFeatureLevelPrefs({ featureMode: 'basic' });
  const prefs = getFeatureLevelPrefs();
  assert.equal(prefs.featureMode, 'basic');
  assert.deepEqual(prefs.enabledPacks, FEATURE_PACK_IDS);
});

test('onFeatureLevelChange notifies listeners with the updated prefs', () => {
  let received = null;
  const unsubscribe = onFeatureLevelChange((prefs) => { received = prefs; });
  saveFeatureLevelPrefs({ featureMode: 'custom', enabledPacks: ['ai-tools'] });
  assert.equal(received.featureMode, 'custom');
  assert.deepEqual(received.enabledPacks, ['ai-tools']);
  unsubscribe();
});
