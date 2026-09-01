import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShrunkGroups } from '../../js/canvas/shrinkGroups.js';

const node = (id, shrunkAnchorId = null) => ({ id, shrunkAnchorId });

test('a shrunk group returns its anchor mapped to the other (hidden) members', () => {
  const nodes = [node('a', 'a'), node('b', 'a'), node('c', 'a')];
  const groups = computeShrunkGroups(nodes);
  assert.equal(groups.size, 1);
  assert.deepEqual(new Set(groups.get('a')), new Set(['b', 'c']));
});

test('nodes with no shrunkAnchorId are ignored entirely', () => {
  const nodes = [node('a'), node('b')];
  assert.equal(computeShrunkGroups(nodes).size, 0);
});

test('a dangling anchor (deleted without cleanup) is skipped, not surfaced as broken', () => {
  const nodes = [node('b', 'missing-anchor'), node('c', 'missing-anchor')];
  assert.equal(computeShrunkGroups(nodes).size, 0);
});

test('multiple independent shrunk groups are each returned separately', () => {
  const nodes = [node('a', 'a'), node('b', 'a'), node('x', 'x'), node('y', 'x')];
  const groups = computeShrunkGroups(nodes);
  assert.equal(groups.size, 2);
  assert.deepEqual(groups.get('a'), ['b']);
  assert.deepEqual(groups.get('x'), ['y']);
});

test('an anchor with no other members still returns an empty hidden-members array (not skipped)', () => {
  const nodes = [node('a', 'a')];
  const groups = computeShrunkGroups(nodes);
  assert.equal(groups.size, 1);
  assert.deepEqual(groups.get('a'), []);
});
