// Defensive key/value storage wrapper. Every read/write is try/caught so an
// unavailable/full localStorage (private browsing, quota) degrades
// gracefully instead of crashing the app.
//
// Two backends: 'localStorage' (default, zero setup, ~5-10MB quota) and
// 'indexeddb' (opt-in, io/indexedDbStore.js, much larger quota — useful for
// someone with many/large saved projects or backups). Every call site in
// the app (project.js, uiPrefs.js, customComponents.js, ...) was written
// against a *synchronous* readJSON/writeJSON contract, so switching the
// whole app to IndexedDB's naturally-async API would mean touching every
// caller. Instead this module keeps the same sync contract for both
// backends: when the 'indexeddb' backend is active, every entry is loaded
// into an in-memory `idbCache` once at startup (see `initStorageBackend`,
// awaited by main.js#boot before anything else touches storage), and every
// read/write after that hits the cache synchronously — writes also kick off
// a fire-and-forget async `idbPut` to actually persist the change. A
// same-tick read-after-write still sees the fresh value (from the cache)
// exactly like localStorage would, so no caller needed to change.
import { idbGetAll, idbPut, idbDelete, indexedDbAvailable } from './indexedDbStore.js';

const PREFIX = 'sdb:v1:';
// Which backend is active is itself always read/written directly against
// real localStorage (never through the pluggable path below) — otherwise
// picking the backend would depend on the backend, a chicken-and-egg problem.
const BACKEND_KEY = PREFIX + 'storageBackend';

export const STORAGE_BACKENDS = ['localStorage', 'indexeddb'];

let backend = 'localStorage';
try {
  const stored = window.localStorage.getItem(BACKEND_KEY);
  if (STORAGE_BACKENDS.includes(stored)) backend = stored;
} catch {
  /* no window / storage disabled — stay on the 'localStorage' default,
     every method below already tolerates that being unavailable too */
}

const idbCache = new Map(); // key (without PREFIX) -> value; only populated/read when backend === 'indexeddb'
let idbReady = false;

export function getStorageBackend() {
  return backend;
}

/** Loads every existing IndexedDB entry into the in-memory cache — a no-op
 * (resolves immediately) unless the 'indexeddb' backend is actually active,
 * so a 'localStorage' visitor (the default) pays zero startup cost. Must be
 * awaited before any other module reads storage — see main.js#boot. */
export async function initStorageBackend() {
  if (backend !== 'indexeddb' || idbReady) return;
  try {
    const entries = await idbGetAll();
    idbCache.clear();
    for (const [key, value] of entries) idbCache.set(key, value);
    idbReady = true;
  } catch (err) {
    console.warn('[storage] IndexedDB init failed, falling back to localStorage', err);
    backend = 'localStorage';
  }
}

export function storageAvailable() {
  if (backend === 'indexeddb') return indexedDbAvailable();
  try {
    const testKey = `${PREFIX}__probe__`;
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback = null) {
  if (backend === 'indexeddb') {
    return idbCache.has(key) ? idbCache.get(key) : fallback;
  }
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (backend === 'indexeddb') {
    idbCache.set(key, value);
    idbPut(key, value).catch((err) => console.warn('[storage] IndexedDB write failed', key, err));
    return true;
  }
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] write failed', key, err);
    return false;
  }
}

export function remove(key) {
  if (backend === 'indexeddb') {
    idbCache.delete(key);
    idbDelete(key).catch(() => { /* best-effort */ });
    return;
  }
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function listKeysWithPrefix(subPrefix) {
  if (backend === 'indexeddb') {
    return [...idbCache.keys()].filter((k) => k.startsWith(subPrefix));
  }
  const out = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PREFIX + subPrefix)) out.push(key.slice(PREFIX.length));
    }
  } catch {
    /* ignore */
  }
  return out;
}

function persistBackendChoice() {
  try {
    window.localStorage.setItem(BACKEND_KEY, backend);
  } catch {
    /* ignore — the choice just won't survive a reload, same as any other
       localStorage write failing */
  }
}

/** Every `sdb:v1:` entry currently in *real* localStorage, decoded — used by
 * the migration copy below regardless of which backend is currently active. */
function readAllLocalStorageEntries() {
  const out = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const fullKey = window.localStorage.key(i);
      if (fullKey && fullKey.startsWith(PREFIX) && fullKey !== BACKEND_KEY) {
        try {
          out.push([fullKey.slice(PREFIX.length), JSON.parse(window.localStorage.getItem(fullKey))]);
        } catch {
          /* skip one unparsable entry rather than fail the whole copy */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Switches the active backend, first COPYING every entry from the current
 * backend into the new one (never deletes from the old one — a user can
 * always switch back). Never throws; returns {ok, movedCount} or
 * {ok: false, error}. See modals/backupModal.js for the UI that calls this.
 */
export async function switchStorageBackend(next) {
  if (!STORAGE_BACKENDS.includes(next)) return { ok: false, error: 'Unknown storage backend.' };
  if (next === backend) return { ok: true, movedCount: 0 };

  if (next === 'indexeddb') {
    if (!indexedDbAvailable()) return { ok: false, error: 'IndexedDB is not available in this browser.' };
    const entries = readAllLocalStorageEntries();
    try {
      for (const [key, value] of entries) {
        idbCache.set(key, value);
        await idbPut(key, value);
      }
    } catch (err) {
      return { ok: false, error: `Failed to copy data into IndexedDB: ${err.message}` };
    }
    idbReady = true;
    backend = 'indexeddb';
    persistBackendChoice();
    return { ok: true, movedCount: entries.length };
  }

  // next === 'localStorage'
  let entries;
  try {
    entries = await idbGetAll();
  } catch (err) {
    return { ok: false, error: `Failed to read from IndexedDB: ${err.message}` };
  }
  try {
    for (const [key, value] of entries) {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    }
  } catch (err) {
    return { ok: false, error: `Failed to copy data into localStorage (it may be full): ${err.message}` };
  }
  backend = 'localStorage';
  persistBackendChoice();
  return { ok: true, movedCount: entries.length };
}
