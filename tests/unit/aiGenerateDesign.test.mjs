import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerateDesignPrompt, extractProjectJSON, autoArrangeIfNeeded } from '../../js/io/aiGenerateDesign.js';

test('buildGenerateDesignPrompt includes the spec text and a valid few-shot JSON example', () => {
  const prompt = buildGenerateDesignPrompt({ specText: 'Must support 10k concurrent users.' });
  assert.match(prompt, /10k concurrent users/);
  assert.match(prompt, /```json/);
  const fenced = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(fenced, 'prompt should contain a fenced JSON example');
  assert.doesNotThrow(() => JSON.parse(fenced[1]), 'the few-shot example itself must be valid JSON');
});

test('buildGenerateDesignPrompt never throws when specText is missing', () => {
  assert.doesNotThrow(() => buildGenerateDesignPrompt());
  assert.doesNotThrow(() => buildGenerateDesignPrompt({}));
});

test('extractProjectJSON parses a raw JSON string directly', () => {
  const result = extractProjectJSON('{"name":"X","nodes":[],"edges":[]}');
  assert.equal(result.ok, true);
  assert.equal(result.data.name, 'X');
});

test('extractProjectJSON pulls JSON out of a fenced code block surrounded by prose', () => {
  const text = 'Sure, here is the design:\n\n```json\n{"name":"Y","nodes":[],"edges":[]}\n```\n\nLet me know what you think!';
  const result = extractProjectJSON(text);
  assert.equal(result.ok, true);
  assert.equal(result.data.name, 'Y');
});

test('extractProjectJSON falls back to the first-{-to-last-} substring when there is no fence', () => {
  const text = 'Here is the design: {"name":"Z","nodes":[],"edges":[]} — hope that helps!';
  const result = extractProjectJSON(text);
  assert.equal(result.ok, true);
  assert.equal(result.data.name, 'Z');
});

test('extractProjectJSON fails gracefully (never throws) on unusable text', () => {
  assert.equal(extractProjectJSON('').ok, false);
  assert.equal(extractProjectJSON('   ').ok, false);
  assert.equal(extractProjectJSON('no json anywhere in here').ok, false);
  assert.equal(extractProjectJSON('[1, 2, 3]').ok, false, 'a bare array is not a project object');
  assert.doesNotThrow(() => extractProjectJSON(undefined));
});

test('autoArrangeIfNeeded leaves already-distinct positions untouched', () => {
  const project = { nodes: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 200 }] };
  const result = autoArrangeIfNeeded(project);
  assert.deepEqual(result.nodes, project.nodes);
});

test('autoArrangeIfNeeded re-lays-out nodes that are all stacked at the same position', () => {
  const project = { nodes: [{ x: 0, y: 0, text: 'A' }, { x: 0, y: 0, text: 'B' }, { x: 0, y: 0, text: 'C' }] };
  const result = autoArrangeIfNeeded(project);
  const positions = result.nodes.map((n) => `${n.x},${n.y}`);
  assert.equal(new Set(positions).size, 3, 'every node should end up at a distinct position');
  assert.equal(result.nodes[0].text, 'A', 'node order/content is preserved, only x/y change');
});

test('autoArrangeIfNeeded does not crash on an empty or single-node project', () => {
  assert.doesNotThrow(() => autoArrangeIfNeeded({ nodes: [] }));
  assert.doesNotThrow(() => autoArrangeIfNeeded({ nodes: [{ x: 0, y: 0 }] }));
});
