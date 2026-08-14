// Named saved projects (multiple, listed for "Save As" / "Load"),
// separate from the always-on autosave slot in autosave.js.
import { readJSON, writeJSON } from './storage.js';
import { validateProject } from '../core/project.js';

const KEY = 'savedProjects';

export function listSavedProjects() {
  const list = readJSON(KEY, []);
  return list
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, nodeCount: p.nodes?.length || 0 }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function saveNamedProject(project) {
  const list = readJSON(KEY, []);
  const idx = list.findIndex((p) => p.id === project.id);
  const record = { ...project, updatedAt: new Date().toISOString() };
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
