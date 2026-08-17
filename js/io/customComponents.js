// "My Components" — a personal library of user-created saved components,
// separate from the built-in js/data library, persisted in localStorage and
// exportable/importable as its own JSON file so it's portable.
import { readJSON, writeJSON } from './storage.js';
import { nextId } from '../core/id.js';
import { downloadJSON } from '../utils/download.js';
import { disambiguateName } from '../utils/disambiguateName.js';
import { removeFavorite } from './favorites.js';

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

/** Sorted, distinct, non-empty folder names currently used by any custom component. */
export function getCustomComponentFolders() {
  const folders = new Set(getCustomComponents().map((c) => c.folder).filter(Boolean));
  return [...folders].sort((a, b) => a.localeCompare(b));
}

export function saveCustomComponent(def) {
  const list = getCustomComponents();
  const id = def.id || nextId('custom');
  const idx = list.findIndex((c) => c.id === id);
  const record = { ...def, id, folder: typeof def.folder === 'string' ? def.folder.trim() : '' };
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  writeJSON(KEY, list);
  emit();
  return record;
}

export function deleteCustomComponent(id) {
  const list = getCustomComponents().filter((c) => c.id !== id);
  writeJSON(KEY, list);
  removeFavorite(id); // drop any dangling Favorites entry pointing at the now-deleted component
  emit();
}

export function exportCustomComponents() {
  downloadJSON({ formatVersion: 1, kind: 'sdb-custom-components', components: getCustomComponents() }, 'my-components.json');
}

/** Validates a saved multi-node custom component's `pattern` field (see
 * canvas.js#buildGroupSnapshotFromSelection / instantiatePattern) down to
 * only well-shaped node/edge specs, dropping anything malformed rather than
 * importing junk that would fail (or silently misrender) at instantiation
 * time. Returns null if the whole field isn't usable. */
function validatePatternField(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes)) return null;
  const nodes = raw.nodes
    .filter((n) => n && typeof n.key === 'string' && Number.isFinite(n.dx) && Number.isFinite(n.dy))
    .map((n) => ({
      key: n.key,
      defId: typeof n.defId === 'string' ? n.defId : null,
      dx: n.dx,
      dy: n.dy,
      ...(typeof n.label === 'string' ? { label: n.label } : {}),
      ...(n.overrides && typeof n.overrides === 'object' ? { overrides: n.overrides } : {}),
    }));
  if (!nodes.length) return null;
  const nodeKeys = new Set(nodes.map((n) => n.key));
  const edges = Array.isArray(raw.edges)
    ? raw.edges
        .filter((e) => e && typeof e === 'object' && nodeKeys.has(e.from) && nodeKeys.has(e.to))
        .map((e) => ({
          from: e.from,
          to: e.to,
          ...(typeof e.label === 'string' ? { label: e.label } : {}),
          ...(e.overrides && typeof e.overrides === 'object' ? { overrides: e.overrides } : {}),
        }))
    : [];
  return { nodes, edges };
}

/** Validate + merge an imported custom-components JSON file's parsed content. Never throws. */
export function importCustomComponents(parsed) {
  if (!parsed || !Array.isArray(parsed.components)) return { ok: false, error: 'Invalid custom components file' };
  const existing = getCustomComponents();
  const byId = new Map(existing.map((c) => [c.id, c]));
  const namesInUse = new Set(existing.map((c) => c.name));
  let imported = 0;
  for (const raw of parsed.components) {
    if (!raw || typeof raw.name !== 'string' || typeof raw.icon !== 'string') continue;
    // A saved multi-node custom component (kind:'pattern', see
    // canvas.js#buildGroupSnapshotFromSelection) needs its `pattern` field
    // to survive import intact — dropping it here would silently revert the
    // record to junk single-node data. A malformed pattern field is
    // skipped entirely rather than imported half-broken.
    const kind = raw.kind === 'pattern' ? 'pattern' : 'component';
    const pattern = kind === 'pattern' ? validatePatternField(raw.pattern) : null;
    if (kind === 'pattern' && !pattern) continue;
    const id = typeof raw.id === 'string' && raw.id ? raw.id : nextId('custom');
    const name = byId.has(id) ? raw.name : disambiguateName(raw.name, namesInUse);
    namesInUse.add(name);
    byId.set(id, {
      id,
      name,
      icon: raw.icon,
      kind,
      shape: typeof raw.shape === 'string' ? raw.shape : 'rounded',
      color: typeof raw.color === 'string' ? raw.color : '#4F46E5',
      fill: typeof raw.fill === 'string' ? raw.fill : '#FFFFFF',
      description: typeof raw.description === 'string' ? raw.description : '',
      folder: typeof raw.folder === 'string' ? raw.folder.trim() : '',
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : [],
      subComponents: Array.isArray(raw.subComponents) ? raw.subComponents.filter((s) => s && typeof s.name === 'string') : [],
      defaultSize: raw.defaultSize && Number.isFinite(raw.defaultSize.w) && Number.isFinite(raw.defaultSize.h) ? raw.defaultSize : { w: 160, h: 84 },
      ...(pattern ? { pattern, groupOnInstantiate: raw.groupOnInstantiate === true } : {}),
    });
    imported += 1;
  }
  writeJSON(KEY, [...byId.values()]);
  emit();
  return { ok: true, imported };
}
