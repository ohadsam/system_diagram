import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createEdge } from '../../js/core/project.js';
import { computeDiagramDiff, isDiagramDiffEmpty } from '../../js/core/diagramDiff.js';

test('computeDiagramDiff reports no differences for identical content', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const b = createNode(null, 200, 0, { text: 'B' });
  const edge = createEdge(a.id, b.id, {});
  const content = { nodes: [a, b], edges: [edge] };

  const diff = computeDiagramDiff(content, content);
  assert.ok(isDiagramDiffEmpty(diff));
});

test('computeDiagramDiff detects an added node', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const b = createNode(null, 200, 0, { text: 'B' });
  const oldContent = { nodes: [a], edges: [] };
  const newContent = { nodes: [a, b], edges: [] };

  const diff = computeDiagramDiff(oldContent, newContent);
  assert.equal(diff.addedNodes.length, 1);
  assert.equal(diff.addedNodes[0].id, b.id);
  assert.equal(diff.removedNodes.length, 0);
  assert.equal(diff.changedNodes.length, 0);
});

test('computeDiagramDiff detects a removed node and its edge disappearing too', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const b = createNode(null, 200, 0, { text: 'B' });
  const edge = createEdge(a.id, b.id, {});
  const oldContent = { nodes: [a, b], edges: [edge] };
  const newContent = { nodes: [a], edges: [] };

  const diff = computeDiagramDiff(oldContent, newContent);
  assert.equal(diff.removedNodes.length, 1);
  assert.equal(diff.removedNodes[0].id, b.id);
  assert.equal(diff.removedEdges.length, 1);
  assert.equal(diff.removedEdges[0].id, edge.id);
});

test('computeDiagramDiff detects a changed field on a node with the same id, naming which field changed', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const oldContent = { nodes: [a], edges: [] };
  const movedAndRenamed = { ...a, x: 500, text: 'Renamed' };
  const newContent = { nodes: [movedAndRenamed], edges: [] };

  const diff = computeDiagramDiff(oldContent, newContent);
  assert.equal(diff.changedNodes.length, 1);
  const change = diff.changedNodes[0];
  assert.equal(change.id, a.id);
  assert.ok(change.changedFields.includes('x'));
  assert.ok(change.changedFields.includes('text'));
  assert.equal(change.before.text, 'A');
  assert.equal(change.after.text, 'Renamed');
});

test('computeDiagramDiff ignores a field not in its comparable-field allowlist (e.g. zIndex)', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const oldContent = { nodes: [a], edges: [] };
  const restacked = { ...a, zIndex: a.zIndex + 5 };
  const newContent = { nodes: [restacked], edges: [] };

  const diff = computeDiagramDiff(oldContent, newContent);
  assert.equal(diff.changedNodes.length, 0, 'zIndex churn alone should not surface as a meaningful diagram change');
});

test('computeDiagramDiff detects a changed edge field', () => {
  const a = createNode(null, 0, 0, {});
  const b = createNode(null, 200, 0, {});
  const edge = createEdge(a.id, b.id, { label: 'call' });
  const oldContent = { nodes: [a, b], edges: [edge] };
  const relabeled = { ...edge, label: 'response' };
  const newContent = { nodes: [a, b], edges: [relabeled] };

  const diff = computeDiagramDiff(oldContent, newContent);
  assert.equal(diff.changedEdges.length, 1);
  assert.deepEqual(diff.changedEdges[0].changedFields, ['label']);
});

test('isDiagramDiffEmpty is true only when every bucket is empty', () => {
  const empty = { addedNodes: [], removedNodes: [], changedNodes: [], addedEdges: [], removedEdges: [], changedEdges: [] };
  assert.ok(isDiagramDiffEmpty(empty));
  assert.ok(!isDiagramDiffEmpty({ ...empty, addedNodes: [{}] }));
});
