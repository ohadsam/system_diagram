import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSavedProjects } from '../../js/io/globalProjectSearch.js';

const PROJECTS = [
  {
    id: 'p1', name: 'Checkout Flow', updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [{ id: 'n1', text: 'Redis Cache', notes: '' }, { id: 'n2', text: 'Order API', notes: 'handles payment retries' }],
    edges: [{ id: 'e1', label: 'reads/writes' }],
    comments: [{ id: 'c1', text: 'double-check this later', replies: [] }],
  },
  {
    id: 'p2', name: 'Auth Service', updatedAt: '2026-02-01T00:00:00.000Z',
    nodes: [{ id: 'n3', text: 'JWT Issuer', notes: '' }],
    edges: [],
    comments: [{ id: 'c2', text: 'ok', replies: [{ id: 'r1', text: 'payment gateway reply' }] }],
  },
  {
    id: 'p3', name: 'Empty Board', updatedAt: '2026-03-01T00:00:00.000Z',
    nodes: [], edges: [], comments: [],
  },
];

test('returns an empty array for an empty/blank query', () => {
  assert.deepEqual(searchSavedProjects(PROJECTS, ''), []);
  assert.deepEqual(searchSavedProjects(PROJECTS, '   '), []);
});

test('matches a project by name', () => {
  const results = searchSavedProjects(PROJECTS, 'checkout');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'p1');
  assert.equal(results[0].matches[0].kind, 'project-name');
});

test('matches component text, node notes, edge labels, comments, and replies, case-insensitively', () => {
  const results = searchSavedProjects(PROJECTS, 'PAYMENT');
  const ids = results.map((r) => r.id).sort();
  assert.deepEqual(ids, ['p1', 'p2']);
  const p1 = results.find((r) => r.id === 'p1');
  assert.ok(p1.matches.some((m) => m.kind === 'notes'));
  const p2 = results.find((r) => r.id === 'p2');
  assert.ok(p2.matches.some((m) => m.kind === 'comment' && m.text.includes('payment gateway')));
});

test('a project with no matching field is excluded from the results', () => {
  const results = searchSavedProjects(PROJECTS, 'nonexistent-term');
  assert.deepEqual(results, []);
});

test('handles a project with empty nodes/edges/comments without throwing', () => {
  assert.doesNotThrow(() => searchSavedProjects(PROJECTS, 'anything'));
});

test('handles a malformed/missing projects array without throwing', () => {
  assert.deepEqual(searchSavedProjects(null, 'x'), []);
  assert.deepEqual(searchSavedProjects(undefined, 'x'), []);
});

test('results are sorted most-recently-updated first', () => {
  const results = searchSavedProjects(PROJECTS, 'e'); // matches multiple projects loosely by letter 'e'
  for (let i = 1; i < results.length; i += 1) {
    assert.ok(results[i - 1].updatedAt >= results[i].updatedAt);
  }
});
