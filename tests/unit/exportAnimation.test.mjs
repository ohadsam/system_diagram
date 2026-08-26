import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnimationFile } from '../../js/io/exportAnimation.js';

// Only parseAnimationFile is unit-tested here — exportAnimation() itself
// calls utils/download.js's downloadJSON, which needs a real DOM (Blob,
// document.createElement, URL.createObjectURL); that side gets e2e
// coverage instead, same convention as every other DOM-touching io/ module
// in this repo (see tests/unit/storage.test.mjs's header comment).

function validFile(steps) {
  return JSON.stringify({ formatVersion: 1, kind: 'sdb-diagram-animation', projectName: 'Test', exportedAt: '2026-01-01T00:00:00.000Z', steps });
}

test('parseAnimationFile rejects invalid JSON', () => {
  const result = parseAnimationFile('not json', new Set(), new Set());
  assert.equal(result.ok, false);
  assert.match(result.error, /Invalid JSON/);
});

test('parseAnimationFile rejects a file that is not a diagram animation export', () => {
  const result = parseAnimationFile(JSON.stringify({ foo: 'bar' }), new Set(), new Set());
  assert.equal(result.ok, false);
  assert.match(result.error, /Not a diagram animation file/);
});

test('parseAnimationFile keeps steps whose target exists in the current diagram', () => {
  const text = validFile([
    { targetType: 'node', targetId: 'node_1', revealMode: 'auto', delayMs: 1500, targetLabel: 'API Gateway' },
    { targetType: 'edge', targetId: 'edge_1', revealMode: 'click', delayMs: 2000, targetLabel: 'a -> b' },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set(['edge_1']));
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].targetType, 'node');
  assert.equal(result.steps[0].targetId, 'node_1');
  assert.equal(result.steps[0].revealMode, 'auto');
  assert.equal(result.steps[0].delayMs, 1500);
  assert.ok(result.steps[0].id.startsWith('anim_'), 'a fresh id is assigned, not read from the file');
});

test('parseAnimationFile skips steps whose target does not exist in the current diagram, reporting the count', () => {
  const text = validFile([
    { targetType: 'node', targetId: 'node_1', revealMode: 'click', delayMs: 2000 },
    { targetType: 'node', targetId: 'node_missing', revealMode: 'click', delayMs: 2000 },
    { targetType: 'edge', targetId: 'edge_missing', revealMode: 'click', delayMs: 2000 },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 2);
});

test('parseAnimationFile skips malformed step entries without throwing', () => {
  const text = validFile([
    null,
    { targetType: 'bogus', targetId: 'node_1' },
    { targetType: 'node' }, // missing targetId
    { targetType: 'node', targetId: 'node_1', revealMode: 'click', delayMs: 2000 },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 3);
});

test('parseAnimationFile falls back to defaults for an invalid revealMode/delayMs', () => {
  const text = validFile([
    { targetType: 'node', targetId: 'node_1', revealMode: 'nonsense', delayMs: -100 },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  assert.equal(result.steps[0].revealMode, 'click');
  assert.equal(result.steps[0].delayMs, 2000);
});
