import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStepDurationMs, computeTotalDurationMs, CLICK_STEP_DWELL_MS } from '../../js/core/animationVideoTiming.js';

test('an auto step uses its own delayMs as screen-time', () => {
  assert.equal(computeStepDurationMs({ revealMode: 'auto', delayMs: 5000 }), 5000);
});

test('a click step uses the fixed dwell time instead of its delayMs, since nobody is there to click', () => {
  assert.equal(computeStepDurationMs({ revealMode: 'click', delayMs: 99999 }), CLICK_STEP_DWELL_MS);
});

test('a custom dwell time can be supplied for click steps', () => {
  assert.equal(computeStepDurationMs({ revealMode: 'click', delayMs: 1 }, 3500), 3500);
});

test('computeTotalDurationMs sums every step\'s screen-time, mixing auto and click steps', () => {
  const steps = [
    { revealMode: 'auto', delayMs: 3000 },
    { revealMode: 'click', delayMs: 1 },
    { revealMode: 'auto', delayMs: 1500 },
  ];
  assert.equal(computeTotalDurationMs(steps), 3000 + CLICK_STEP_DWELL_MS + 1500);
});

test('an empty step list has zero total duration', () => {
  assert.equal(computeTotalDurationMs([]), 0);
});
