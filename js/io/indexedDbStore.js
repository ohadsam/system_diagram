// Thin low-level wrapper around a single IndexedDB object store — used only
// by io/storage.js as its optional alternate backend (see that file's
// header comment for why the read/write API stays synchronous either way).
// Kept separate so storage.js's cache/backend-switching logic and this raw
// IndexedDB plumbing don't tangle together.
const DB_NAME = 'sdb-store';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

export function indexedDbAvailable() {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!indexedDbAvailable()) { reject(new Error('IndexedDB is not available in this browser.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB.'));
  });
}

/** Every [key, value] pair currently in the store — used once at startup to
 * populate storage.js's in-memory cache, and by the localStorage<->IndexedDB
 * migration copy. */
export async function idbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => resolve(keysReq.result.map((k, i) => [k, valsReq.result[i]]));
    tx.onerror = () => reject(tx.error || new Error('Failed to read from IndexedDB.'));
  });
}

export async function idbPut(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to write to IndexedDB.'));
  });
}

export async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete from IndexedDB.'));
  });
}
