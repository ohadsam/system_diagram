import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import * as store from '../../js/core/store.js';
import { createEmptyProject } from '../../js/core/project.js';
import { importFullBackupFile } from '../../js/io/fullBackup.js';
import { getNodeDefaults } from '../../js/io/nodeDefaults.js';
import { getCustomComponents } from '../../js/io/customComponents.js';
import { getRawSavedProjects } from '../../js/io/projects.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('importFullBackupFile rejects anything that isn\'t a recognized full-backup file, without throwing', () => {
  assert.equal(importFullBackupFile(null).ok, false);
  assert.equal(importFullBackupFile({}).ok, false);
  assert.equal(importFullBackupFile({ kind: 'sdb-custom-components' }).ok, false);
});

test('importFullBackupFile loads the bundled canvas, overwrites defaults, and merges libraries', () => {
  const backedUpProject = createEmptyProject('Restored Diagram');
  const result = importFullBackupFile({
    formatVersion: 1,
    kind: 'sdb-full-backup',
    currentProject: backedUpProject,
    nodeDefaults: { transparentFill: true, showIcon: false, textPosition: 'above', subComponentsDisplay: 'full' },
    customComponents: [{ id: 'custom_1', name: 'Backed-up Component', icon: '⬛' }],
    savedProjects: [{ id: 'proj_1', name: 'Backed-up Project', nodes: [], edges: [] }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.loadedProject, true);
  assert.equal(result.importedComponents, 1);
  assert.equal(result.importedProjects, 1);

  assert.equal(store.getState().name, 'Restored Diagram');
  assert.deepEqual(getNodeDefaults(), { transparentFill: true, showIcon: false, textPosition: 'above', subComponentsDisplay: 'full' });
  assert.equal(getCustomComponents().length, 1);
  assert.equal(getRawSavedProjects().length, 1);
});

test('importFullBackupFile tolerates a backup missing the optional sections', () => {
  const result = importFullBackupFile({ kind: 'sdb-full-backup' });
  assert.equal(result.ok, true);
  assert.equal(result.loadedProject, false);
  assert.equal(result.importedComponents, 0);
  assert.equal(result.importedProjects, 0);
});
