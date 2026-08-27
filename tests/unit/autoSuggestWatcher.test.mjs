import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAutoSuggestState } from '../../js/io/autoSuggestWatcher.js';

const base = { enabled: true, everyNChanges: 3, configured: true, changesSinceLastRun: 0, running: false };

test('nextAutoSuggestState never runs while disabled, resetting the counter', () => {
  const result = nextAutoSuggestState({ ...base, enabled: false, changesSinceLastRun: 5 });
  assert.equal(result.shouldRun, false);
  assert.equal(result.changesSinceLastRun, 0);
});

test('nextAutoSuggestState never runs while no automatic send mode is configured, resetting the counter', () => {
  const result = nextAutoSuggestState({ ...base, configured: false, changesSinceLastRun: 5 });
  assert.equal(result.shouldRun, false);
  assert.equal(result.changesSinceLastRun, 0);
});

test('nextAutoSuggestState increments the counter below threshold without running', () => {
  const first = nextAutoSuggestState({ ...base, changesSinceLastRun: 0 });
  assert.equal(first.shouldRun, false);
  assert.equal(first.changesSinceLastRun, 1);

  const second = nextAutoSuggestState({ ...base, changesSinceLastRun: 1 });
  assert.equal(second.shouldRun, false);
  assert.equal(second.changesSinceLastRun, 2);
});

test('nextAutoSuggestState runs and resets the counter once the threshold is reached', () => {
  const result = nextAutoSuggestState({ ...base, changesSinceLastRun: 2 }); // 2 + 1 == everyNChanges (3)
  assert.equal(result.shouldRun, true);
  assert.equal(result.changesSinceLastRun, 0);
});

test('nextAutoSuggestState never runs while a previous run is still in flight, and does not advance the counter', () => {
  const result = nextAutoSuggestState({ ...base, changesSinceLastRun: 2, running: true });
  assert.equal(result.shouldRun, false);
  assert.equal(result.changesSinceLastRun, 2, 'the counter should not advance while a run is in flight');
});

test('nextAutoSuggestState with everyNChanges of 1 runs on every settled change', () => {
  const result = nextAutoSuggestState({ ...base, everyNChanges: 1, changesSinceLastRun: 0 });
  assert.equal(result.shouldRun, true);
  assert.equal(result.changesSinceLastRun, 0);
});
