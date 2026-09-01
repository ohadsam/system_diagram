import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerpAngle, easeInOutCubic, interpolateShot, computeAutoTourShots, TOUR_HOLD_MS, TOUR_MOVE_MS } from '../../js/core/cameraTour.js';

test('lerpAngle takes the shortest path across the 0/2π wrap instead of the long way around', () => {
  const from = (350 * Math.PI) / 180;
  const to = (10 * Math.PI) / 180;
  const mid = lerpAngle(from, to, 0.5);
  // The short way is 20° of travel; the midpoint should land near 0/360°,
  // not near 180° (which is where a naive from+delta*t without wrapping
  // would put it).
  const midDeg = ((mid * 180) / Math.PI + 360) % 360;
  assert.ok(midDeg < 10 || midDeg > 350, `expected midpoint near 0/360°, got ${midDeg}`);
});

test('lerpAngle returns the exact endpoints at t=0 and t=1', () => {
  const from = 0.4;
  const to = 2.1;
  assert.ok(Math.abs(lerpAngle(from, to, 0) - from) < 1e-9);
  assert.ok(Math.abs(lerpAngle(from, to, 1) - to) < 1e-9);
});

test('easeInOutCubic is 0 at t=0, 1 at t=1, and 0.5 at the midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9);
});

test('interpolateShot blends theta/phi/radius/target and clamps t to [0,1]', () => {
  const from = { theta: 0, phi: 1, radius: 100, target: { x: 0, y: 0, z: 0 } };
  const to = { theta: Math.PI / 2, phi: 2, radius: 200, target: { x: 10, y: 20, z: 30 } };
  const start = interpolateShot(from, to, 0);
  assert.equal(start.radius, 100);
  assert.deepEqual(start.target, { x: 0, y: 0, z: 0 });
  const end = interpolateShot(from, to, 1);
  assert.equal(end.radius, 200);
  assert.deepEqual(end.target, { x: 10, y: 20, z: 30 });
  const overshoot = interpolateShot(from, to, 1.5);
  assert.equal(overshoot.radius, 200, 't beyond 1 clamps to the end pose');
  const undershoot = interpolateShot(from, to, -0.5);
  assert.equal(undershoot.radius, 100, 't below 0 clamps to the start pose');
});

test('computeAutoTourShots returns one shot per node plus a final Overview shot using the default view', () => {
  const nodes3D = [
    { x: 0, y: 0, z: 0, width: 100, height: 60, depth: 100, label: 'API' },
    { x: 200, y: 0, z: 0, width: 100, height: 60, depth: 100, label: 'DB' },
  ];
  const defaultView = { theta: 1, phi: 1, radius: 900, target: { x: 100, y: 30, z: 0 } };
  const shots = computeAutoTourShots(nodes3D, defaultView);
  assert.equal(shots.length, 3);
  assert.equal(shots[0].label, 'API');
  assert.equal(shots[1].label, 'DB');
  assert.equal(shots[2].label, 'Overview');
  assert.deepEqual(shots[2].target, defaultView.target);
  assert.equal(shots[2].radius, defaultView.radius);
  for (const shot of shots) {
    assert.ok(Number.isFinite(shot.theta));
    assert.ok(Number.isFinite(shot.phi));
    assert.ok(shot.radius > 0);
  }
});

test('computeAutoTourShots returns an empty array for an empty diagram (no dangling Overview-only tour)', () => {
  assert.deepEqual(computeAutoTourShots([], { theta: 0, phi: 1, radius: 800, target: { x: 0, y: 0, z: 0 } }), []);
});

test('exposes reasonable, positive hold/move timing constants', () => {
  assert.ok(TOUR_HOLD_MS > 0);
  assert.ok(TOUR_MOVE_MS > 0);
});
