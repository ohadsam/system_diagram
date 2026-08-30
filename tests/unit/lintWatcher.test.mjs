import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNewFinding } from '../../js/io/lintWatcher.js';

test('pickNewFinding returns the finding not present in the previously-seen set', () => {
  const findings = [{ id: 'orphan-1' }, { id: 'orphan-2' }];
  const { freshFinding, nextSeenIds } = pickNewFinding(findings, new Set(['orphan-1']));
  assert.equal(freshFinding.id, 'orphan-2');
  assert.deepEqual([...nextSeenIds].sort(), ['orphan-1', 'orphan-2']);
});

test('pickNewFinding returns null once every current finding has already been seen', () => {
  const findings = [{ id: 'orphan-1' }];
  const { freshFinding } = pickNewFinding(findings, new Set(['orphan-1']));
  assert.equal(freshFinding, null);
});

test('pickNewFinding returns null for an empty findings list, and an empty next-seen set', () => {
  const { freshFinding, nextSeenIds } = pickNewFinding([], new Set(['stale-id']));
  assert.equal(freshFinding, null);
  assert.equal(nextSeenIds.size, 0);
});

test('pickNewFinding treats a first-ever call (empty seen set) as everything being new', () => {
  const findings = [{ id: 'a' }, { id: 'b' }];
  const { freshFinding } = pickNewFinding(findings, new Set());
  assert.equal(freshFinding.id, 'a');
});
