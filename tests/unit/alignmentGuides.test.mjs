import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAlignmentGuides, boundingBoxOf } from '../../js/core/alignmentGuides.js';

test('computeAlignmentGuides returns zero offset and no guides when nothing is within threshold', () => {
  const moving = { x: 0, y: 0, w: 100, h: 50 };
  const staticBoxes = [{ x: 500, y: 500, w: 100, h: 50 }];
  const result = computeAlignmentGuides(moving, staticBoxes, 6);
  assert.equal(result.dx, 0);
  assert.equal(result.dy, 0);
  assert.deepEqual(result.verticalGuides, []);
  assert.deepEqual(result.horizontalGuides, []);
});

test('snaps left edge to a nearby static box\'s left edge within threshold', () => {
  const moving = { x: 103, y: 0, w: 100, h: 50 };
  const staticBoxes = [{ x: 100, y: 200, w: 100, h: 50 }];
  const result = computeAlignmentGuides(moving, staticBoxes, 6);
  assert.equal(result.dx, -3); // 100 - 103
  assert.equal(result.verticalGuides.length, 1);
  assert.equal(result.verticalGuides[0].x, 100);
});

test('snaps center to a nearby static box\'s center (different widths, so only the center pair lines up), independently on each axis', () => {
  const moving = { x: 0, y: 0, w: 100, h: 100 }; // center (50, 50)
  const staticBoxes = [{ x: 18, y: 300, w: 60, h: 100 }]; // center (48, 350) — 2px off on x, far on y
  const result = computeAlignmentGuides(moving, staticBoxes, 6);
  assert.equal(result.dx, -2); // 48 - 50
  assert.equal(result.dy, 0); // y too far to snap
});

test('does not snap when the closest match exceeds the threshold', () => {
  const moving = { x: 0, y: 0, w: 100, h: 50 };
  const staticBoxes = [{ x: 110, y: 0, w: 100, h: 50 }]; // 10px away, threshold 6
  const result = computeAlignmentGuides(moving, staticBoxes, 6);
  assert.equal(result.dx, 0);
  assert.equal(result.verticalGuides.length, 0);
});

test('picks the single closest match when multiple static boxes could snap on the same axis', () => {
  const moving = { x: 0, y: 0, w: 100, h: 50 };
  const staticBoxes = [
    { x: 4, y: 0, w: 100, h: 50 }, // 4px away
    { x: -2, y: 200, w: 100, h: 50 }, // 2px away — closer
  ];
  const result = computeAlignmentGuides(moving, staticBoxes, 6);
  assert.equal(result.dx, -2);
});

test('guide lines include every static box that shares the winning alignment, not just the one that produced it', () => {
  const moving = { x: 0, y: 0, w: 100, h: 50 };
  const staticBoxes = [
    { x: 3, y: 0, w: 100, h: 50 },
    { x: 3, y: 200, w: 100, h: 50 }, // shares the same left edge (x=3) once snapped
    { x: 500, y: 400, w: 100, h: 50 }, // unrelated
  ];
  const result = computeAlignmentGuides(moving, staticBoxes, 6);
  assert.equal(result.dx, 3);
  assert.equal(result.verticalGuides.length, 2);
});

test('boundingBoxOf spans the min/max extents of every node passed in', () => {
  const nodes = [
    { x: 0, y: 0, w: 50, h: 50 },
    { x: 100, y: 20, w: 30, h: 30 },
    { x: -10, y: 200, w: 20, h: 20 },
  ];
  const box = boundingBoxOf(nodes);
  assert.deepEqual(box, { x: -10, y: 0, w: 140, h: 220 });
});
