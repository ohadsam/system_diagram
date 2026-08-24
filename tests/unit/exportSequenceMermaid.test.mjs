import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createEdge } from '../../js/core/project.js';
import { buildSequenceMermaid } from '../../js/io/exportSequenceMermaid.js';

function lifeline(x, text) {
  return createNode(null, x, 0, { shape: 'lifeline', w: 140, h: 640, text });
}

test('buildSequenceMermaid emits a participant per lifeline and one arrow per message, in top-to-bottom order', () => {
  const client = lifeline(0, 'Client');
  const server = lifeline(220, 'Server');
  const nodes = [client, server];
  const edges = [
    createEdge(client.id, server.id, { label: 'second', fromOffset: 0.6, toOffset: 0.6, dash: 'solid', endArrow: 'filled' }),
    createEdge(client.id, server.id, { label: 'first', fromOffset: 0.2, toOffset: 0.2, dash: 'solid', endArrow: 'filled' }),
  ];
  const text = buildSequenceMermaid({ nodes, edges, allNodes: nodes });
  const lines = text.split('\n');
  assert.equal(lines[0], 'sequenceDiagram');
  assert.ok(lines.some((l) => l.includes('participant P1 as Client')));
  assert.ok(lines.some((l) => l.includes('participant P2 as Server')));
  const firstIdx = lines.findIndex((l) => l.includes(': first'));
  const secondIdx = lines.findIndex((l) => l.includes(': second'));
  assert.ok(firstIdx > 0 && secondIdx > 0 && firstIdx < secondIdx, 'messages should be ordered top-to-bottom by height');
  assert.ok(lines[firstIdx].includes('P1->>P2'));
});

test('buildSequenceMermaid maps dash/arrow style to sync (->>) / async (-)) / return (-->>) arrows', () => {
  const a = lifeline(0, 'A');
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [
    createEdge(a.id, b.id, { label: 'sync', fromOffset: 0.1, toOffset: 0.1, dash: 'solid', endArrow: 'filled' }),
    createEdge(a.id, b.id, { label: 'async', fromOffset: 0.2, toOffset: 0.2, dash: 'solid', endArrow: 'open' }),
    createEdge(b.id, a.id, { label: 'reply', fromOffset: 0.3, toOffset: 0.3, dash: 'dashed', endArrow: 'open' }),
  ];
  const text = buildSequenceMermaid({ nodes, edges, allNodes: nodes });
  assert.ok(text.includes('P1->>P2: sync'));
  assert.ok(text.includes('P1-)P2: async'));
  assert.ok(text.includes('P2-->>P1: reply'));
});

test('buildSequenceMermaid emits activate/deactivate for activation bars and destroy for a destroyed lifeline', () => {
  const a = lifeline(0, 'A');
  a.activations = [{ id: 'act_1', startOffset: 0.1, endOffset: 0.4 }];
  a.destroyOffset = 0.9;
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [createEdge(a.id, b.id, { label: 'ping', fromOffset: 0.2, toOffset: 0.2 })];
  const text = buildSequenceMermaid({ nodes, edges, allNodes: nodes });
  assert.ok(text.includes('activate P1'));
  assert.ok(text.includes('deactivate P1'));
  assert.ok(text.includes('destroy P1'));
  const lines = text.split('\n').map((l) => l.trim());
  assert.ok(lines.indexOf('activate P1') < lines.indexOf('P1->>P2: ping'));
  assert.ok(lines.indexOf('deactivate P1') > lines.indexOf('P1->>P2: ping'));
});

test('buildSequenceMermaid wraps enclosed messages in an alt/opt/loop/par block from an overlapping fragment node', () => {
  const a = lifeline(0, 'A');
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [createEdge(a.id, b.id, { label: 'inside', fromOffset: 0.5, toOffset: 0.5 })];
  const fragment = createNode(null, -20, 100, { w: 400, h: 300, text: 'user is premium', fragmentType: 'alt' });
  const text = buildSequenceMermaid({ nodes, edges, allNodes: [...nodes, fragment] });
  const lines = text.split('\n').map((l) => l.trim());
  const altIdx = lines.indexOf('alt user is premium');
  const msgIdx = lines.indexOf('P1->>P2: inside');
  const endIdx = lines.indexOf('end');
  assert.ok(altIdx !== -1 && msgIdx !== -1 && endIdx !== -1);
  assert.ok(altIdx < msgIdx && msgIdx < endIdx);
});

test('buildSequenceMermaid ignores a fragment node that does not overlap the group', () => {
  const a = lifeline(0, 'A');
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [createEdge(a.id, b.id, { label: 'ping', fromOffset: 0.5, toOffset: 0.5 })];
  const farAway = createNode(null, 5000, 5000, { w: 400, h: 300, text: 'unrelated', fragmentType: 'opt' });
  const text = buildSequenceMermaid({ nodes, edges, allNodes: [...nodes, farAway] });
  assert.ok(!text.includes('opt unrelated'));
});
