import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countMatches, applyReplace } from '../../js/core/findReplace.js';

const nodes = [
  { id: 'n1', text: 'API Gateway', notes: 'Handles routing for the API Gateway layer.' },
  { id: 'n2', text: 'Auth Service', notes: '' },
  { id: 'n3', text: 'api gateway (legacy)', notes: '' },
];
const edges = [
  { id: 'e1', label: 'calls API Gateway', notes: '' },
  { id: 'e2', label: 'authenticates', notes: 'goes through API Gateway first' },
];

test('countMatches finds every label/notes field containing the term, case-insensitive by default', () => {
  assert.equal(countMatches(nodes, edges, { find: 'API Gateway' }), 5);
});

test('countMatches respects matchCase, excluding a differently-cased match', () => {
  assert.equal(countMatches(nodes, edges, { find: 'API Gateway', matchCase: true }), 4);
});

test('countMatches with includeNotes:false only scans labels', () => {
  assert.equal(countMatches(nodes, edges, { find: 'API Gateway', includeNotes: false }), 3);
});

test('countMatches returns 0 for an empty search term', () => {
  assert.equal(countMatches(nodes, edges, { find: '' }), 0);
});

test('applyReplace replaces every occurrence and reports only the changed fields', () => {
  const { nodeUpdates, edgeUpdates } = applyReplace(nodes, edges, { find: 'API Gateway', replaceWith: 'Edge Gateway' });
  assert.equal(nodeUpdates.length, 2); // n1 (text+notes) and n3 (case-insensitive text)
  const n1 = nodeUpdates.find((u) => u.id === 'n1');
  assert.equal(n1.text, 'Edge Gateway');
  assert.equal(n1.notes, 'Handles routing for the Edge Gateway layer.');
  const n3 = nodeUpdates.find((u) => u.id === 'n3');
  assert.equal(n3.text, 'Edge Gateway (legacy)');
  assert.equal(n3.notes, undefined, 'n3 had no notes to touch');

  assert.equal(edgeUpdates.length, 2);
  assert.equal(edgeUpdates.find((u) => u.id === 'e1').label, 'calls Edge Gateway');
  assert.equal(edgeUpdates.find((u) => u.id === 'e2').notes, 'goes through Edge Gateway first');
});

test('applyReplace with matchCase leaves a differently-cased occurrence untouched', () => {
  const { nodeUpdates } = applyReplace(nodes, edges, { find: 'API Gateway', replaceWith: 'Edge Gateway', matchCase: true });
  assert.equal(nodeUpdates.find((u) => u.id === 'n3'), undefined);
});

test('applyReplace returns empty updates for an empty search term', () => {
  assert.deepEqual(applyReplace(nodes, edges, { find: '', replaceWith: 'x' }), { nodeUpdates: [], edgeUpdates: [] });
});

test('applyReplace treats the search term as a literal string, not a regex', () => {
  const withSpecialChars = [{ id: 'n1', text: 'Cost: $5.00 (est.)', notes: '' }];
  const { nodeUpdates } = applyReplace(withSpecialChars, [], { find: '$5.00', replaceWith: '$10.00' });
  assert.equal(nodeUpdates[0].text, 'Cost: $10.00 (est.)');
});
