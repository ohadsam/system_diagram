// io/storage.js is a browser localStorage wrapper. Under plain Node (no
// DOM), `window` is undefined, which is exactly the "storage unavailable"
// scenario (private browsing, disabled storage) it's designed to survive —
// so these tests double as a resilience check without needing jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readJSON, writeJSON, storageAvailable, remove, listKeysWithPrefix,
  getStorageBackend, initStorageBackend, switchStorageBackend, STORAGE_BACKENDS,
} from '../../js/io/storage.js';

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

// The 'indexeddb' backend itself needs a real browser (see
// io/indexedDbStore.js) so it gets e2e coverage, not a node unit test —
// these cover the parts that stay pure/DOM-free either way: the default
// backend under Node (no window, same "storage unavailable" scenario as
// above), and switchStorageBackend's own input validation and its graceful
// failure when IndexedDB genuinely isn't available.

test('getStorageBackend defaults to localStorage when there is no window', () => {
  assert.equal(getStorageBackend(), 'localStorage');
});

test('STORAGE_BACKENDS lists exactly the two supported backends', () => {
  assert.deepEqual(STORAGE_BACKENDS, ['localStorage', 'indexeddb']);
});

test('initStorageBackend resolves without throwing when the localStorage backend is active (no-op)', async () => {
  await assert.doesNotReject(() => initStorageBackend());
});

test('switchStorageBackend rejects an unknown backend name', async () => {
  const result = await switchStorageBackend('sqlite');
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown/i);
});

test('switchStorageBackend is a no-op switching to the backend already active', async () => {
  const result = await switchStorageBackend('localStorage');
  assert.deepEqual(result, { ok: true, movedCount: 0 });
});

test('switchStorageBackend to indexeddb fails gracefully (not throws) when IndexedDB is unavailable', async () => {
  const result = await switchStorageBackend('indexeddb');
  assert.equal(result.ok, false);
  assert.match(result.error, /IndexedDB/);
  // Failing to switch must not have left the backend changed.
  assert.equal(getStorageBackend(), 'localStorage');
});
