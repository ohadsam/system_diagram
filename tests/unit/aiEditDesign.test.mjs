import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEditPrompt, extractPatchJSON, normalizePatch, summarizePatch, sanitizeAddNode, sanitizeAddEdge, sanitizeNodeUpdateFields, sanitizeEdgeUpdateFields } from '../../js/io/aiEditDesign.js';

const project = {
  name: 'Test',
  nodes: [
    { id: 'n1', text: 'Client' },
    { id: 'n2', text: 'Server' },
  ],
  edges: [{ id: 'e1', from: 'n1', to: 'n2', label: 'call' }],
};

test('buildEditPrompt embeds the instruction and the current diagram as JSON', () => {
  const prompt = buildEditPrompt({ project, instruction: 'add a cache' });
  assert.ok(prompt.includes('add a cache'));
  assert.ok(prompt.includes('"Client"'));
  assert.ok(prompt.includes('"Server"'));
  assert.ok(prompt.includes('addNodes'));
});

test('buildEditPrompt falls back to a default note when no instruction is given', () => {
  const prompt = buildEditPrompt({ project, instruction: '' });
  assert.ok(prompt.includes('no instruction given'));
});

test('extractPatchJSON pulls a fenced JSON block out of surrounding text', () => {
  const reply = 'Sure, here you go:\n```json\n{"addNodes": [{"id": "n3"}]}\n```\nLet me know!';
  const result = extractPatchJSON(reply);
  assert.equal(result.ok, true);
  assert.equal(result.data.addNodes[0].id, 'n3');
});

test('extractPatchJSON reports an error for unparseable text', () => {
  const result = extractPatchJSON('not json at all');
  assert.equal(result.ok, false);
});

test('normalizePatch fills in every key and drops non-object entries', () => {
  const patch = normalizePatch({ addNodes: [{ id: 'n3' }, null, 'garbage'], removeNodeIds: ['n1', 42, null] });
  assert.equal(patch.addNodes.length, 1);
  assert.deepEqual(patch.removeNodeIds, ['n1']);
  assert.deepEqual(patch.addEdges, []);
  assert.deepEqual(patch.updateNodes, []);
  assert.deepEqual(patch.updateEdges, []);
  assert.deepEqual(patch.removeEdgeIds, []);
});

test('normalizePatch returns null for a non-object input', () => {
  assert.equal(normalizePatch(null), null);
  assert.equal(normalizePatch('nope'), null);
});

test('normalizePatch drops updateNodes/updateEdges entries missing a string id', () => {
  const patch = normalizePatch({ updateNodes: [{ text: 'no id' }, { id: 'n1', text: 'ok' }], updateEdges: [{ id: 123 }] });
  assert.equal(patch.updateNodes.length, 1);
  assert.equal(patch.updateNodes[0].id, 'n1');
  assert.equal(patch.updateEdges.length, 0);
});

test('sanitizeAddNode only carries over individually-valid fields', () => {
  const overrides = sanitizeAddNode({ id: 'new1', x: 100, y: 'nope', shape: 'cylinder', shapeless: true, text: 'Cache', icon: '⚡', fill: '#fff' });
  assert.equal(overrides.id, 'new1');
  assert.equal(overrides.x, 100);
  assert.equal('y' in overrides, false);
  assert.equal(overrides.shape, 'cylinder');
  assert.equal(overrides.text, 'Cache');
});

test('sanitizeAddNode returns null for a non-object', () => {
  assert.equal(sanitizeAddNode(null), null);
});

test('sanitizeAddEdge requires from/to and drops an invalid routing', () => {
  assert.equal(sanitizeAddEdge({ label: 'x' }), null);
  const overrides = sanitizeAddEdge({ from: 'n1', to: 'n2', routing: 'not-a-real-routing', label: 'reads' });
  assert.equal(overrides.from, 'n1');
  assert.equal(overrides.to, 'n2');
  assert.equal('routing' in overrides, false);
  assert.equal(overrides.label, 'reads');
});

test('sanitizeNodeUpdateFields never lets a patch rename an id or reposition via update', () => {
  const fields = sanitizeNodeUpdateFields({ id: 'n1', x: 999, y: 999, text: 'Renamed' });
  assert.equal('id' in fields, false);
  assert.equal('x' in fields, false);
  assert.equal('y' in fields, false);
  assert.equal(fields.text, 'Renamed');
});

test('sanitizeEdgeUpdateFields allows from/to as optional, unlike sanitizeAddEdge', () => {
  const fields = sanitizeEdgeUpdateFields({ label: 'renamed' });
  assert.deepEqual(fields, { label: 'renamed' });
});

test('summarizePatch describes additions, updates, and removals in readable form', () => {
  const patch = normalizePatch({
    addNodes: [{ id: 'new1', text: 'Cache' }],
    addEdges: [{ id: 'newe1', from: 'n1', to: 'new1', label: 'reads' }],
    updateNodes: [{ id: 'n2', text: 'Server v2' }],
    removeEdgeIds: ['e1'],
  });
  const summary = summarizePatch(patch, project);
  assert.equal(summary.isEmpty, false);
  assert.equal(summary.toAdd.length, 2);
  assert.equal(summary.toUpdate.length, 1);
  assert.equal(summary.toRemove.length, 1);
  assert.ok(summary.toAdd.every((r) => r.type === 'add'));
  assert.equal(summary.toUpdate[0].type, 'update');
  assert.equal(summary.toRemove[0].type, 'remove');
  assert.ok(summary.toAdd[1].text.includes('Client'));
  assert.ok(summary.toAdd[1].text.includes('Cache'));
});

test('summarizePatch warns on and excludes an addEdges entry referencing an unknown id', () => {
  const patch = normalizePatch({ addEdges: [{ id: 'newe1', from: 'n1', to: 'does-not-exist' }] });
  const summary = summarizePatch(patch, project);
  assert.equal(summary.toAdd.length, 0);
  assert.equal(summary.warnings.length, 1);
});

test('summarizePatch skips a removeNodeIds/removeEdgeIds id that does not exist, without warning-free silence being mistaken for success', () => {
  const patch = normalizePatch({ removeNodeIds: ['ghost'] });
  const summary = summarizePatch(patch, project);
  assert.equal(summary.toRemove.length, 0);
  assert.equal(summary.warnings.length, 1);
  assert.equal(summary.isEmpty, true);
});

test('summarizePatch reports isEmpty for a patch with nothing recognizable', () => {
  const patch = normalizePatch({});
  const summary = summarizePatch(patch, project);
  assert.equal(summary.isEmpty, true);
});
