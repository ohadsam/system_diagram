import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNode3D, computeEdge3D, FORWARD_COLOR, BACKWARD_COLOR } from '../../js/core/scene3dLayout.js';

test('computeNode3D maps canvas x/y to 3D x/z (centered), and sits the box on the ground plane', () => {
  const node = { id: 'n1', x: 100, y: 200, w: 160, h: 80, shape: 'rounded', fill: '#EEE', stroke: '#333', text: 'API' };
  const n3d = computeNode3D(node);
  assert.equal(n3d.x, 180); // 100 + 160/2
  assert.equal(n3d.z, 240); // 200 + 80/2
  assert.equal(n3d.y, n3d.height / 2, 'box is centered vertically on its own half-height, so its base sits at y=0');
  assert.equal(n3d.width, 160);
  assert.equal(n3d.depth, 80);
  assert.equal(n3d.color, '#333', 'uses the node\'s stroke color, not its (washed-out pastel) fill');
});

test('computeNode3D varies extrusion height by shape, defaulting for an unlisted shape', () => {
  const base = { id: 'n', x: 0, y: 0, w: 100, h: 100, stroke: '#000' };
  const cylinder = computeNode3D({ ...base, shape: 'cylinder' });
  const rounded = computeNode3D({ ...base, shape: 'rounded' });
  const unknown = computeNode3D({ ...base, shape: 'something-new' });
  assert.ok(cylinder.height > rounded.height, 'cylinder is taller than the default extrusion');
  assert.equal(unknown.height, rounded.height, 'an unrecognized shape falls back to the same default as rounded');
});

test('computeEdge3D colors by geometric direction, not edge identity — same axis, opposite signs, opposite colors', () => {
  const left = { x: 0, y: 60, z: 0, height: 60 };
  const right = { x: 300, y: 60, z: 0, height: 60 };
  const forward = computeEdge3D(left, right);
  const backward = computeEdge3D(right, left);
  assert.equal(forward.direction, 'forward');
  assert.equal(forward.color, FORWARD_COLOR);
  assert.equal(backward.direction, 'backward');
  assert.equal(backward.color, BACKWARD_COLOR);
});

test('computeEdge3D picks whichever axis (x or z) has the larger displacement as dominant', () => {
  const from = { x: 0, y: 60, z: 0, height: 60 };
  const toAlongZ = { x: 10, y: 60, z: 500, height: 60 }; // z dominates
  const edge = computeEdge3D(from, toAlongZ);
  assert.equal(edge.direction, 'forward'); // positive z displacement
});

test('computeEdge3D arches its midpoint well above both endpoints', () => {
  const from = { x: 0, y: 60, z: 0, height: 60 };
  const to = { x: 200, y: 90, z: 0, height: 90 };
  const edge = computeEdge3D(from, to);
  assert.ok(edge.mid.y > Math.max(from.height, to.height), 'the arch peak sits above the taller of the two endpoints');
});
