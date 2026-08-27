import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBranchName, listBranches, versionsOnBranch, copyVersionToBranch, DEFAULT_BRANCH } from '../../js/core/versionBranches.js';

test('normalizeBranchName falls back to "main" for blank/missing input', () => {
  assert.equal(normalizeBranchName(''), 'main');
  assert.equal(normalizeBranchName('   '), 'main');
  assert.equal(normalizeBranchName(undefined), 'main');
  assert.equal(normalizeBranchName('  feature-x  '.trim()), 'feature-x');
});

test('listBranches always includes "main" first, then every other branch sorted', () => {
  const versions = [{ branch: 'zeta' }, { branch: 'main' }, { branch: 'alpha' }];
  assert.deepEqual(listBranches(versions), ['main', 'alpha', 'zeta']);
  assert.deepEqual(listBranches([]), ['main'], 'main is always a valid branch, even with no versions on it yet');
});

test('versionsOnBranch filters by branch, defaulting missing/undefined branch to main', () => {
  const versions = [
    { id: 'v1', branch: 'main' },
    { id: 'v2' }, // no branch field — treated as main
    { id: 'v3', branch: 'feature-x' },
  ];
  assert.deepEqual(versionsOnBranch(versions, 'main').map((v) => v.id), ['v1', 'v2']);
  assert.deepEqual(versionsOnBranch(versions, 'feature-x').map((v) => v.id), ['v3']);
  assert.deepEqual(versionsOnBranch(versions, 'nonexistent'), []);
});

test('copyVersionToBranch clones the snapshot, assigns a fresh id, and never mutates the source', () => {
  const source = { id: 'ver_1', name: 'v1', branch: DEFAULT_BRANCH, snapshot: { nodes: [{ id: 'n1' }], edges: [] } };
  const copy = copyVersionToBranch(source, 'experiment');
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.branch, 'experiment');
  assert.deepEqual(copy.snapshot, source.snapshot);
  assert.notEqual(copy.snapshot, source.snapshot, 'snapshot must be a deep clone, not the same reference');
  copy.snapshot.nodes[0].id = 'changed';
  assert.equal(source.snapshot.nodes[0].id, 'n1', 'mutating the copy must not affect the source');
});

test('copyVersionToBranch names the copy after the source and target branch by default', () => {
  const source = { id: 'ver_1', name: 'My Version', snapshot: { nodes: [], edges: [] } };
  const copy = copyVersionToBranch(source, 'main');
  assert.equal(copy.name, 'My Version (main)');
  const named = copyVersionToBranch(source, 'main', 'Custom Name');
  assert.equal(named.name, 'Custom Name');
});
