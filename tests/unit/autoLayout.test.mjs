import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAutoLayout } from '../../js/core/autoLayout.js';

function node(id, w = 160, h = 84) {
  return { id, x: 0, y: 0, w, h };
}

test('a simple chain (A -> B -> C) is laid out strictly top-to-bottom in order', () => {
  const nodes = [node('a'), node('b'), node('c')];
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }];
  const pos = computeAutoLayout(nodes, edges);
  assert.ok(pos.get('a').y < pos.get('b').y);
  assert.ok(pos.get('b').y < pos.get('c').y);
});

test('a fan-out (A -> B, A -> C) puts B and C in the same row, both below A', () => {
  const nodes = [node('a'), node('b'), node('c')];
  const edges = [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }];
  const pos = computeAutoLayout(nodes, edges);
  assert.equal(pos.get('b').y, pos.get('c').y);
  assert.ok(pos.get('a').y < pos.get('b').y);
  assert.notEqual(pos.get('b').x, pos.get('c').x);
});

test('a fan-in (A -> C, B -> C) puts A and B in the same row, both above C', () => {
  const nodes = [node('a'), node('b'), node('c')];
  const edges = [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }];
  const pos = computeAutoLayout(nodes, edges);
  assert.equal(pos.get('a').y, pos.get('b').y);
  assert.ok(pos.get('a').y < pos.get('c').y);
});

test('a node fed by a longer chain ranks below a node fed by a shorter one, even if both point at the same target', () => {
  // a -> b -> d, c -> d: d must be strictly below both a/b's deepest point,
  // i.e. below b (rank 1), not just below c (rank 0).
  const nodes = [node('a'), node('b'), node('c'), node('d')];
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'd' }, { from: 'c', to: 'd' }];
  const pos = computeAutoLayout(nodes, edges);
  assert.ok(pos.get('d').y > pos.get('b').y);
  assert.ok(pos.get('d').y > pos.get('c').y);
});

test('disconnected nodes with no edges at all still get spread out, not stacked on top of each other', () => {
  const nodes = [node('a'), node('b'), node('c')];
  const pos = computeAutoLayout(nodes, []);
  const seen = new Set();
  for (const id of ['a', 'b', 'c']) {
    const key = `${pos.get(id).x},${pos.get(id).y}`;
    assert.ok(!seen.has(key), `node ${id} overlaps an earlier node's exact position`);
    seen.add(key);
  }
});

test('a cycle (A -> B -> A) does not hang and still assigns every node a position', () => {
  const nodes = [node('a'), node('b')];
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }];
  const pos = computeAutoLayout(nodes, edges);
  assert.ok(pos.has('a'));
  assert.ok(pos.has('b'));
});

test('a self-loop edge (A -> A) is ignored rather than corrupting the layout', () => {
  const nodes = [node('a'), node('b')];
  const edges = [{ from: 'a', to: 'a' }, { from: 'a', to: 'b' }];
  const pos = computeAutoLayout(nodes, edges);
  assert.ok(pos.get('a').y < pos.get('b').y);
});

test('an edge referencing a missing node id is ignored rather than throwing', () => {
  const nodes = [node('a')];
  const edges = [{ from: 'a', to: 'ghost' }];
  assert.doesNotThrow(() => computeAutoLayout(nodes, edges));
});

test('empty node list returns an empty map', () => {
  const pos = computeAutoLayout([], []);
  assert.equal(pos.size, 0);
});

test('nodes within the same row never horizontally overlap, accounting for their own width', () => {
  const nodes = [node('a', 200, 84), node('b', 100, 84), node('c', 150, 84)];
  const edges = [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }];
  const pos = computeAutoLayout(nodes, edges);
  const row = ['b', 'c'].map((id) => ({ id, ...pos.get(id), w: nodes.find((n) => n.id === id).w }));
  row.sort((r1, r2) => r1.x - r2.x);
  assert.ok(row[0].x + row[0].w <= row[1].x);
});

test('a very wide single layer wraps into multiple sub-rows instead of running off arbitrarily far', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => node(`n${i}`, 160, 84));
  const pos = computeAutoLayout(nodes, []);
  const ys = new Set(nodes.map((n) => pos.get(n.id).y));
  assert.ok(ys.size > 1, 'expected more than one row for 30 wide 160px-wide disconnected nodes');
});
