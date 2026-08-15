import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProject, createNode, createEdge, removeNode, removeEdge, validateProject, nextZIndex, duplicateProject,
} from '../../js/core/project.js';

test('createEmptyProject has the expected shape', () => {
  const p = createEmptyProject('Test');
  assert.equal(p.name, 'Test');
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
  assert.equal(p.viewport.zoom, 1);
  assert.ok(p.id.startsWith('proj_'));
});

test('createNode applies defaults and overrides', () => {
  const def = { id: 'aws-ec2', name: 'EC2', icon: '🖥️', shape: 'rounded', color: '#FF9900', fill: '#FFF', subComponents: [{ name: 'Auth', icon: '🔐' }], defaultSize: { w: 160, h: 84 } };
  const node = createNode(def, 10, 20);
  assert.equal(node.defId, 'aws-ec2');
  assert.equal(node.x, 10);
  assert.equal(node.y, 20);
  assert.equal(node.text, 'EC2');
  assert.equal(node.subComponents.length, 1);
  assert.ok(node.subComponents[0].id);
  assert.notEqual(node.id, undefined);
  assert.equal(node.iconVisible, true, 'icon visible by default');
  assert.equal(node.textPosition, 'center', 'text position centered by default');
  assert.equal(node.subComponentsDisplay, 'chips', 'sub-components shown as chips by default');
});

test('createNode overrides can set iconVisible/textPosition/subComponentsDisplay', () => {
  const node = createNode(null, 0, 0, { iconVisible: false, textPosition: 'above', subComponentsDisplay: 'full', fill: 'transparent' });
  assert.equal(node.iconVisible, false);
  assert.equal(node.textPosition, 'above');
  assert.equal(node.subComponentsDisplay, 'full');
  assert.equal(node.fill, 'transparent');
});

test('createEdge applies sane defaults', () => {
  const edge = createEdge('n1', 'n2');
  assert.equal(edge.from, 'n1');
  assert.equal(edge.to, 'n2');
  assert.equal(edge.endArrow, 'filled');
  assert.equal(edge.startArrow, 'none');
  assert.equal(edge.routing, 'orthogonal');
});

test('createNode defaults groupId to null and it is overridable', () => {
  const node = createNode(null, 0, 0);
  assert.equal(node.groupId, null);
  const grouped = createNode(null, 0, 0, { groupId: 'group_1' });
  assert.equal(grouped.groupId, 'group_1');
});

test('createEdge accepts "magic" as a routing override', () => {
  const edge = createEdge('n1', 'n2', { routing: 'magic' });
  assert.equal(edge.routing, 'magic');
});

test('removeNode cascades to connected edges', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id));
  removeNode(p, n1.id);
  assert.equal(p.nodes.length, 1);
  assert.equal(p.edges.length, 0, 'edge referencing the removed node must be cascade-deleted');
});

test('removeEdge only removes the targeted edge', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  const e1 = createEdge(n1.id, n2.id);
  const e2 = createEdge(n2.id, n1.id);
  p.edges.push(e1, e2);
  removeEdge(p, e1.id);
  assert.equal(p.edges.length, 1);
  assert.equal(p.edges[0].id, e2.id);
});

test('nextZIndex increments above the current max', () => {
  const p = createEmptyProject();
  p.nodes.push(createNode(null, 0, 0, { zIndex: 5 }), createNode(null, 0, 0, { zIndex: 2 }));
  assert.equal(nextZIndex(p), 6);
});

test('validateProject rejects non-object input', () => {
  assert.equal(validateProject(null).ok, false);
  assert.equal(validateProject('a string').ok, false);
  assert.equal(validateProject({}).ok, false, 'missing nodes/edges arrays should fail');
});

test('validateProject accepts a well-formed project and fills in defaults for a minimal node', () => {
  const raw = {
    name: 'My Diagram',
    nodes: [{ id: 'n1', x: 5, y: 5 }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes.length, 1);
  assert.equal(result.project.nodes[0].w, 160, 'missing width should default');
  assert.equal(result.project.nodes[0].shape, 'rounded', 'missing/invalid shape should default');
});

test('validateProject drops edges referencing unknown nodes (no dangling references)', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }],
    edges: [{ id: 'e1', from: 'n1', to: 'does-not-exist' }],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.edges.length, 0);
});

test('validateProject clamps unknown enum values to safe defaults instead of throwing', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, shape: 'not-a-real-shape', textAlign: 'diagonal', textPosition: 'sideways', subComponentsDisplay: 'exploded' }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes[0].shape, 'rounded');
  assert.equal(result.project.nodes[0].textAlign, 'center');
  assert.equal(result.project.nodes[0].textPosition, 'center');
  assert.equal(result.project.nodes[0].subComponentsDisplay, 'chips');
});

test('validateProject preserves valid textPosition/iconVisible/subComponentsDisplay values', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, textPosition: 'below', iconVisible: false, subComponentsDisplay: 'full' }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.project.nodes[0].textPosition, 'below');
  assert.equal(result.project.nodes[0].iconVisible, false);
  assert.equal(result.project.nodes[0].subComponentsDisplay, 'full');
});

test('validateProject preserves a valid groupId and defaults a missing/invalid one to null', () => {
  const raw = {
    nodes: [
      { id: 'n1', x: 0, y: 0, groupId: 'group_abc' },
      { id: 'n2', x: 0, y: 0, groupId: 42 },
      { id: 'n3', x: 0, y: 0 },
    ],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.project.nodes[0].groupId, 'group_abc');
  assert.equal(result.project.nodes[1].groupId, null);
  assert.equal(result.project.nodes[2].groupId, null);
});

test('validateProject accepts "magic" as a valid edge routing', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 100, y: 0 }],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', routing: 'magic' }],
  };
  const result = validateProject(raw);
  assert.equal(result.project.edges[0].routing, 'magic');
});

test('validateProject never throws on malformed/malicious input', () => {
  const inputs = [undefined, 42, [], { nodes: 'not-array', edges: null }, { nodes: [null, 5, { id: 1 }], edges: [{}] }];
  for (const input of inputs) {
    assert.doesNotThrow(() => validateProject(input));
  }
});

test('duplicateProject clones the project under a new id/name, regenerating every node and edge id', () => {
  const p = createEmptyProject('Original');
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id, { label: 'HTTPS' }));

  const copy = duplicateProject(p);

  assert.notEqual(copy.id, p.id);
  assert.equal(copy.name, 'Original (Copy)');
  assert.equal(copy.nodes.length, 2);
  assert.equal(copy.edges.length, 1);
  assert.notEqual(copy.nodes[0].id, n1.id);
  assert.notEqual(copy.nodes[1].id, n2.id);
  assert.equal(copy.edges[0].from, copy.nodes[0].id, 'the cloned edge should reference the cloned node ids, not the originals');
  assert.equal(copy.edges[0].to, copy.nodes[1].id);
  assert.equal(copy.edges[0].label, 'HTTPS', 'other edge fields carry over unchanged');
});

test('duplicateProject regenerates sub-component ids and remaps groupId so the copy forms its own group', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0, { groupId: 'group_x', subComponents: [{ id: 'sc_1', name: 'Auth', icon: '🔐' }] });
  const n2 = createNode(null, 100, 0, { groupId: 'group_x' });
  p.nodes.push(n1, n2);

  const copy = duplicateProject(p);

  assert.notEqual(copy.nodes[0].groupId, 'group_x');
  assert.equal(copy.nodes[0].groupId, copy.nodes[1].groupId, 'both copied nodes should share the same new group id');
  assert.notEqual(copy.nodes[0].subComponents[0].id, 'sc_1');
  assert.equal(copy.nodes[0].subComponents[0].name, 'Auth');
});

test('duplicateProject leaves the original project completely untouched', () => {
  const p = createEmptyProject('Original');
  const n1 = createNode(null, 0, 0);
  p.nodes.push(n1);
  const originalId = p.id;
  const originalNodeId = n1.id;

  duplicateProject(p);

  assert.equal(p.id, originalId);
  assert.equal(p.nodes[0].id, originalNodeId);
  assert.equal(p.name, 'Original');
});
