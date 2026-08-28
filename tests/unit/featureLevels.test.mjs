import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURE_PACK_IDS, packsForMode, isPackEnabled, getDueSuggestionMilestone, SUGGESTION_MILESTONES,
} from '../../js/core/featureLevels.js';

test('packsForMode: basic enables nothing', () => {
  assert.deepEqual(packsForMode('basic', ['ai-tools']), []);
});

test('packsForMode: advanced enables every pack regardless of enabledPacks', () => {
  assert.deepEqual(packsForMode('advanced', []), FEATURE_PACK_IDS);
});

test('packsForMode: custom enables exactly the listed packs', () => {
  assert.deepEqual(packsForMode('custom', ['ai-tools', 'collaboration']).sort(), ['ai-tools', 'collaboration'].sort());
});

test('packsForMode: an unrecognized mode fails closed (nothing enabled)', () => {
  assert.deepEqual(packsForMode('bogus', FEATURE_PACK_IDS), []);
});

test('isPackEnabled reads through packsForMode', () => {
  assert.equal(isPackEnabled({ featureMode: 'basic', enabledPacks: [] }, 'ai-tools'), false);
  assert.equal(isPackEnabled({ featureMode: 'advanced', enabledPacks: [] }, 'ai-tools'), true);
  assert.equal(isPackEnabled({ featureMode: 'custom', enabledPacks: ['ai-tools'] }, 'ai-tools'), true);
  assert.equal(isPackEnabled({ featureMode: 'custom', enabledPacks: ['ai-tools'] }, 'collaboration'), false);
});

test('getDueSuggestionMilestone: never fires outside basic mode', () => {
  assert.equal(getDueSuggestionMilestone({ featureMode: 'advanced', sessionCount: 100 }), null);
  assert.equal(getDueSuggestionMilestone({ featureMode: 'custom', sessionCount: 100 }), null);
});

test('getDueSuggestionMilestone: never fires once dismissed forever', () => {
  assert.equal(getDueSuggestionMilestone({ featureMode: 'basic', sessionCount: 100, suggestionDismissedForever: true }), null);
});

test('getDueSuggestionMilestone: fires the first unmet milestone in order', () => {
  assert.equal(getDueSuggestionMilestone({ featureMode: 'basic', sessionCount: SUGGESTION_MILESTONES[0] }), SUGGESTION_MILESTONES[0]);
  assert.equal(getDueSuggestionMilestone({ featureMode: 'basic', sessionCount: SUGGESTION_MILESTONES[0], suggestionsShownAtSessions: [SUGGESTION_MILESTONES[0]] }), null);
});

test('getDueSuggestionMilestone: below the first milestone, nothing is due', () => {
  assert.equal(getDueSuggestionMilestone({ featureMode: 'basic', sessionCount: 1 }), null);
});

test('getDueSuggestionMilestone: skips past already-shown milestones to the next due one', () => {
  const due = getDueSuggestionMilestone({
    featureMode: 'basic',
    sessionCount: SUGGESTION_MILESTONES[1],
    suggestionsShownAtSessions: [SUGGESTION_MILESTONES[0]],
  });
  assert.equal(due, SUGGESTION_MILESTONES[1]);
});
