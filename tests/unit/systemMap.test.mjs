import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSystemMapLayout } from '../../js/core/systemMap.js';
import { createEmptyProject, createProjectLink, validateProject } from '../../js/core/project.js';

test('createEmptyProject starts with an empty links array', () => {
  assert.deepEqual(createEmptyProject().links, []);
});

test('createProjectLink builds a link with a fresh id, target, and optional label', () => {
  const link = createProjectLink('proj-2', '  DB schema  ');
  assert.ok(link.id);
  assert.equal(link.to, 'proj-2');
  assert.equal(link.label, 'DB schema');
});

test('validateProject backfills a missing links array and keeps well-formed links', () => {
  const result = validateProject({ nodes: [], edges: [], links: [{ id: 'l1', to: 'proj-2', label: 'related' }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.links, [{ id: 'l1', to: 'proj-2', label: 'related' }]);
});

test('validateProject drops a link with no target and fills in a missing id', () => {
  const result = validateProject({ nodes: [], edges: [], links: [{ to: '' }, { to: 'proj-3' }] });
  assert.equal(result.ok, true);
  assert.equal(result.project.links.length, 1);
  assert.equal(result.project.links[0].to, 'proj-3');
  assert.ok(result.project.links[0].id);
});

test('validateProject treats a missing/non-array links field as empty, not an error', () => {
  const result = validateProject({ nodes: [], edges: [] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.links, []);
});

test('computeSystemMapLayout places every project on a circle and skips links to unknown/deleted projects', () => {
  const projects = [
    { id: 'a', name: 'A', links: [{ id: 'l1', to: 'b', label: 'uses' }, { id: 'l2', to: 'deleted', label: '' }] },
    { id: 'b', name: 'B', links: [] },
    { id: 'c', name: 'C', links: [] },
  ];
  const layout = computeSystemMapLayout(projects, { centerX: 0, centerY: 0, radius: 100 });
  assert.equal(layout.nodes.length, 3);
  assert.equal(layout.links.length, 1);
  assert.equal(layout.links[0].fromId, 'a');
  assert.equal(layout.links[0].toId, 'b');
  // Every node sits at distance `radius` from the given center.
  for (const n of layout.nodes) {
    const dist = Math.sqrt(n.x * n.x + n.y * n.y);
    assert.ok(Math.abs(dist - 100) < 1e-9, `node ${n.id} should sit on the circle, got distance ${dist}`);
  }
});

test('computeSystemMapLayout places a single project at dead center rather than an arbitrary point on the circle', () => {
  const layout = computeSystemMapLayout([{ id: 'only', name: 'Only', links: [] }], { centerX: 50, centerY: 60 });
  assert.deepEqual(layout.nodes, [{ id: 'only', name: 'Only', x: 50, y: 60 }]);
});

test('computeSystemMapLayout handles an empty project list', () => {
  const layout = computeSystemMapLayout([]);
  assert.deepEqual(layout.nodes, []);
  assert.deepEqual(layout.links, []);
});
