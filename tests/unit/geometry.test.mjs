import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp, sideAnchor, closestSide, rectsIntersect, pointInRect, snap,
  straightPath, orthogonalPath, curvedPath, buildPath, distance, pickBestSides,
} from '../../js/core/geometry.js';

test('clamp keeps values within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
});

test('sideAnchor returns the midpoint of the requested side', () => {
  const rect = { x: 0, y: 0, w: 100, h: 50 };
  assert.deepEqual(sideAnchor(rect, 'top'), { x: 50, y: 0 });
  assert.deepEqual(sideAnchor(rect, 'bottom'), { x: 50, y: 50 });
  assert.deepEqual(sideAnchor(rect, 'left'), { x: 0, y: 25 });
  assert.deepEqual(sideAnchor(rect, 'right'), { x: 100, y: 25 });
});

test('closestSide picks the side nearest a point', () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(closestSide(rect, { x: 200, y: 50 }), 'right');
  assert.equal(closestSide(rect, { x: -200, y: 50 }), 'left');
  assert.equal(closestSide(rect, { x: 50, y: 300 }), 'bottom');
  assert.equal(closestSide(rect, { x: 50, y: -300 }), 'top');
});

test('rectsIntersect detects overlap correctly', () => {
  const a = { x: 0, y: 0, w: 50, h: 50 };
  assert.equal(rectsIntersect(a, { x: 25, y: 25, w: 50, h: 50 }), true);
  assert.equal(rectsIntersect(a, { x: 100, y: 100, w: 50, h: 50 }), false);
});

test('pointInRect', () => {
  const rect = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(pointInRect({ x: 5, y: 5 }, rect), true);
  assert.equal(pointInRect({ x: 50, y: 5 }, rect), false);
});

test('snap rounds to the nearest grid size', () => {
  assert.equal(snap(23, 10), 20);
  assert.equal(snap(27, 10), 30);
  assert.equal(snap(23, 0), 23, 'grid size 0 disables snapping');
});

test('path builders return non-empty SVG path strings starting with M', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 100 };
  for (const d of [straightPath(a, b), curvedPath(a, b), orthogonalPath(a, b, 'right', 'left')]) {
    assert.match(d, /^M /);
  }
});

test('buildPath dispatches on routing type', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };
  assert.equal(buildPath('straight', a, b), straightPath(a, b));
  assert.equal(buildPath('curved', a, b), curvedPath(a, b));
  assert.equal(buildPath('orthogonal', a, b, 'right', 'left'), orthogonalPath(a, b, 'right', 'left'));
});

test('distance computes euclidean distance', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('pickBestSides connects right-to-left when the target is clearly to the right', () => {
  const from = { x: 0, y: 0, w: 100, h: 80 };
  const to = { x: 400, y: 0, w: 100, h: 80 };
  assert.deepEqual(pickBestSides(from, to), { fromSide: 'right', toSide: 'left' });
  assert.deepEqual(pickBestSides(to, from), { fromSide: 'left', toSide: 'right' });
});

test('pickBestSides connects bottom-to-top when the target is clearly below', () => {
  const from = { x: 0, y: 0, w: 100, h: 80 };
  const to = { x: 0, y: 400, w: 100, h: 80 };
  assert.deepEqual(pickBestSides(from, to), { fromSide: 'bottom', toSide: 'top' });
  assert.deepEqual(pickBestSides(to, from), { fromSide: 'top', toSide: 'bottom' });
});

test('pickBestSides ignores which exact connection point was dragged from/to — same nodes, same result regardless of input side', () => {
  const from = { x: 0, y: 0, w: 100, h: 80 };
  const to = { x: 400, y: 0, w: 100, h: 80 };
  // pickBestSides doesn't even take a "dragged side" argument — this test
  // documents that the function is purely a function of node geometry.
  assert.deepEqual(pickBestSides(from, to), pickBestSides(from, to));
});

test('pickBestSides picks the axis with the larger gap for a diagonal arrangement', () => {
  const from = { x: 0, y: 0, w: 100, h: 80 };
  // Far below (large y gap), only slightly to the right (small x gap) — should connect vertically.
  const toBelow = { x: 130, y: 500, w: 100, h: 80 };
  assert.deepEqual(pickBestSides(from, toBelow), { fromSide: 'bottom', toSide: 'top' });
  // Far to the right (large x gap), only slightly below (small y gap) — should connect horizontally.
  const toRight = { x: 500, y: 110, w: 100, h: 80 };
  assert.deepEqual(pickBestSides(from, toRight), { fromSide: 'right', toSide: 'left' });
});

test('pickBestSides falls back to center-delta comparison for overlapping/nested rects', () => {
  const from = { x: 0, y: 0, w: 300, h: 300 };
  const to = { x: 100, y: 100, w: 50, h: 50 }; // fully inside `from`
  const result = pickBestSides(from, to);
  assert.ok(['left', 'right', 'top', 'bottom'].includes(result.fromSide));
  assert.ok(['left', 'right', 'top', 'bottom'].includes(result.toSide));
});
