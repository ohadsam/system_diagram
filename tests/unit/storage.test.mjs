// io/storage.js is a browser localStorage wrapper. Under plain Node (no
// DOM), `window` is undefined, which is exactly the "storage unavailable"
// scenario (private browsing, disabled storage) it's designed to survive —
// so these tests double as a resilience check without needing jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, writeJSON, storageAvailable, remove, listKeysWithPrefix } from '../../js/io/storage.js';

test('storageAvailable returns false (not throws) when there is no window', () => {
  assert.equal(storageAvailable(), false);
});

test('readJSON returns the fallback instead of throwing when storage is unavailable', () => {
  assert.equal(readJSON('anything', 'fallback-value'), 'fallback-value');
  assert.deepEqual(readJSON('anything', []), []);
  assert.equal(readJSON('anything'), null);
});

test('writeJSON returns false instead of throwing when storage is unavailable', () => {
  assert.equal(writeJSON('key', { a: 1 }), false);
});

test('remove and listKeysWithPrefix do not throw when storage is unavailable', () => {
  assert.doesNotThrow(() => remove('key'));
  assert.deepEqual(listKeysWithPrefix('anything'), []);
});
