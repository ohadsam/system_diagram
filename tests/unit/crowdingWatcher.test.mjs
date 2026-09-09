import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCrowdingSuggestion } from '../../js/io/crowdingWatcher.js';

function node(id, x, y, w = 100, h = 60) {
  return { id, x, y, w, h };
}

test('pickCrowdingSuggestion surfaces a fresh suggestion the first time a diagram becomes crowded', () => {
  const nodes = [node('a', 0, 0), node('b', 5, 0)];
  const { suggestion, nextFingerprint } = pickCrowdingSuggestion(nodes, [], null);
  assert.ok(suggestion);
  assert.deepEqual(new Set(suggestion.affectedNodeIds), new Set(['a', 'b']));
  assert.equal(nextFingerprint, 'a,b');
});

test('pickCrowdingSuggestion returns null (nothing to show) for a well-spaced diagram', () => {
  const nodes = [node('a', 0, 0), node('b', 500, 0)];
  const { suggestion, nextFingerprint } = pickCrowdingSuggestion(nodes, [], null);
  assert.equal(suggestion, null);
  assert.equal(nextFingerprint, null);
});

test('pickCrowdingSuggestion does not re-surface the exact same still-unresolved crowding twice', () => {
  const nodes = [node('a', 0, 0), node('b', 5, 0)];
  const first = pickCrowdingSuggestion(nodes, [], null);
  const second = pickCrowdingSuggestion(nodes, [], first.nextFingerprint);
  assert.equal(second.suggestion, null, 'already surfaced this exact fingerprint, so no repeat toast');
  assert.equal(second.nextFingerprint, first.nextFingerprint);
});

test('pickCrowdingSuggestion surfaces again once the affected set genuinely changes', () => {
  const nodes = [node('a', 0, 0), node('b', 5, 0), node('c', 500, 0), node('d', 505, 0)];
  const first = pickCrowdingSuggestion(nodes, [], 'a,b'); // pretend a/b were already shown/dismissed
  assert.ok(first.suggestion, 'a new pair (c/d) is now also crowded, so this is a genuinely different state');
  assert.ok(first.nextFingerprint.includes('c'));
});

test('pickCrowdingSuggestion also fires for a connector label that would not fit, even with no node overlap', () => {
  const nodes = [node('a', 0, 0), node('b', 120, 0)];
  const edges = [{ from: 'a', to: 'b', label: 'a fairly long label that needs more room than this gap' }];
  const { suggestion } = pickCrowdingSuggestion(nodes, edges, null);
  assert.ok(suggestion);
  assert.deepEqual(new Set(suggestion.affectedNodeIds), new Set(['a', 'b']));
});

test('pickCrowdingSuggestion resets once the diagram is no longer crowded, so the same state later is "new" again', () => {
  const crowded = [node('a', 0, 0), node('b', 5, 0)];
  const fixed = [node('a', 0, 0), node('b', 500, 0)];
  const shown = pickCrowdingSuggestion(crowded, [], null);
  const afterFix = pickCrowdingSuggestion(fixed, [], shown.nextFingerprint);
  assert.equal(afterFix.nextFingerprint, null);
  const recrowded = pickCrowdingSuggestion(crowded, [], afterFix.nextFingerprint);
  assert.ok(recrowded.suggestion, 'the same crowding reappearing after being resolved counts as new again');
});
