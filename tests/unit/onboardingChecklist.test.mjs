import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONBOARDING_STEPS, computeOnboardingProgress } from '../../js/core/onboardingChecklist.js';

const EMPTY_CTX = { nodeCount: 0, edgeCount: 0, savedProjectCount: 0, commentCount: 0 };

test('a brand-new project has every step undone', () => {
  const progress = computeOnboardingProgress(EMPTY_CTX);
  assert.equal(progress.doneCount, 0);
  assert.equal(progress.total, ONBOARDING_STEPS.length);
  assert.equal(progress.allDone, false);
  assert.ok(progress.steps.every((s) => s.done === false));
});

test('each step turns on independently as its own condition is met', () => {
  assert.equal(computeOnboardingProgress({ ...EMPTY_CTX, nodeCount: 1 }).doneCount, 1);
  assert.equal(computeOnboardingProgress({ ...EMPTY_CTX, edgeCount: 1 }).doneCount, 1);
  assert.equal(computeOnboardingProgress({ ...EMPTY_CTX, savedProjectCount: 1 }).doneCount, 1);
  assert.equal(computeOnboardingProgress({ ...EMPTY_CTX, commentCount: 1 }).doneCount, 1);
});

test('allDone is true once every step is satisfied', () => {
  const progress = computeOnboardingProgress({ nodeCount: 3, edgeCount: 2, savedProjectCount: 1, commentCount: 1 });
  assert.equal(progress.doneCount, progress.total);
  assert.equal(progress.allDone, true);
});

test('step order and labels are stable (UI relies on this for consistent rendering)', () => {
  const progress = computeOnboardingProgress(EMPTY_CTX);
  assert.deepEqual(progress.steps.map((s) => s.id), ONBOARDING_STEPS.map((s) => s.id));
});
