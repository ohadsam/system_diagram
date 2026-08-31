import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spreadNodesForLabels } from '../../js/core/labelSpacing.js';

function node(id, x, y, w = 100, h = 60) {
  return { id, x, y, w, h };
}

function edge(from, to, label) {
  return { from, to, label };
}

test('spreadNodesForLabels is a no-op when nodes are already far enough apart', () => {
  const nodes = [node('a', 0, 0), node('b', 1000, 0)];
  const edges = [edge('a', 'b', 'short')];
  assert.equal(spreadNodesForLabels(nodes, edges).size, 0);
});

test('spreadNodesForLabels is a no-op for unlabeled edges', () => {
  const nodes = [node('a', 0, 0), node('b', 120, 0)];
  const edges = [edge('a', 'b', '')];
  assert.equal(spreadNodesForLabels(nodes, edges).size, 0);
});

test('spreadNodesForLabels pushes two overlapping-label nodes apart symmetrically', () => {
  const nodes = [node('a', 0, 0), node('b', 120, 0)];
  const edges = [edge('a', 'b', 'a fairly long label that needs more room than this')];
  const updates = spreadNodesForLabels(nodes, edges);
  assert.equal(updates.size, 2);
  const a = updates.get('a');
  const b = updates.get('b');
  assert.ok(a.x < 0, 'a moves left (away from b)');
  assert.ok(b.x > 120, 'b moves right (away from a)');
  // Symmetric: each moved the same distance from its original position.
  assert.ok(Math.abs(Math.abs(a.x - 0) - Math.abs(b.x - 120)) < 1e-9);
  assert.equal(a.y, 0);
  assert.equal(b.y, 0);
});

test('spreadNodesForLabels ignores self-loop edges (same node on both ends)', () => {
  const nodes = [node('a', 0, 0)];
  const edges = [edge('a', 'a', 'a long enough label to normally trigger spreading apart')];
  assert.equal(spreadNodesForLabels(nodes, edges).size, 0);
});

test('spreadNodesForLabels ignores edges referencing a missing node', () => {
  const nodes = [node('a', 0, 0)];
  const edges = [edge('a', 'missing', 'a long enough label to normally trigger spreading apart')];
  assert.equal(spreadNodesForLabels(nodes, edges).size, 0);
});

test('spreadNodesForLabels accumulates multiple nudges on a shared node', () => {
  const nodes = [node('a', 0, 0), node('b', 120, 0), node('c', 0, 120)];
  const longLabel = 'a fairly long label that needs more room than this default gap';
  const edges = [edge('a', 'b', longLabel), edge('a', 'c', longLabel)];
  const updates = spreadNodesForLabels(nodes, edges);
  assert.ok(updates.has('a'));
  assert.ok(updates.has('b'));
  assert.ok(updates.has('c'));
});
