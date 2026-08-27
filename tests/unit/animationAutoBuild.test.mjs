import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAutoWalkthroughAnimation, AUTO_ANIMATION_DEFAULT_DELAY_MS, AUTO_ANIMATION_MIN_DELAY_MS, AUTO_ANIMATION_MAX_DELAY_MS } from '../../js/core/animationAutoBuild.js';

const project = {
  nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
  edges: [{ id: 'e1' }, { id: 'e2' }],
};

test('reveals every node then every edge, in their existing array order', () => {
  const animation = buildAutoWalkthroughAnimation(project);
  const targets = animation.steps.map((s) => s.targets[0]);
  assert.deepEqual(targets, [
    { targetType: 'node', targetId: 'n1' },
    { targetType: 'node', targetId: 'n2' },
    { targetType: 'node', targetId: 'n3' },
    { targetType: 'edge', targetId: 'e1' },
    { targetType: 'edge', targetId: 'e2' },
  ]);
});

test('defaults to a 3-second auto-advance and turns on autoFocus', () => {
  const animation = buildAutoWalkthroughAnimation(project);
  assert.equal(animation.autoFocus, true);
  for (const step of animation.steps) {
    assert.equal(step.revealMode, 'auto');
    assert.equal(step.delayMs, AUTO_ANIMATION_DEFAULT_DELAY_MS);
  }
});

test('honors an explicit click-to-advance choice, ignoring delayMs', () => {
  const animation = buildAutoWalkthroughAnimation(project, { revealMode: 'click', delayMs: 9999 });
  for (const step of animation.steps) assert.equal(step.revealMode, 'click');
});

test('clamps an out-of-range delayMs into [MIN, MAX] rather than accepting it verbatim', () => {
  const tooLow = buildAutoWalkthroughAnimation(project, { delayMs: 1 });
  assert.equal(tooLow.steps[0].delayMs, AUTO_ANIMATION_MIN_DELAY_MS);
  const tooHigh = buildAutoWalkthroughAnimation(project, { delayMs: 999999 });
  assert.equal(tooHigh.steps[0].delayMs, AUTO_ANIMATION_MAX_DELAY_MS);
});

test('accepts a custom name, and never throws on an empty project', () => {
  const named = buildAutoWalkthroughAnimation(project, { name: 'My Walkthrough' });
  assert.equal(named.name, 'My Walkthrough');
  assert.doesNotThrow(() => buildAutoWalkthroughAnimation({ nodes: [], edges: [] }));
  const empty = buildAutoWalkthroughAnimation({ nodes: [], edges: [] });
  assert.deepEqual(empty.steps, []);
});
