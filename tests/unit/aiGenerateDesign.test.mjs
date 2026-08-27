import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerateDesignPrompt, buildImportFromImagePrompt, buildQuickStartPrompt, extractProjectJSON, autoArrangeIfNeeded } from '../../js/io/aiGenerateDesign.js';

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

test('buildImportFromImagePrompt includes a valid few-shot JSON example and asks the AI to read the attached image', () => {
  const prompt = buildImportFromImagePrompt();
  assert.match(prompt, /attached image/);
  assert.match(prompt, /```json/);
  const fenced = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(fenced, 'prompt should contain a fenced JSON example');
  assert.doesNotThrow(() => JSON.parse(fenced[1]), 'the few-shot example itself must be valid JSON');
  assert.doesNotThrow(() => buildImportFromImagePrompt());
});

test('buildImportFromImagePrompt shares the same shape/routing rules as buildGenerateDesignPrompt, without a spec-text block', () => {
  const importPrompt = buildImportFromImagePrompt();
  const designPrompt = buildGenerateDesignPrompt({ specText: 'anything' });
  assert.match(importPrompt, /"shape" must be one of:/);
  assert.match(designPrompt, /"shape" must be one of:/);
  assert.doesNotMatch(importPrompt, /SPEC START/, 'image import has no spec text to fold in');
});

test('buildQuickStartPrompt includes the plain-language description and a valid few-shot JSON example with a rationale', () => {
  const prompt = buildQuickStartPrompt({ description: 'A blog where readers can leave comments.' });
  assert.match(prompt, /A blog where readers can leave comments\./);
  assert.match(prompt, /```json/);
  const fenced = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(fenced, 'prompt should contain a fenced JSON example');
  const example = JSON.parse(fenced[1]);
  assert.doesNotThrow(() => JSON.parse(fenced[1]), 'the few-shot example itself must be valid JSON');
  assert.ok(example.rationale && typeof example.rationale.overview === 'string', 'example must model the required rationale.overview');
  assert.ok(Array.isArray(example.rationale.components) && example.rationale.components.length > 0, 'example must model rationale.components');
  for (const c of example.rationale.components) {
    assert.ok(example.nodes.some((n) => n.id === c.id), 'each rationale component id must reference a real example node');
    assert.equal(typeof c.why, 'string');
  }
});

test('buildQuickStartPrompt never throws when description is missing, and shares the same shape/routing rules', () => {
  assert.doesNotThrow(() => buildQuickStartPrompt());
  assert.doesNotThrow(() => buildQuickStartPrompt({}));
  const prompt = buildQuickStartPrompt({});
  assert.match(prompt, /"shape" must be one of:/);
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

test('autoArrangeIfNeeded skips the grid safety net entirely for a sequence diagram (lifeline nodes), even when stacked', () => {
  const project = {
    nodes: [
      { x: 0, y: 0, shape: 'lifeline', text: 'A' },
      { x: 0, y: 0, shape: 'lifeline', text: 'B' },
    ],
  };
  const result = autoArrangeIfNeeded(project);
  assert.deepEqual(result.nodes, project.nodes, 'left untouched rather than grid-scrambled');
});

test('buildGenerateDesignPrompt also includes a valid sequence-diagram (lifeline) few-shot example with its own rules', () => {
  const prompt = buildGenerateDesignPrompt({ specText: 'Show the login handshake step by step.' });
  assert.match(prompt, /sequence diagram/i);
  assert.match(prompt, /"shape":\s*"lifeline"/);
  const fencedBlocks = [...prompt.matchAll(/```json\s*([\s\S]*?)```/g)];
  assert.ok(fencedBlocks.length >= 2, 'should contain both the component-graph and the sequence-diagram examples');
  const sequenceExample = JSON.parse(fencedBlocks[1][1]);
  assert.ok(sequenceExample.nodes.every((n) => n.shape === 'lifeline'));
  // Every message must have a distinct fromOffset so it doesn't stack on
  // another one at the same point in time.
  const offsets = sequenceExample.edges.map((e) => e.fromOffset);
  assert.equal(new Set(offsets).size, offsets.length);
});
