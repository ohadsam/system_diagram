import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import {
  saveCustomComponent, getCustomComponents, getCustomComponentFolders, importCustomComponents,
} from '../../js/io/customComponents.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('saveCustomComponent trims and stores the folder field, defaulting to empty', () => {
  saveCustomComponent({ name: 'No folder', icon: '⬛' });
  saveCustomComponent({ name: 'With folder', icon: '🔷', folder: '  AWS  ' });
  const list = getCustomComponents();
  assert.equal(list.find((c) => c.name === 'No folder').folder, '');
  assert.equal(list.find((c) => c.name === 'With folder').folder, 'AWS');
});

test('getCustomComponentFolders returns distinct, sorted, non-empty folder names', () => {
  saveCustomComponent({ name: 'A', icon: '🔷', folder: 'Backend' });
  saveCustomComponent({ name: 'B', icon: '🔷', folder: 'AWS' });
  saveCustomComponent({ name: 'C', icon: '🔷', folder: 'AWS' });
  saveCustomComponent({ name: 'D', icon: '🔷' });
  assert.deepEqual(getCustomComponentFolders(), ['AWS', 'Backend']);
});

test('importCustomComponents rejects a malformed file without throwing', () => {
  assert.equal(importCustomComponents(null).ok, false);
  assert.doesNotThrow(() => importCustomComponents({ components: 'nope' }));
});

test('importCustomComponents: same id overwrites the existing component (folder included)', () => {
  const saved = saveCustomComponent({ name: 'Original', icon: '⬛', folder: 'Old' });
  const result = importCustomComponents({
    components: [{ id: saved.id, name: 'Renamed', icon: '🔶', folder: 'New' }],
  });
  assert.equal(result.ok, true);
  const list = getCustomComponents();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Renamed');
  assert.equal(list[0].folder, 'New');
});

test('importCustomComponents: name collision with a different id is imported as a separate, renamed component', () => {
  saveCustomComponent({ name: 'Shared', icon: '⬛' });
  const result = importCustomComponents({ components: [{ id: 'custom_other', name: 'Shared', icon: '🔶' }] });
  assert.equal(result.ok, true);
  const list = getCustomComponents();
  assert.equal(list.length, 2);
  assert.ok(list.some((c) => c.name === 'Shared (imported)'));
});

test('importCustomComponents: a brand new component (no clash) is simply added', () => {
  saveCustomComponent({ name: 'Existing', icon: '⬛' });
  const result = importCustomComponents({ components: [{ id: 'custom_new', name: 'New', icon: '🔶' }] });
  assert.equal(result.imported, 1);
  assert.equal(getCustomComponents().length, 2);
});
