import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupExplanation } from '../../js/core/groupExplanation.js';

function resolveDef(defId) {
  const defs = {
    client: { name: 'Client', description: 'Initiates the request.' },
    server: { name: 'Server', description: 'Handles the request.' },
  };
  return defs[defId] || null;
}

test('buildGroupExplanation falls back to a generic title/description when patternDef is null', () => {
  const nodes = [{ id: 'a', shape: 'rect', text: 'Client', defId: 'client' }];
  const result = buildGroupExplanation(nodes, [], resolveDef, null);
  assert.equal(result.title, 'Component group');
  assert.equal(result.headerDescription, '');
  assert.equal(result.isSequenceDiagram, false);
});

test('buildGroupExplanation uses the pattern def name/description when available', () => {
  const nodes = [{ id: 'a', shape: 'rect', text: 'Client', defId: 'client' }];
  const patternDef = { name: 'PKCE Flow', description: 'OAuth PKCE authorization flow.' };
  const result = buildGroupExplanation(nodes, [], resolveDef, patternDef);
  assert.equal(result.title, 'PKCE Flow');
  assert.equal(result.headerDescription, 'OAuth PKCE authorization flow.');
});

test('buildGroupExplanation lists each node as a component with its resolved description', () => {
  const nodes = [
    { id: 'a', shape: 'rect', text: 'Client', defId: 'client' },
    { id: 'b', shape: 'rect', text: 'Server', defId: 'server' },
  ];
  const result = buildGroupExplanation(nodes, [], resolveDef, null);
  assert.deepEqual(result.components, [
    { name: 'Client', description: 'Initiates the request.' },
    { name: 'Server', description: 'Handles the request.' },
  ]);
});

test('buildGroupExplanation handles a node with no defId or unresolvable defId gracefully', () => {
  const nodes = [{ id: 'a', shape: 'rect', text: 'Mystery' }];
  const result = buildGroupExplanation(nodes, [], resolveDef, null);
  assert.deepEqual(result.components, [{ name: 'Mystery', description: '' }]);
});

test('buildGroupExplanation falls back to shape or "Unnamed component" when a node has no text', () => {
  const nodes = [{ id: 'a', shape: 'rect' }, { id: 'b' }];
  const result = buildGroupExplanation(nodes, [], resolveDef, null);
  assert.equal(result.components[0].name, 'rect');
  assert.equal(result.components[1].name, 'Unnamed component');
});

test('buildGroupExplanation builds plain connection lines for a regular (non-sequence) diagram', () => {
  const nodes = [
    { id: 'a', shape: 'rect', text: 'Client' },
    { id: 'b', shape: 'rect', text: 'Server' },
  ];
  const edges = [{ from: 'a', to: 'b', label: 'request' }];
  const result = buildGroupExplanation(nodes, edges, resolveDef, null);
  assert.equal(result.isSequenceDiagram, false);
  assert.deepEqual(result.flowLines, ['Client → Server ("request")']);
});

test('buildGroupExplanation detects a sequence diagram (all lifeline nodes) and numbers messages in vertical order', () => {
  const nodes = [
    { id: 'a', shape: 'lifeline', text: 'Client', x: 0, y: 0, w: 140, h: 640 },
    { id: 'b', shape: 'lifeline', text: 'Server', x: 300, y: 0, w: 140, h: 640 },
  ];
  const edges = [
    { id: 'e1', from: 'a', to: 'b', label: 'response', fromSide: 'right', fromOffset: 0.8 },
    { id: 'e2', from: 'a', to: 'b', label: 'request', fromSide: 'right', fromOffset: 0.2 },
  ];
  const result = buildGroupExplanation(nodes, edges, resolveDef, null);
  assert.equal(result.isSequenceDiagram, true);
  assert.deepEqual(result.flowLines, [
    '1. Client → Server — request',
    '2. Client → Server — response',
  ]);
});

test('buildGroupExplanation returns an empty flowLines array when there are no edges', () => {
  const nodes = [{ id: 'a', shape: 'rect', text: 'Solo' }];
  const result = buildGroupExplanation(nodes, [], resolveDef, null);
  assert.deepEqual(result.flowLines, []);
});
