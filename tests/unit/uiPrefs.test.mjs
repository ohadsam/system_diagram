import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getUiPrefs, saveUiPrefs, DEFAULT_UI_PREFS } from '../../js/io/uiPrefs.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getUiPrefs returns the built-in defaults when nothing is saved', () => {
  assert.deepEqual(getUiPrefs(), DEFAULT_UI_PREFS);
});

test('aiChatWidth/aiChatBottomHeight/aiChatFloatingHeight default to null and round-trip a saved number', () => {
  assert.equal(getUiPrefs().aiChatWidth, null);
  assert.equal(getUiPrefs().aiChatBottomHeight, null);
  assert.equal(getUiPrefs().aiChatFloatingHeight, null);

  saveUiPrefs({ aiChatWidth: 420, aiChatBottomHeight: 300, aiChatFloatingHeight: 560 });
  const prefs = getUiPrefs();
  assert.equal(prefs.aiChatWidth, 420);
  assert.equal(prefs.aiChatBottomHeight, 300);
  assert.equal(prefs.aiChatFloatingHeight, 560);
});

test('a corrupted (non-number) saved resize value falls back to null instead of propagating garbage', () => {
  saveUiPrefs({ aiChatWidth: 'not-a-number' });
  assert.equal(getUiPrefs().aiChatWidth, null);
});
