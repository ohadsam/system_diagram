import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createEdge } from '../../js/core/project.js';
import { buildSequencePlantUML } from '../../js/io/exportSequencePlantUML.js';

function lifeline(x, text) {
  return createNode(null, x, 0, { shape: 'lifeline', w: 140, h: 640, text });
}

test('buildSequencePlantUML wraps output in @startuml/@enduml and emits one participant per lifeline', () => {
  const client = lifeline(0, 'Client');
  const server = lifeline(220, 'Server');
  const nodes = [client, server];
  const edges = [createEdge(client.id, server.id, { label: 'ping', fromOffset: 0.2, toOffset: 0.2, dash: 'solid', endArrow: 'filled' })];
  const text = buildSequencePlantUML({ nodes, edges, allNodes: nodes });
  const lines = text.split('\n');
  assert.equal(lines[0], '@startuml');
  assert.equal(lines[lines.length - 1], '@enduml');
  assert.ok(lines.some((l) => l.includes('participant "Client" as P1')));
  assert.ok(lines.some((l) => l.includes('participant "Server" as P2')));
});

test('buildSequencePlantUML orders messages top-to-bottom by height', () => {
  const client = lifeline(0, 'Client');
  const server = lifeline(220, 'Server');
  const nodes = [client, server];
  const edges = [
    createEdge(client.id, server.id, { label: 'second', fromOffset: 0.6, toOffset: 0.6, dash: 'solid', endArrow: 'filled' }),
    createEdge(client.id, server.id, { label: 'first', fromOffset: 0.2, toOffset: 0.2, dash: 'solid', endArrow: 'filled' }),
  ];
  const text = buildSequencePlantUML({ nodes, edges, allNodes: nodes });
  const lines = text.split('\n');
  const firstIdx = lines.findIndex((l) => l.includes(': first'));
  const secondIdx = lines.findIndex((l) => l.includes(': second'));
  assert.ok(firstIdx > 0 && secondIdx > 0 && firstIdx < secondIdx);
  assert.ok(lines[firstIdx].includes('P1 -> P2'));
});

test('buildSequencePlantUML maps dash/arrow style to sync (->) / async (->>) / return (-->)', () => {
  const a = lifeline(0, 'A');
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [
    createEdge(a.id, b.id, { label: 'sync', fromOffset: 0.1, toOffset: 0.1, dash: 'solid', endArrow: 'filled' }),
    createEdge(a.id, b.id, { label: 'async', fromOffset: 0.2, toOffset: 0.2, dash: 'solid', endArrow: 'open' }),
    createEdge(b.id, a.id, { label: 'reply', fromOffset: 0.3, toOffset: 0.3, dash: 'dashed', endArrow: 'open' }),
  ];
  const text = buildSequencePlantUML({ nodes, edges, allNodes: nodes });
  assert.ok(text.includes('P1 -> P2 : sync'));
  assert.ok(text.includes('P1 ->> P2 : async'));
  assert.ok(text.includes('P2 --> P1 : reply'));
});

test('buildSequencePlantUML emits activate/deactivate and destroy at the right relative order', () => {
  const a = lifeline(0, 'A');
  a.activations = [{ id: 'act_1', startOffset: 0.1, endOffset: 0.4 }];
  a.destroyOffset = 0.9;
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [createEdge(a.id, b.id, { label: 'ping', fromOffset: 0.2, toOffset: 0.2 })];
  const text = buildSequencePlantUML({ nodes, edges, allNodes: nodes });
  const lines = text.split('\n').map((l) => l.trim());
  assert.ok(lines.includes('activate P1'));
  assert.ok(lines.includes('deactivate P1'));
  assert.ok(lines.includes('destroy P1'));
  const msgIdx = lines.findIndex((l) => l.includes('P1 -> P2 : ping'));
  assert.ok(lines.indexOf('activate P1') < msgIdx);
  assert.ok(lines.indexOf('deactivate P1') > msgIdx);
});

test('buildSequencePlantUML wraps enclosed messages in an alt/opt/loop/par block from an overlapping fragment node', () => {
  const a = lifeline(0, 'A');
  const b = lifeline(220, 'B');
  const nodes = [a, b];
  const edges = [createEdge(a.id, b.id, { label: 'inside', fromOffset: 0.5, toOffset: 0.5 })];
  const fragment = createNode(null, -20, 100, { w: 400, h: 300, text: 'user is premium', fragmentType: 'alt' });
  const text = buildSequencePlantUML({ nodes, edges, allNodes: [...nodes, fragment] });
  const lines = text.split('\n').map((l) => l.trim());
  const altIdx = lines.indexOf('alt user is premium');
  const msgIdx = lines.indexOf('P1 -> P2 : inside');
  const endIdx = lines.indexOf('end');
  assert.ok(altIdx !== -1 && msgIdx !== -1 && endIdx !== -1);
  assert.ok(altIdx < msgIdx && msgIdx < endIdx);
});
