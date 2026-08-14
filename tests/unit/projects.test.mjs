import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { createEmptyProject } from '../../js/core/project.js';
import {
  listSavedProjects, saveNamedProject, toggleFavorite, importSavedProjectsBundle, getRawSavedProjects,
} from '../../js/io/projects.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('saveNamedProject preserves an existing record\'s favorite flag across re-save', () => {
  const project = createEmptyProject('Alpha');
  saveNamedProject(project);
  toggleFavorite(project.id);
  assert.equal(getRawSavedProjects().find((p) => p.id === project.id).favorite, true);

  // Re-saving (as "Save As" would on an already-saved project) must not drop the star.
  saveNamedProject({ ...project, name: 'Alpha v2' });
  const record = getRawSavedProjects().find((p) => p.id === project.id);
  assert.equal(record.favorite, true);
  assert.equal(record.name, 'Alpha v2');
});

test('toggleFavorite flips the flag and returns the new value', () => {
  const project = createEmptyProject('Beta');
  saveNamedProject(project);
  assert.equal(toggleFavorite(project.id), true);
  assert.equal(toggleFavorite(project.id), false);
});

test('listSavedProjects sorts favorites first, then by most-recently-updated', () => {
  const a = createEmptyProject('A');
  const b = createEmptyProject('B');
  saveNamedProject(a);
  saveNamedProject(b);
  toggleFavorite(b.id);
  const list = listSavedProjects();
  assert.equal(list[0].id, b.id, 'favorited project should sort first even though it was saved second');
});

test('importSavedProjectsBundle rejects a malformed bundle without throwing', () => {
  assert.equal(importSavedProjectsBundle(null).ok, false);
  assert.equal(importSavedProjectsBundle({}).ok, false);
  assert.doesNotThrow(() => importSavedProjectsBundle({ projects: 'not-an-array' }));
});

test('importSavedProjectsBundle: same id overwrites the existing record', () => {
  const project = createEmptyProject('Original');
  saveNamedProject(project);
  const result = importSavedProjectsBundle({
    projects: [{ id: project.id, name: 'Renamed', nodes: [], edges: [], favorite: true }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.imported, 1);
  const all = getRawSavedProjects();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, 'Renamed');
  assert.equal(all[0].favorite, true);
});

test('importSavedProjectsBundle: name collision with a different id is imported as a separate, renamed record', () => {
  const project = createEmptyProject('Shared Name');
  saveNamedProject(project);
  const result = importSavedProjectsBundle({
    projects: [{ id: 'proj_other', name: 'Shared Name', nodes: [], edges: [] }],
  });
  assert.equal(result.ok, true);
  const all = getRawSavedProjects();
  assert.equal(all.length, 2, 'both the original and the imported project should exist');
  const imported = all.find((p) => p.id === 'proj_other');
  assert.equal(imported.name, 'Shared Name (imported)');
});

test('importSavedProjectsBundle: repeated name collisions get incrementing suffixes', () => {
  saveNamedProject(createEmptyProject('Dup'));
  importSavedProjectsBundle({ projects: [{ id: 'proj_1', name: 'Dup', nodes: [], edges: [] }] });
  importSavedProjectsBundle({ projects: [{ id: 'proj_2', name: 'Dup', nodes: [], edges: [] }] });
  const names = new Set(getRawSavedProjects().map((p) => p.name));
  assert.deepEqual(names, new Set(['Dup', 'Dup (imported)', 'Dup (imported 2)']));
});

test('importSavedProjectsBundle: a brand new project (no id/name clash) is simply added', () => {
  saveNamedProject(createEmptyProject('Existing'));
  const result = importSavedProjectsBundle({ projects: [{ id: 'proj_new', name: 'New One', nodes: [], edges: [] }] });
  assert.equal(result.imported, 1);
  assert.equal(getRawSavedProjects().length, 2);
});
