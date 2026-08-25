import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeHistoryStep } from '../../js/core/historyLabels.js';

const empty = { nodes: [], edges: [] };

test('describeHistoryStep: no changes', () => {
  assert.equal(describeHistoryStep(empty, empty), 'No changes');
});

test('describeHistoryStep: adding one named component names it', () => {
  const next = { nodes: [{ id: 'n1', text: 'API Gateway', x: 0, y: 0 }], edges: [] };
  assert.equal(describeHistoryStep(empty, next), 'Added "API Gateway"');
});

test('describeHistoryStep: adding several components is summarized by count', () => {
  const next = { nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 0, y: 0 }], edges: [] };
  assert.equal(describeHistoryStep(empty, next), 'Added 2 components');
});

test('describeHistoryStep: deleting components', () => {
  const prev = { nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [] };
  assert.equal(describeHistoryStep(prev, empty), 'Deleted 1 component');
});

test('describeHistoryStep: only position changed is described as a move', () => {
  const prev = { nodes: [{ id: 'n1', x: 0, y: 0, w: 100, h: 50 }], edges: [] };
  const next = { nodes: [{ id: 'n1', x: 50, y: 0, w: 100, h: 50 }], edges: [] };
  assert.equal(describeHistoryStep(prev, next), 'Moved 1 component');
});

test('describeHistoryStep: only size changed is described as a resize', () => {
  const prev = { nodes: [{ id: 'n1', x: 0, y: 0, w: 100, h: 50 }], edges: [] };
  const next = { nodes: [{ id: 'n1', x: 0, y: 0, w: 160, h: 50 }], edges: [] };
  assert.equal(describeHistoryStep(prev, next), 'Resized 1 component');
});

test('describeHistoryStep: a mix of field changes falls back to a generic "Edited"', () => {
  const prev = { nodes: [{ id: 'n1', x: 0, y: 0, text: 'A' }], edges: [] };
  const next = { nodes: [{ id: 'n1', x: 50, y: 0, text: 'B' }], edges: [] };
  assert.equal(describeHistoryStep(prev, next), 'Edited 1 component');
});

test('describeHistoryStep: connector add/remove/edit', () => {
  const noEdge = { nodes: [], edges: [] };
  const withEdge = { nodes: [], edges: [{ id: 'e1', from: 'a', to: 'b', color: '#000' }] };
  assert.equal(describeHistoryStep(noEdge, withEdge), 'Added 1 connector');
  assert.equal(describeHistoryStep(withEdge, noEdge), 'Deleted 1 connector');
  const changedEdge = { nodes: [], edges: [{ id: 'e1', from: 'a', to: 'b', color: '#fff' }] };
  assert.equal(describeHistoryStep(withEdge, changedEdge), 'Edited 1 connector');
});

test('describeHistoryStep: multiple simultaneous kinds of change join together', () => {
  const prev = { nodes: [], edges: [] };
  const next = { nodes: [{ id: 'n1', x: 0, y: 0, text: 'X' }], edges: [{ id: 'e1', from: 'a', to: 'b' }] };
  assert.equal(describeHistoryStep(prev, next), 'Added "X", Added 1 connector');
});
