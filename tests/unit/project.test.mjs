import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProject, createNode, createEdge, removeNode, removeEdge, validateProject, nextZIndex,
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
});

test('createEdge applies sane defaults', () => {
  const edge = createEdge('n1', 'n2');
  assert.equal(edge.from, 'n1');
  assert.equal(edge.to, 'n2');
  assert.equal(edge.endArrow, 'filled');
  assert.equal(edge.startArrow, 'none');
  assert.equal(edge.routing, 'orthogonal');
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
    nodes: [{ id: 'n1', x: 0, y: 0, shape: 'not-a-real-shape', textAlign: 'diagonal' }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes[0].shape, 'rounded');
  assert.equal(result.project.nodes[0].textAlign, 'center');
});

test('validateProject never throws on malformed/malicious input', () => {
  const inputs = [undefined, 42, [], { nodes: 'not-array', edges: null }, { nodes: [null, 5, { id: 1 }], edges: [{}] }];
  for (const input of inputs) {
    assert.doesNotThrow(() => validateProject(input));
  }
});
