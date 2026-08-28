import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyProject, validateProject, duplicateProject, REVIEW_STATUSES } from '../../js/core/project.js';

test('createEmptyProject starts as a draft with no reviewer set', () => {
  const project = createEmptyProject();
  assert.equal(project.reviewStatus, 'draft');
  assert.equal(project.reviewedBy, '');
  assert.equal(project.reviewedAt, null);
});

test('REVIEW_STATUSES lists exactly draft/in-review/approved', () => {
  assert.deepEqual(REVIEW_STATUSES, ['draft', 'in-review', 'approved']);
});

test('validateProject keeps a valid reviewStatus and reviewer info', () => {
  const result = validateProject({ nodes: [], edges: [], reviewStatus: 'approved', reviewedBy: 'Alice', reviewedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(result.ok, true);
  assert.equal(result.project.reviewStatus, 'approved');
  assert.equal(result.project.reviewedBy, 'Alice');
  assert.equal(result.project.reviewedAt, '2026-01-01T00:00:00.000Z');
});

test('validateProject falls back to draft for a missing/invalid reviewStatus', () => {
  assert.equal(validateProject({ nodes: [], edges: [] }).project.reviewStatus, 'draft');
  assert.equal(validateProject({ nodes: [], edges: [], reviewStatus: 'bogus' }).project.reviewStatus, 'draft');
});

test('validateProject defaults reviewedBy to empty string and reviewedAt to null when missing', () => {
  const result = validateProject({ nodes: [], edges: [] });
  assert.equal(result.project.reviewedBy, '');
  assert.equal(result.project.reviewedAt, null);
});

test('duplicateProject resets review status to draft rather than carrying over an approval nobody gave the copy', () => {
  const original = { ...createEmptyProject('Approved Diagram'), reviewStatus: 'approved', reviewedBy: 'Alice', reviewedAt: '2026-01-01T00:00:00.000Z' };
  const copy = duplicateProject(original);
  assert.equal(copy.reviewStatus, 'draft');
  assert.equal(copy.reviewedBy, '');
  assert.equal(copy.reviewedAt, null);
  // The original itself is untouched by duplicating it.
  assert.equal(original.reviewStatus, 'approved');
});
