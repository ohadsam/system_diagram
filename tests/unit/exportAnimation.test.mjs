import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnimationFile } from '../../js/io/exportAnimation.js';

// Only parseAnimationFile is unit-tested here — exportAnimation() itself
// calls utils/download.js's downloadJSON, which needs a real DOM (Blob,
// document.createElement, URL.createObjectURL); that side gets e2e
// coverage instead, same convention as every other DOM-touching io/ module
// in this repo (see tests/unit/storage.test.mjs's header comment).

function v1File(steps) {
  return JSON.stringify({ formatVersion: 1, kind: 'sdb-diagram-animation', projectName: 'Test', exportedAt: '2026-01-01T00:00:00.000Z', steps });
}

function v2File(animations, activeAnimationName) {
  return JSON.stringify({ formatVersion: 2, kind: 'sdb-diagram-animation', projectName: 'Test', exportedAt: '2026-01-01T00:00:00.000Z', activeAnimationName, animations });
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

test('v1 (legacy): parseAnimationFile wraps the old flat steps array into one "Animation 1"', () => {
  const text = v1File([
    { targetType: 'node', targetId: 'node_1', revealMode: 'auto', delayMs: 1500, targetLabel: 'API Gateway' },
    { targetType: 'edge', targetId: 'edge_1', revealMode: 'click', delayMs: 2000, targetLabel: 'a -> b' },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set(['edge_1']));
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.animations.length, 1);
  assert.equal(result.animations[0].name, 'Animation 1');
  assert.equal(result.activeAnimationId, result.animations[0].id);
  const steps = result.animations[0].steps;
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0].targets, [{ targetType: 'node', targetId: 'node_1' }]);
  assert.equal(steps[0].revealMode, 'auto');
  assert.equal(steps[0].delayMs, 1500);
  assert.ok(steps[0].id.startsWith('anim_'), 'a fresh id is assigned, not read from the file');
});

test('v1 (legacy): skips a step whose target does not exist, reporting the count', () => {
  const text = v1File([
    { targetType: 'node', targetId: 'node_1', revealMode: 'click', delayMs: 2000 },
    { targetType: 'node', targetId: 'node_missing', revealMode: 'click', delayMs: 2000 },
    { targetType: 'edge', targetId: 'edge_missing', revealMode: 'click', delayMs: 2000 },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 2);
});

test('v1 (legacy): skips malformed step entries without throwing', () => {
  const text = v1File([
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

test('v2: keeps a grouped step (multiple targets) and per-step notes/entranceStyle/hideAfterMs/autoFocus', () => {
  const text = v2File([
    { name: 'Onboarding', autoFocus: true, steps: [{ targets: [{ targetType: 'node', targetId: 'node_1' }, { targetType: 'edge', targetId: 'edge_1' }], revealMode: 'click', delayMs: 2000, entranceStyle: 'slide-up', hideAfterMs: 6000, notes: 'Explain the gateway' }] },
  ], 'Onboarding');
  const result = parseAnimationFile(text, new Set(['node_1']), new Set(['edge_1']));
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.animations.length, 1);
  const anim = result.animations[0];
  assert.equal(anim.name, 'Onboarding');
  assert.equal(anim.autoFocus, true);
  assert.equal(anim.steps.length, 1);
  assert.equal(anim.steps[0].targets.length, 2);
  assert.equal(anim.steps[0].entranceStyle, 'slide-up');
  assert.equal(anim.steps[0].hideAfterMs, 6000);
  assert.equal(anim.steps[0].notes, 'Explain the gateway');
  assert.equal(result.activeAnimationId, anim.id);
});

test('v2 (pre-entranceStyle/hideAfterMs export): a step with neither field still defaults to fade/never-hide', () => {
  const text = v2File([
    { name: 'A', steps: [{ targets: [{ targetType: 'node', targetId: 'node_1' }], revealMode: 'click', delayMs: 2000, notes: '' }] },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  const step = result.animations[0].steps[0];
  assert.equal(step.entranceStyle, 'fade');
  assert.equal(step.hideAfterMs, 0);
});

test('v2: drops just the missing target from a grouped step, keeping the rest', () => {
  const text = v2File([
    { name: 'A', steps: [{ targets: [{ targetType: 'node', targetId: 'node_1' }, { targetType: 'node', targetId: 'node_missing' }] }] },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.animations[0].steps[0].targets.length, 1);
});

test('v2: a step with zero surviving targets is dropped entirely', () => {
  const text = v2File([
    { name: 'A', steps: [{ targets: [{ targetType: 'node', targetId: 'node_missing' }] }] },
  ]);
  const result = parseAnimationFile(text, new Set(), new Set());
  assert.equal(result.animations[0].steps.length, 0);
  assert.equal(result.skippedCount, 1);
});

test('v2: multiple named animations import independently, each keeping its own steps', () => {
  const text = v2File([
    { name: 'Normal flow', steps: [{ targets: [{ targetType: 'node', targetId: 'node_1' }] }] },
    { name: 'Failure scenario', steps: [{ targets: [{ targetType: 'node', targetId: 'node_2' }] }] },
  ], 'Failure scenario');
  const result = parseAnimationFile(text, new Set(['node_1', 'node_2']), new Set());
  assert.equal(result.animations.length, 2);
  assert.equal(result.appliedCount, 2);
  const active = result.animations.find((a) => a.id === result.activeAnimationId);
  assert.equal(active.name, 'Failure scenario');
});

test('v2: falls back to the first animation when activeAnimationName does not match any', () => {
  const text = v2File([
    { name: 'A', steps: [{ targets: [{ targetType: 'node', targetId: 'node_1' }] }] },
  ], 'Does Not Exist');
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  assert.equal(result.activeAnimationId, result.animations[0].id);
});

test('v2: falls back to defaults for an invalid revealMode/delayMs/entranceStyle/hideAfterMs', () => {
  const text = v2File([
    { name: 'A', steps: [{ targets: [{ targetType: 'node', targetId: 'node_1' }], revealMode: 'nonsense', delayMs: -100, entranceStyle: 'nonsense', hideAfterMs: -100 }] },
  ]);
  const result = parseAnimationFile(text, new Set(['node_1']), new Set());
  const step = result.animations[0].steps[0];
  assert.equal(step.revealMode, 'click');
  assert.equal(step.delayMs, 2000);
  assert.equal(step.entranceStyle, 'fade');
  assert.equal(step.hideAfterMs, 0);
});
