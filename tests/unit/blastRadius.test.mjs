import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBlastRadius } from '../../js/core/blastRadius.js';

// A -> B -> C, D -> B (B depends on C; A and D both depend on B)
const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const edges = [
  { id: 'e1', from: 'a', to: 'b' },
  { id: 'e2', from: 'b', to: 'c' },
  { id: 'e3', from: 'd', to: 'b' },
];

test('computeBlastRadius finds downstream (what b feeds) and upstream (what depends on b)', () => {
  const result = computeBlastRadius(nodes, edges, 'b');
  assert.deepEqual(result.downstreamNodeIds.sort(), ['c']);
  assert.deepEqual(result.upstreamNodeIds.sort(), ['a', 'd']);
  assert.deepEqual(result.edgeIds.sort(), ['e1', 'e2', 'e3']);
});

test('computeBlastRadius on a leaf node with only upstream callers has no downstream', () => {
  const result = computeBlastRadius(nodes, edges, 'c');
  assert.deepEqual(result.downstreamNodeIds, []);
  assert.deepEqual(result.upstreamNodeIds.sort(), ['a', 'b', 'd']);
});

test('computeBlastRadius on a node with no edges at all returns empty in both directions', () => {
  const isolated = [...nodes, { id: 'z' }];
  const result = computeBlastRadius(isolated, edges, 'z');
  assert.deepEqual(result.downstreamNodeIds, []);
  assert.deepEqual(result.upstreamNodeIds, []);
  assert.deepEqual(result.edgeIds, []);
});

test('computeBlastRadius never traverses past a cycle infinitely and excludes the start node itself', () => {
  const cyclic = [{ id: 'x' }, { id: 'y' }];
  const cyclicEdges = [{ id: 'ce1', from: 'x', to: 'y' }, { id: 'ce2', from: 'y', to: 'x' }];
  const result = computeBlastRadius(cyclic, cyclicEdges, 'x');
  assert.deepEqual(result.downstreamNodeIds, ['y']);
  assert.deepEqual(result.upstreamNodeIds, ['y']);
});

test('computeBlastRadius on an unknown node id returns all-empty rather than throwing', () => {
  const result = computeBlastRadius(nodes, edges, 'does-not-exist');
  assert.deepEqual(result.downstreamNodeIds, []);
  assert.deepEqual(result.upstreamNodeIds, []);
  assert.deepEqual(result.edgeIds, []);
});
