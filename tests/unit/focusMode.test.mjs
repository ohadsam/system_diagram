import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFocusedIds } from '../../js/core/focusMode.js';

function edge(id, from, to) {
  return { id, from, to };
}

test('computeFocusedIds keeps only the selection when no edges touch it', () => {
  const { nodeIds, edgeIds } = computeFocusedIds(['a'], [edge('e1', 'b', 'c')]);
  assert.deepEqual([...nodeIds], ['a']);
  assert.equal(edgeIds.size, 0);
});

test('computeFocusedIds includes direct neighbors on both ends of an edge', () => {
  const edges = [edge('e1', 'a', 'b'), edge('e2', 'c', 'a')];
  const { nodeIds, edgeIds } = computeFocusedIds(['a'], edges);
  assert.ok(nodeIds.has('a'));
  assert.ok(nodeIds.has('b'), 'a -> b: b is a direct neighbor');
  assert.ok(nodeIds.has('c'), 'c -> a: c is a direct neighbor');
  assert.deepEqual([...edgeIds].sort(), ['e1', 'e2']);
});

test('computeFocusedIds excludes an edge between two neighbors that does not touch the selection', () => {
  // b and c are both neighbors of a, but the b<->c edge itself doesn't touch a.
  const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'c'), edge('e3', 'b', 'c')];
  const { edgeIds } = computeFocusedIds(['a'], edges);
  assert.ok(edgeIds.has('e1'));
  assert.ok(edgeIds.has('e2'));
  assert.ok(!edgeIds.has('e3'), 'b<->c does not touch the selected node a');
});

test('computeFocusedIds supports a multi-node selection, unioning each one\'s neighbors', () => {
  const edges = [edge('e1', 'a', 'x'), edge('e2', 'b', 'y')];
  const { nodeIds } = computeFocusedIds(['a', 'b'], edges);
  assert.deepEqual([...nodeIds].sort(), ['a', 'b', 'x', 'y']);
});

test('computeFocusedIds returns just the selection (no neighbors) for an empty edge list', () => {
  const { nodeIds, edgeIds } = computeFocusedIds(['a'], []);
  assert.deepEqual([...nodeIds], ['a']);
  assert.equal(edgeIds.size, 0);
});

test('computeFocusedIds returns empty sets for an empty selection', () => {
  const { nodeIds, edgeIds } = computeFocusedIds([], [edge('e1', 'a', 'b')]);
  assert.equal(nodeIds.size, 0);
  assert.equal(edgeIds.size, 0);
});
