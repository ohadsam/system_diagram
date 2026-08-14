// "My Components" — a personal library of user-created saved components,
// separate from the built-in js/data library, persisted in localStorage and
// exportable/importable as its own JSON file so it's portable.
import { readJSON, writeJSON } from './storage.js';
import { nextId } from '../core/id.js';
import { downloadJSON } from '../utils/download.js';

const KEY = 'customComponents';
const listeners = new Set();

function emit() {
  const list = getCustomComponents();
  for (const fn of listeners) fn(list);
}

export function onCustomComponentsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCustomComponents() {
  return readJSON(KEY, []);
}

export function saveCustomComponent(def) {
  const list = getCustomComponents();
  const id = def.id || nextId('custom');
  const idx = list.findIndex((c) => c.id === id);
  const record = { ...def, id };
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  writeJSON(KEY, list);
  emit();
  return record;
}

export function deleteCustomComponent(id) {
  const list = getCustomComponents().filter((c) => c.id !== id);
  writeJSON(KEY, list);
  emit();
}

export function exportCustomComponents() {
  downloadJSON({ formatVersion: 1, kind: 'sdb-custom-components', components: getCustomComponents() }, 'my-components.json');
}

/** Validate + merge an imported custom-components JSON file's parsed content. Never throws. */
export function importCustomComponents(parsed) {
  if (!parsed || !Array.isArray(parsed.components)) return { ok: false, error: 'Invalid custom components file' };
  const existing = getCustomComponents();
  const byId = new Map(existing.map((c) => [c.id, c]));
  let imported = 0;
  for (const raw of parsed.components) {
    if (!raw || typeof raw.name !== 'string' || typeof raw.icon !== 'string') continue;
    const id = typeof raw.id === 'string' ? raw.id : nextId('custom');
    byId.set(id, {
      id,
      name: raw.name,
      icon: raw.icon,
      shape: typeof raw.shape === 'string' ? raw.shape : 'rounded',
      color: typeof raw.color === 'string' ? raw.color : '#4F46E5',
      fill: typeof raw.fill === 'string' ? raw.fill : '#FFFFFF',
      description: typeof raw.description === 'string' ? raw.description : '',
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : [],
      subComponents: Array.isArray(raw.subComponents) ? raw.subComponents.filter((s) => s && typeof s.name === 'string') : [],
      defaultSize: raw.defaultSize && Number.isFinite(raw.defaultSize.w) && Number.isFinite(raw.defaultSize.h) ? raw.defaultSize : { w: 160, h: 84 },
    });
    imported += 1;
  }
  writeJSON(KEY, [...byId.values()]);
  emit();
  return { ok: true, imported };
}
