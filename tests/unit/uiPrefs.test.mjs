import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getUiPrefs, saveUiPrefs, DEFAULT_UI_PREFS, SCENE3D_BAR_POSITIONS } from '../../js/io/uiPrefs.js';

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

test('scene3dBarPosition/scene3dBarCompact default to bottom/expanded and round-trip a saved choice', () => {
  assert.equal(getUiPrefs().scene3dBarPosition, 'bottom');
  assert.equal(getUiPrefs().scene3dBarCompact, false);

  saveUiPrefs({ scene3dBarPosition: 'left', scene3dBarCompact: true });
  const prefs = getUiPrefs();
  assert.equal(prefs.scene3dBarPosition, 'left');
  assert.equal(prefs.scene3dBarCompact, true);
});

test('an invalid saved scene3dBarPosition/scene3dBarCompact falls back to the default instead of propagating garbage', () => {
  saveUiPrefs({ scene3dBarPosition: 'diagonal', scene3dBarCompact: 'yes' });
  const prefs = getUiPrefs();
  assert.equal(prefs.scene3dBarPosition, 'bottom');
  assert.equal(prefs.scene3dBarCompact, false);
});

test('inlineLintBadges/sketchMode default to off and round-trip a saved true', () => {
  assert.equal(getUiPrefs().inlineLintBadges, false);
  assert.equal(getUiPrefs().sketchMode, false);

  saveUiPrefs({ inlineLintBadges: true, sketchMode: true });
  const prefs = getUiPrefs();
  assert.equal(prefs.inlineLintBadges, true);
  assert.equal(prefs.sketchMode, true);
});

test('SCENE3D_BAR_POSITIONS covers every position getUiPrefs will accept', () => {
  assert.deepEqual(SCENE3D_BAR_POSITIONS, ['bottom', 'top', 'left', 'right']);
  for (const pos of SCENE3D_BAR_POSITIONS) {
    saveUiPrefs({ scene3dBarPosition: pos });
    assert.equal(getUiPrefs().scene3dBarPosition, pos);
  }
});
