import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMagicWaypoints } from '../../js/core/magicRouter.js';

function segmentsCrossRect(points, rect) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (minX < rect.x + rect.w && maxX > rect.x && minY < rect.y + rect.h && maxY > rect.y) return true;
  }
  return false;
}

function isOrthogonal(points) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = Math.abs(points[i].x - points[i + 1].x);
    const dy = Math.abs(points[i].y - points[i + 1].y);
    if (dx > 0.01 && dy > 0.01) return false;
  }
  return true;
}

test('computeMagicWaypoints returns a direct-ish route with no obstacles', () => {
  const from = { x: 0, y: 0, w: 160, h: 84 };
  const to = { x: 300, y: 0, w: 160, h: 84 };
  const waypoints = computeMagicWaypoints(from, to, [], 'right', 'left');
  assert.ok(waypoints, 'should find a route');
  assert.ok(isOrthogonal(waypoints), 'every segment should be horizontal or vertical');
  assert.equal(waypoints[0].x, 160);
  assert.equal(waypoints[waypoints.length - 1].x, 300);
});

test('computeMagicWaypoints routes around an obstacle blocking the direct path', () => {
  const from = { x: 0, y: 0, w: 160, h: 84 };
  const to = { x: 500, y: 0, w: 160, h: 84 };
  const obstacle = { x: 250, y: -100, w: 100, h: 300 };
  const waypoints = computeMagicWaypoints(from, to, [obstacle], 'right', 'left');
  assert.ok(waypoints, 'should find a route around the obstacle');
  assert.equal(segmentsCrossRect(waypoints, obstacle), false, 'no segment should cross the obstacle');
  assert.ok(isOrthogonal(waypoints));
});

test('computeMagicWaypoints returns null (not throws) when the target is fully boxed in', () => {
  const from = { x: 0, y: 0, w: 160, h: 84 };
  const to = { x: 500, y: 500, w: 160, h: 84 };
  const walls = [
    { x: 470, y: 470, w: 220, h: 20 },
    { x: 470, y: 470, w: 20, h: 220 },
    { x: 470, y: 670, w: 220, h: 20 },
    { x: 670, y: 470, w: 20, h: 220 },
  ];
  assert.doesNotThrow(() => computeMagicWaypoints(from, to, walls, 'right', 'left'));
  assert.equal(computeMagicWaypoints(from, to, walls, 'right', 'left'), null);
});

test('computeMagicWaypoints handles vertically-arranged nodes and top/bottom sides', () => {
  const from = { x: 0, y: 0, w: 160, h: 84 };
  const to = { x: 0, y: 300, w: 160, h: 84 };
  const obstacle = { x: -50, y: 120, w: 260, h: 40 };
  const waypoints = computeMagicWaypoints(from, to, [obstacle], 'bottom', 'top');
  assert.ok(waypoints);
  assert.equal(segmentsCrossRect(waypoints, obstacle), false);
  assert.ok(isOrthogonal(waypoints));
});

test('computeMagicWaypoints never throws on degenerate zero-size rects', () => {
  const from = { x: 0, y: 0, w: 0, h: 0 };
  const to = { x: 0, y: 0, w: 0, h: 0 };
  assert.doesNotThrow(() => computeMagicWaypoints(from, to, [], 'right', 'left'));
});
