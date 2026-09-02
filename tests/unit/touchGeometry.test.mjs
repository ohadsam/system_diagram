import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touchPointDistance, touchPointAngleDeg, normalizeRotationDeg } from '../../js/canvas/touchGeometry.js';

test('touchPointDistance computes straight-line distance between two points', () => {
  assert.equal(touchPointDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(touchPointDistance({ x: 10, y: 10 }, { x: 10, y: 10 }), 0);
});

test('touchPointAngleDeg computes the angle from a to b in degrees', () => {
  assert.equal(touchPointAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 }), 0);
  assert.equal(touchPointAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 }), 90);
  assert.equal(touchPointAngleDeg({ x: 0, y: 0 }, { x: -10, y: 0 }), 180);
  assert.equal(touchPointAngleDeg({ x: 0, y: 0 }, { x: 0, y: -10 }), -90);
});

test('normalizeRotationDeg wraps into [0, 360)', () => {
  assert.equal(normalizeRotationDeg(0), 0);
  assert.equal(normalizeRotationDeg(45), 45);
  assert.equal(normalizeRotationDeg(360), 0);
  assert.equal(normalizeRotationDeg(370), 10);
  assert.equal(normalizeRotationDeg(-10), 350);
  assert.equal(normalizeRotationDeg(-370), 350);
});
