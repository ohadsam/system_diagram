import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getUsageStats, recordSessionStart, markSuggestionShown, dismissSuggestionForever } from '../../js/io/usageStats.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getUsageStats returns the built-in defaults when nothing is saved', () => {
  assert.deepEqual(getUsageStats(), { sessionCount: 0, suggestionsShownAtSessions: [], suggestionDismissedForever: false });
});

test('recordSessionStart increments sessionCount and persists it', () => {
  recordSessionStart();
  recordSessionStart();
  const third = recordSessionStart();
  assert.equal(third.sessionCount, 3);
  assert.equal(getUsageStats().sessionCount, 3);
});

test('markSuggestionShown appends a milestone without duplicating it', () => {
  markSuggestionShown(3);
  markSuggestionShown(3);
  markSuggestionShown(8);
  assert.deepEqual(getUsageStats().suggestionsShownAtSessions, [3, 8]);
});

test('dismissSuggestionForever sets the flag', () => {
  dismissSuggestionForever();
  assert.equal(getUsageStats().suggestionDismissedForever, true);
});
