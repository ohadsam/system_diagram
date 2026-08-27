import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiagramHealth } from '../../js/core/diagramHealth.js';

test('an empty diagram scores 100 and is labeled "Empty"', () => {
  assert.deepEqual(computeDiagramHealth(0, 0), { score: 100, label: 'Empty' });
});

test('no findings scores 100 "Excellent"', () => {
  assert.deepEqual(computeDiagramHealth(5, 0), { score: 100, label: 'Excellent' });
});

test('score drops by a fixed amount per finding and is clamped at 0', () => {
  assert.equal(computeDiagramHealth(5, 1).score, 90);
  assert.equal(computeDiagramHealth(5, 3).score, 70);
  assert.equal(computeDiagramHealth(5, 50).score, 0);
});

test('label thresholds follow the score', () => {
  assert.equal(computeDiagramHealth(5, 1).label, 'Excellent'); // score 90
  assert.equal(computeDiagramHealth(5, 3).label, 'Good'); // score 70
  assert.equal(computeDiagramHealth(5, 4).label, 'Needs attention'); // score 60
  assert.equal(computeDiagramHealth(5, 10).label, 'Poor'); // score 0
});
