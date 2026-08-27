import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDiffForPrompt, buildDiffExplainPrompt } from '../../js/io/aiDiffExplain.js';

const nodesById = new Map([
  ['n1', { id: 'n1', text: 'API Gateway' }],
  ['n2', { id: 'n2', text: 'Database' }],
]);

test('summarizeDiffForPrompt renders one bullet line per changed item', () => {
  const diff = {
    addedNodes: [{ text: 'Cache' }],
    removedNodes: [],
    changedNodes: [{ after: { text: 'API Gateway' }, changedFields: ['fill'] }],
    addedEdges: [{ from: 'n1', to: 'n2' }],
    removedEdges: [],
    changedEdges: [],
  };
  const summary = summarizeDiffForPrompt(diff, nodesById);
  assert.match(summary, /\+ added component: Cache/);
  assert.match(summary, /~ changed component "API Gateway": fill/);
  assert.match(summary, /\+ added connector: API Gateway → Database/);
});

test('buildDiffExplainPrompt embeds both labels and asks for a short plain-language explanation', () => {
  const emptyDiff = { addedNodes: [], removedNodes: [], changedNodes: [], addedEdges: [], removedEdges: [], changedEdges: [] };
  const prompt = buildDiffExplainPrompt({ diff: emptyDiff, leftLabel: 'v1', rightLabel: 'v2', allNodesById: nodesById });
  assert.match(prompt, /"v1"/);
  assert.match(prompt, /"v2"/);
  assert.match(prompt, /plain-language/);
  assert.match(prompt, /\(no changes\)/);
});
