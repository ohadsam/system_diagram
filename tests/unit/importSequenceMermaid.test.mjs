import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSequenceMermaid } from '../../js/io/importSequenceMermaid.js';
import { layoutImportedSequenceDiagram } from '../../js/core/sequenceDiagram.js';

const SIZE = { w: 140, h: 640 };

test('parseSequenceMermaid returns null for text with no participants/messages', () => {
  assert.equal(parseSequenceMermaid(''), null);
  assert.equal(parseSequenceMermaid('sequenceDiagram\n%% just a comment'), null);
});

test('parseSequenceMermaid reads explicit participant declarations and preserves order', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: hello`);
  assert.deepEqual(parsed.participants.map((p) => p.label), ['Client', 'Server']);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].kind, 'message');
});

test('parseSequenceMermaid auto-declares participants from message lines when there is no participant block', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    Client->>Server: GET /data
    Server-->>Client: 200 OK`);
  assert.deepEqual(parsed.participants.map((p) => p.label), ['Client', 'Server']);
  assert.equal(parsed.events.length, 2);
});

test('parseSequenceMermaid maps arrow tokens to sync/async/return styles', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    A->>B: sync
    A-)B: async
    B-->>A: reply`);
  const styles = parsed.events.map((e) => e.style);
  assert.deepEqual(styles, ['sync', 'async', 'return']);
});

test('parseSequenceMermaid reads activate/deactivate, destroy, and alt/opt/loop/par blocks', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    activate A
    A->>B: ping
    deactivate A
    destroy A
    alt happy path
    B->>A: ok
    end`);
  const kinds = parsed.events.map((e) => e.kind);
  assert.deepEqual(kinds, ['activate', 'message', 'deactivate', 'destroy', 'fragmentStart', 'message', 'fragmentEnd']);
  assert.equal(parsed.events[4].type, 'alt');
  assert.equal(parsed.events[4].label, 'happy path');
});

test('layoutImportedSequenceDiagram creates one lifeline per participant and one edge per message, all with distinct fromOffsets', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    Client->>Server: GET /data
    Server-->>Client: 200 OK`);
  const result = layoutImportedSequenceDiagram(parsed, 0, 0, SIZE);
  assert.equal(result.lifelines.length, 2);
  assert.equal(result.edges.length, 2);
  const offsets = result.edges.map((e) => e.overrides.fromOffset);
  assert.equal(new Set(offsets).size, offsets.length);
  for (const e of result.edges) assert.equal(e.overrides.routing, 'straight');
});

test('layoutImportedSequenceDiagram maps message style to the same dash/arrow presets the app\'s style editor uses', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    A->>B: sync
    A-)B: async
    B-->>A: reply`);
  const result = layoutImportedSequenceDiagram(parsed, 0, 0, SIZE);
  assert.equal(result.edges[0].overrides.dash, 'solid');
  assert.equal(result.edges[0].overrides.endArrow, 'filled');
  assert.equal(result.edges[1].overrides.dash, 'solid');
  assert.equal(result.edges[1].overrides.endArrow, 'open');
  assert.equal(result.edges[2].overrides.dash, 'dashed');
  assert.equal(result.edges[2].overrides.endArrow, 'open');
});

test('layoutImportedSequenceDiagram builds an activation bar from a matching activate/deactivate pair', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    activate A
    A->>B: ping
    deactivate A`);
  const result = layoutImportedSequenceDiagram(parsed, 0, 0, SIZE);
  const aIdx = parsed.participants.findIndex((p) => p.label === 'A');
  assert.equal(result.activations[aIdx].length, 1);
  const bar = result.activations[aIdx][0];
  assert.ok(bar.startOffset < bar.endOffset);
});

test('layoutImportedSequenceDiagram records a destroy offset for a destroyed participant', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    A->>B: ping
    destroy A`);
  const result = layoutImportedSequenceDiagram(parsed, 0, 0, SIZE);
  const aIdx = parsed.participants.findIndex((p) => p.label === 'A');
  const bIdx = parsed.participants.findIndex((p) => p.label === 'B');
  assert.ok(Number.isFinite(result.destroys[aIdx]));
  assert.equal(result.destroys[bIdx], null);
});

test('layoutImportedSequenceDiagram produces one fragment rect per alt/opt/loop/par block, spanning its enclosed participants', () => {
  const parsed = parseSequenceMermaid(`sequenceDiagram
    participant A
    participant B
    participant C
    alt happy path
    A->>B: ok
    end`);
  const result = layoutImportedSequenceDiagram(parsed, 0, 0, SIZE);
  assert.equal(result.fragments.length, 1);
  const frag = result.fragments[0];
  assert.equal(frag.type, 'alt');
  assert.equal(frag.label, 'happy path');
  const aX = result.lifelines[0].x;
  const bX = result.lifelines[1].x;
  const cX = result.lifelines[2].x;
  // The fragment only enclosed A and B's message — its box should not
  // stretch out to cover C, which was never touched inside it.
  assert.ok(frag.x > aX - 100 && frag.x + frag.w < cX);
});
