// Named saved projects (multiple, listed for "Save As" / "Load"),
// separate from the always-on autosave slot in autosave.js.
import { readJSON, writeJSON } from './storage.js';
import { validateProject } from '../core/project.js';
import { downloadJSON } from '../utils/download.js';
import { nextId } from '../core/id.js';
import { disambiguateName } from '../utils/disambiguateName.js';

const KEY = 'savedProjects';

export function listSavedProjects() {
  const list = readJSON(KEY, []);
  return list
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, favorite: !!p.favorite, nodeCount: p.nodes?.length || 0, links: Array.isArray(p.links) ? p.links : [] }))
    .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function saveNamedProject(project) {
  const list = readJSON(KEY, []);
  const idx = list.findIndex((p) => p.id === project.id);
  const record = { ...project, favorite: idx >= 0 ? !!list[idx].favorite : false, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  writeJSON(KEY, list);
  return record;
}

export function loadNamedProject(id) {
  const list = readJSON(KEY, []);
  const found = list.find((p) => p.id === id);
  if (!found) return { ok: false, error: 'Project not found' };
  return validateProject(found);
}

export function deleteNamedProject(id) {
  const list = readJSON(KEY, []).filter((p) => p.id !== id);
  writeJSON(KEY, list);
}

export function toggleFavorite(id) {
  const list = readJSON(KEY, []);
  const found = list.find((p) => p.id === id);
  if (!found) return false;
  found.favorite = !found.favorite;
  writeJSON(KEY, list);
  return found.favorite;
}

/** Raw saved-project records (including `favorite`), for bundling into a full backup. */
export function getRawSavedProjects() {
  return readJSON(KEY, []);
}

export function exportAllSavedProjects() {
  downloadJSON({ formatVersion: 1, kind: 'sdb-project-library', projects: readJSON(KEY, []) }, 'my-projects.json');
}

/**
 * Merge an imported saved-projects bundle into the local library. Never throws.
 * Collision rules: same id -> overwrite that record; same name but a
 * different id -> the incoming project is renamed ("Name (imported)", then
 * "(imported 2)", ...) before being added; otherwise added as a new entry.
 */
export function importSavedProjectsBundle(parsed) {
  if (!parsed || !Array.isArray(parsed.projects)) return { ok: false, error: 'Invalid projects file' };
  const existing = readJSON(KEY, []);
  const byId = new Map(existing.map((p) => [p.id, p]));
  const namesInUse = new Set(existing.map((p) => p.name));
  let imported = 0;
  for (const raw of parsed.projects) {
    const result = validateProject(raw);
    if (!result.ok) continue;
    const project = result.project;
    const id = typeof raw.id === 'string' && raw.id ? raw.id : nextId('proj');
    const name = byId.has(id) ? project.name : disambiguateName(project.name, namesInUse);
    namesInUse.add(name);
    byId.set(id, { ...project, id, name, favorite: !!raw.favorite, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString() });
    imported += 1;
  }
  writeJSON(KEY, [...byId.values()]);
  return { ok: true, imported };
}
