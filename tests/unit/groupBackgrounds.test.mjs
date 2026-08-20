import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGroupBounds } from '../../js/canvas/groupBackgrounds.js';

const node = (id, groupId, x, y, w = 100, h = 80) => ({ id, groupId, x, y, w, h });

test('a regular group with 2+ members gets a padded bounding box', () => {
  const nodes = [node('a', 'g1', 0, 0), node('b', 'g1', 200, 50)];
  const bounds = computeGroupBounds(nodes);
  assert.equal(bounds.length, 1);
  const b = bounds[0];
  assert.equal(b.groupId, 'g1');
  assert.equal(b.count, 2);
  // tight box: x 0..300, y 0..130 — padded by 20px each side
  assert.equal(b.x, -20);
  assert.equal(b.y, -20);
  assert.equal(b.w, 300 + 40);
  assert.equal(b.h, 130 + 40);
});

test('a regular group with only 1 member gets no background', () => {
  const nodes = [node('a', 'g1', 0, 0)];
  assert.deepEqual(computeGroupBounds(nodes), []);
});

test('nodes with no groupId are ignored entirely', () => {
  const nodes = [{ id: 'a', groupId: null, x: 0, y: 0, w: 10, h: 10 }];
  assert.deepEqual(computeGroupBounds(nodes), []);
});

test('a replication-side groupId gets a background with just 1 member', () => {
  const nodes = [node('a', 'gA', 0, 0), node('b', 'gB', 300, 0)];
  const bounds = computeGroupBounds(nodes, new Set(['gA', 'gB']));
  assert.equal(bounds.length, 2);
  assert.deepEqual(bounds.map((b) => b.count).sort(), [1, 1]);
});

test('a non-replicated groupId with 1 member still gets nothing, even when other groupIds are replicated', () => {
  const nodes = [node('a', 'gA', 0, 0), node('b', 'gB', 300, 0), node('c', 'gPlain', 600, 0)];
  const bounds = computeGroupBounds(nodes, new Set(['gA', 'gB']));
  assert.equal(bounds.length, 2);
  assert.ok(!bounds.some((b) => b.groupId === 'gPlain'));
});

test('multiple independent groups each get their own box', () => {
  const nodes = [
    node('a', 'g1', 0, 0), node('b', 'g1', 100, 0),
    node('c', 'g2', 1000, 1000), node('d', 'g2', 1100, 1000),
  ];
  const bounds = computeGroupBounds(nodes);
  assert.equal(bounds.length, 2);
  assert.deepEqual(new Set(bounds.map((b) => b.groupId)), new Set(['g1', 'g2']));
});
