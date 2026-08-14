// Minimal in-memory `window.localStorage` stand-in so io/storage.js (and
// anything built on it) actually persists across calls within a test, the
// same way it would in a browser — plain Node has no `window` at all, which
// storage.js treats as "storage unavailable" (see storage.test.mjs), not
// useful for testing the merge/collision logic that lives on top of it.
export function installMemoryLocalStorage() {
  const backing = new Map();
  const localStorage = {
    getItem: (key) => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => { backing.set(key, String(value)); },
    removeItem: (key) => { backing.delete(key); },
    get length() { return backing.size; },
    key: (i) => [...backing.keys()][i] ?? null,
  };
  globalThis.window = { localStorage };
  return () => backing.clear();
}
