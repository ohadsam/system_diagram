// Thin, defensive localStorage wrapper. Every read/write is try/caught so a
// full or unavailable localStorage (private browsing, quota) degrades
// gracefully instead of crashing the app.
const PREFIX = 'sdb:v1:';

export function storageAvailable() {
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
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] write failed', key, err);
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function listKeysWithPrefix(subPrefix) {
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
