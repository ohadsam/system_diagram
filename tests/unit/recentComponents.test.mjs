import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getRecentComponentIds, recordComponentUsed, onRecentComponentsChange } from '../../js/io/recentComponents.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getRecentComponentIds is empty when nothing was ever placed', () => {
  assert.deepEqual(getRecentComponentIds(), []);
});

test('recordComponentUsed adds the defId to the front of the list', () => {
  recordComponentUsed('shape-server');
  recordComponentUsed('shape-database');
  assert.deepEqual(getRecentComponentIds(), ['shape-database', 'shape-server']);
});

test('recordComponentUsed moves an already-recorded defId back to the front instead of duplicating it', () => {
  recordComponentUsed('shape-server');
  recordComponentUsed('shape-database');
  recordComponentUsed('shape-server');
  assert.deepEqual(getRecentComponentIds(), ['shape-server', 'shape-database']);
});

test('recordComponentUsed caps the list at 8 entries, dropping the oldest', () => {
  for (let i = 0; i < 10; i++) recordComponentUsed(`shape-${i}`);
  const ids = getRecentComponentIds();
  assert.equal(ids.length, 8);
  assert.deepEqual(ids, ['shape-9', 'shape-8', 'shape-7', 'shape-6', 'shape-5', 'shape-4', 'shape-3', 'shape-2']);
});

test('recordComponentUsed ignores a falsy defId', () => {
  recordComponentUsed('');
  recordComponentUsed(null);
  assert.deepEqual(getRecentComponentIds(), []);
});

test('onRecentComponentsChange notifies listeners on every recorded placement', () => {
  let calls = 0;
  const unsubscribe = onRecentComponentsChange(() => { calls++; });
  recordComponentUsed('shape-server');
  recordComponentUsed('shape-database');
  assert.equal(calls, 2);
  unsubscribe();
  recordComponentUsed('shape-cache');
  assert.equal(calls, 2);
});
