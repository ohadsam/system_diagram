import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLayoutBeautifyPrompt, sanitizeLayoutPatch } from '../../js/io/aiLayoutSuggest.js';

const project = {
  nodes: [
    { id: 'n1', x: 0, y: 0, w: 160, h: 84, text: 'API' },
    { id: 'n2', x: 300, y: 0, w: 160, h: 84, text: 'DB' },
  ],
  edges: [{ from: 'n1', to: 'n2' }],
};

test('buildLayoutBeautifyPrompt includes every node id and forbids adding/removing', () => {
  const prompt = buildLayoutBeautifyPrompt({ project });
  assert.match(prompt, /"n1"/);
  assert.match(prompt, /"n2"/);
  assert.match(prompt, /repositions/);
  assert.match(prompt, /Do NOT add, remove, resize, or rename/);
});

test('sanitizeLayoutPatch keeps only entries with a real id and finite coordinates', () => {
  const raw = {
    repositions: [
      { id: 'n1', x: 100, y: 200 },
      { id: 'n2', x: 'nope', y: 50 }, // non-finite x
      { id: 'unknown-id', x: 10, y: 10 }, // not in project
      { id: 'n1', x: 999, y: 999 }, // duplicate id, first wins
      null,
    ],
  };
  const result = sanitizeLayoutPatch(raw, project);
  assert.deepEqual(result, [{ id: 'n1', x: 100, y: 200 }]);
});

test('sanitizeLayoutPatch returns an empty array for malformed input, never throws', () => {
  assert.deepEqual(sanitizeLayoutPatch(null, project), []);
  assert.deepEqual(sanitizeLayoutPatch({}, project), []);
  assert.deepEqual(sanitizeLayoutPatch({ repositions: 'not an array' }, project), []);
});
