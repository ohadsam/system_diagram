import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLifelines } from '../../js/core/sequenceDiagram.js';

const SIZE = { w: 140, h: 640 };

test('layoutLifelines places one rect per name, each with the given size', () => {
  const result = layoutLifelines(['Client', 'Server'], 0, 0, SIZE);
  assert.equal(result.length, 2);
  for (const r of result) {
    assert.equal(r.w, SIZE.w);
    assert.equal(r.h, SIZE.h);
  }
  assert.equal(result[0].text, 'Client');
  assert.equal(result[1].text, 'Server');
});

test('layoutLifelines spaces lifelines evenly left to right', () => {
  const result = layoutLifelines(['A', 'B', 'C'], 0, 0, SIZE);
  const gap1 = result[1].x - result[0].x;
  const gap2 = result[2].x - result[1].x;
  assert.equal(gap1, gap2);
  assert.ok(gap1 > SIZE.w, 'lifelines do not overlap');
});

test('layoutLifelines centers the whole row on the given point', () => {
  const result = layoutLifelines(['A', 'B'], 1000, 500, SIZE);
  const minX = Math.min(...result.map((r) => r.x));
  const maxX = Math.max(...result.map((r) => r.x + r.w));
  assert.ok(Math.abs((minX + maxX) / 2 - 1000) < 1e-9);
  for (const r of result) assert.equal(r.y, 500);
});

test('layoutLifelines handles a single participant (still centered, no crash)', () => {
  const result = layoutLifelines(['Solo'], 200, 300, SIZE);
  assert.equal(result.length, 1);
  assert.equal(result[0].x, 200 - SIZE.w / 2);
});

test('layoutLifelines handles a larger group (6 participants)', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  const result = layoutLifelines(names, 0, 0, SIZE);
  assert.equal(result.length, 6);
  const xs = result.map((r) => r.x);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), 'left to right order preserved');
});

test('layoutLifelines returns an empty array for no names', () => {
  assert.deepEqual(layoutLifelines([], 0, 0, SIZE), []);
});
