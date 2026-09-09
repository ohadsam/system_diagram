import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeOverlapPositions, rectGap } from '../../js/core/deOverlap.js';
import { rectsIntersect } from '../../js/core/geometry.js';

function node(id, x, y, w = 100, h = 60) {
  return { id, x, y, w, h };
}

test('computeDeOverlapPositions is a no-op when every pair already clears targetGap', () => {
  const nodes = [node('a', 0, 0), node('b', 200, 0)];
  assert.equal(computeDeOverlapPositions(nodes, 16).size, 0);
});

test('computeDeOverlapPositions is a no-op with fewer than 2 nodes or a non-positive targetGap', () => {
  assert.equal(computeDeOverlapPositions([node('a', 0, 0)], 16).size, 0);
  assert.equal(computeDeOverlapPositions([], 16).size, 0);
  assert.equal(computeDeOverlapPositions([node('a', 0, 0), node('b', 0, 0)], 0).size, 0);
});

test('computeDeOverlapPositions separates two fully overlapping nodes (dropped exactly on top of each other)', () => {
  const nodes = [node('a', 0, 0), node('b', 0, 0)];
  const updates = computeDeOverlapPositions(nodes, 16);
  assert.equal(updates.size, 2);
  const a = updates.get('a');
  const b = updates.get('b');
  const finalA = { ...nodes[0], x: a.x, y: a.y };
  const finalB = { ...nodes[1], x: b.x, y: b.y };
  assert.equal(rectsIntersect(finalA, finalB), false, 'no longer overlapping after the fix');
});

test('computeDeOverlapPositions pushes two too-close (but not overlapping) nodes apart to exactly targetGap', () => {
  const nodes = [node('a', 0, 0, 100, 60), node('b', 105, 0, 100, 60)]; // 5px gap
  const updates = computeDeOverlapPositions(nodes, 20);
  assert.equal(updates.size, 2);
  const a = updates.get('a');
  const b = updates.get('b');
  assert.ok(a.x < 0, 'a moves left, away from b');
  assert.ok(b.x > 105, 'b moves right, away from a');
  const finalGap = (b.x) - (a.x + 100);
  assert.ok(Math.abs(finalGap - 20) < 1e-6, `expected exactly 20px gap, got ${finalGap}`);
});

test('computeDeOverlapPositions preserves relative left-to-right order (never lets a later node end up left of an earlier one)', () => {
  const nodes = [node('a', 0, 0), node('b', 10, 0), node('c', 20, 0)]; // all three heavily overlapping
  const updates = computeDeOverlapPositions(nodes, 24);
  const finalX = (id) => (updates.get(id)?.x ?? nodes.find((n) => n.id === id).x);
  assert.ok(finalX('a') < finalX('b'));
  assert.ok(finalX('b') < finalX('c'));
});

test('computeDeOverlapPositions leaves an already-well-spaced node out of the returned map entirely', () => {
  const nodes = [node('a', 0, 0), node('b', 10, 0), node('c', 1000, 1000)];
  const updates = computeDeOverlapPositions(nodes, 24);
  assert.ok(updates.has('a'));
  assert.ok(updates.has('b'));
  assert.equal(updates.has('c'), false);
});

test('rectGap returns 0 when rects touch/overlap on at least one axis, and the straight-line distance otherwise', () => {
  assert.equal(rectGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }), 0);
  const gap = rectGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 });
  assert.ok(Math.abs(gap - Math.hypot(10, 10)) < 1e-9);
});
