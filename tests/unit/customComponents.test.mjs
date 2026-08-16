import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import {
  saveCustomComponent, getCustomComponents, getCustomComponentFolders, importCustomComponents,
} from '../../js/io/customComponents.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('saveCustomComponent trims and stores the folder field, defaulting to empty', () => {
  saveCustomComponent({ name: 'No folder', icon: '⬛' });
  saveCustomComponent({ name: 'With folder', icon: '🔷', folder: '  AWS  ' });
  const list = getCustomComponents();
  assert.equal(list.find((c) => c.name === 'No folder').folder, '');
  assert.equal(list.find((c) => c.name === 'With folder').folder, 'AWS');
});

test('getCustomComponentFolders returns distinct, sorted, non-empty folder names', () => {
  saveCustomComponent({ name: 'A', icon: '🔷', folder: 'Backend' });
  saveCustomComponent({ name: 'B', icon: '🔷', folder: 'AWS' });
  saveCustomComponent({ name: 'C', icon: '🔷', folder: 'AWS' });
  saveCustomComponent({ name: 'D', icon: '🔷' });
  assert.deepEqual(getCustomComponentFolders(), ['AWS', 'Backend']);
});

test('importCustomComponents rejects a malformed file without throwing', () => {
  assert.equal(importCustomComponents(null).ok, false);
  assert.doesNotThrow(() => importCustomComponents({ components: 'nope' }));
});

test('importCustomComponents: same id overwrites the existing component (folder included)', () => {
  const saved = saveCustomComponent({ name: 'Original', icon: '⬛', folder: 'Old' });
  const result = importCustomComponents({
    components: [{ id: saved.id, name: 'Renamed', icon: '🔶', folder: 'New' }],
  });
  assert.equal(result.ok, true);
  const list = getCustomComponents();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Renamed');
  assert.equal(list[0].folder, 'New');
});

test('importCustomComponents: name collision with a different id is imported as a separate, renamed component', () => {
  saveCustomComponent({ name: 'Shared', icon: '⬛' });
  const result = importCustomComponents({ components: [{ id: 'custom_other', name: 'Shared', icon: '🔶' }] });
  assert.equal(result.ok, true);
  const list = getCustomComponents();
  assert.equal(list.length, 2);
  assert.ok(list.some((c) => c.name === 'Shared (imported)'));
});

test('importCustomComponents: a brand new component (no clash) is simply added', () => {
  saveCustomComponent({ name: 'Existing', icon: '⬛' });
  const result = importCustomComponents({ components: [{ id: 'custom_new', name: 'New', icon: '🔶' }] });
  assert.equal(result.imported, 1);
  assert.equal(getCustomComponents().length, 2);
});

// A saved multi-node custom component (kind:'pattern', built by
// canvas.js#buildGroupSnapshotFromSelection) must survive an export/import
// round-trip intact — this is exactly the io/fullBackup.js restore path too.
// It used to silently revert to junk single-node data because
// importCustomComponents rebuilt every record from an explicit field
// whitelist that didn't include kind/pattern/groupOnInstantiate.
test('importCustomComponents preserves a multi-node pattern component\'s kind/pattern/groupOnInstantiate', () => {
  const saved = saveCustomComponent({
    name: 'Cache + DB group',
    icon: '🧩',
    kind: 'pattern',
    groupOnInstantiate: true,
    pattern: {
      nodes: [
        { key: 'n0', defId: null, dx: -80, dy: 0, overrides: { text: 'Redis', fill: '#EEF2FF', w: 160, h: 84 } },
        { key: 'n1', defId: 'aws-rds', dx: 80, dy: 0, overrides: { text: 'DB' } },
      ],
      edges: [{ from: 'n0', to: 'n1', overrides: { color: '#334155', routing: 'orthogonal' } }],
    },
  });

  const exported = { formatVersion: 1, kind: 'sdb-custom-components', components: getCustomComponents() };
  // Simulate a fresh library (e.g. restoring on another machine) before re-importing.
  resetStorage();
  const result = importCustomComponents(exported);
  assert.equal(result.ok, true);
  assert.equal(result.imported, 1);

  const list = getCustomComponents();
  assert.equal(list.length, 1);
  const restored = list[0];
  assert.equal(restored.id, saved.id);
  assert.equal(restored.kind, 'pattern');
  assert.equal(restored.groupOnInstantiate, true);
  assert.equal(restored.pattern.nodes.length, 2);
  assert.equal(restored.pattern.nodes[0].overrides.text, 'Redis');
  assert.equal(restored.pattern.edges.length, 1);
  assert.equal(restored.pattern.edges[0].from, 'n0');
});

test('importCustomComponents drops a pattern component whose pattern field is malformed, instead of importing junk', () => {
  const result = importCustomComponents({
    components: [{ id: 'custom_bad', name: 'Broken group', icon: '🧩', kind: 'pattern', pattern: { nodes: 'not an array' } }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.imported, 0);
  assert.equal(getCustomComponents().length, 0);
});

test('importCustomComponents: a plain (non-pattern) component still imports as kind "component"', () => {
  const result = importCustomComponents({ components: [{ id: 'custom_plain', name: 'Plain', icon: '⬛' }] });
  assert.equal(result.ok, true);
  assert.equal(getCustomComponents()[0].kind, 'component');
  assert.equal('pattern' in getCustomComponents()[0], false);
});
