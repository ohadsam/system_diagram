import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCrowding, MIN_BREATHING_GAP_PX } from '../../js/core/crowdingDetect.js';

function node(id, x, y, w = 100, h = 60, overrides = {}) {
  return { id, x, y, w, h, ...overrides };
}

test('detectCrowding returns null for fewer than 2 nodes', () => {
  assert.equal(detectCrowding([]), null);
  assert.equal(detectCrowding([node('a', 0, 0)]), null);
});

test('detectCrowding returns null for a normally-spaced diagram', () => {
  const nodes = [node('a', 0, 0), node('b', 300, 0), node('c', 0, 300), node('d', 300, 300)];
  assert.equal(detectCrowding(nodes), null);
});

test('detectCrowding flags two literally overlapping nodes, regardless of diagram size', () => {
  const nodes = [node('a', 0, 0), node('b', 10, 0)];
  const result = detectCrowding(nodes);
  assert.ok(result);
  assert.deepEqual(new Set(result.affectedNodeIds), new Set(['a', 'b']));
  assert.equal(result.targetGap, MIN_BREATHING_GAP_PX);
});

test('detectCrowding ignores animationOnly nodes entirely (invisible on the normal canvas)', () => {
  const nodes = [
    node('a', 0, 0, 100, 60, { animationOnly: true }),
    node('b', 10, 0, 100, 60, { animationOnly: true }),
  ];
  assert.equal(detectCrowding(nodes), null);
});

test('detectCrowding flags a node dropped right next to another while the rest of the diagram has generous spacing', () => {
  const nodes = [
    node('a', 0, 0),
    node('b', 5, 0), // dropped almost on top of 'a' — 5px overlap-ish gap
    node('c', 500, 0),
    node('d', 900, 0),
  ];
  const result = detectCrowding(nodes);
  assert.ok(result, 'the tight a/b pair should be flagged given how spread out c/d are');
  assert.ok(result.affectedNodeIds.includes('a'));
  assert.ok(result.affectedNodeIds.includes('b'));
  assert.equal(result.affectedNodeIds.includes('c'), false);
  assert.equal(result.affectedNodeIds.includes('d'), false);
});

test('detectCrowding does not flag a diagram that is uniformly tight by design', () => {
  // Every node the same modest distance from its neighbor — nothing here
  // reads as "uneven relative to the rest," since there's no generously-
  // spaced majority to compare against.
  const nodes = [node('a', 0, 0), node('b', 130, 0), node('c', 260, 0), node('d', 390, 0)];
  assert.equal(detectCrowding(nodes), null);
});

test('detectCrowding needs at least 4 nodes before comparing against a median (fewer than that, only literal overlap is checked)', () => {
  const nodes = [node('a', 0, 0), node('b', 130, 0), node('c', 900, 0)];
  assert.equal(detectCrowding(nodes), null);
});
