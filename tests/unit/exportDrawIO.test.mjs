import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createEdge } from '../../js/core/project.js';
import { buildDrawIOXml } from '../../js/io/exportDrawIO.js';

test('buildDrawIOXml wraps the output in a valid mxGraphModel/root shell', () => {
  const a = createNode(null, 0, 0, { shape: 'rect', text: 'Client' });
  const text = buildDrawIOXml({ nodes: [a], edges: [] });
  assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(text.includes('<mxGraphModel'));
  assert.ok(text.includes('</mxGraphModel>'));
  assert.ok(text.includes('<mxCell id="0" />'));
  assert.ok(text.includes('<mxCell id="1" parent="0" />'));
});

test('buildDrawIOXml emits one mxCell vertex per node, with its position/size/color', () => {
  const a = createNode(null, 120, 80, { shape: 'rect', text: 'Client', w: 160, h: 84, fill: '#ABCDEF', stroke: '#112233' });
  const text = buildDrawIOXml({ nodes: [a], edges: [] });
  assert.ok(text.includes('value="Client"'));
  assert.ok(text.includes('x="120" y="80" width="160" height="84"'));
  assert.ok(text.includes('fillColor=#ABCDEF'));
  assert.ok(text.includes('strokeColor=#112233'));
  assert.ok(text.includes('vertex="1"'));
});

test('buildDrawIOXml maps every node shape to a draw.io style without crashing', () => {
  const shapes = ['rect', 'rounded', 'circle', 'diamond', 'cylinder', 'hexagon', 'cloud', 'note', 'rows', 'lifeline'];
  for (const shape of shapes) {
    const n = createNode(null, 0, 0, { shape, text: 'X' });
    const text = buildDrawIOXml({ nodes: [n], edges: [] });
    assert.ok(text.includes('vertex="1"'), `shape "${shape}" should still produce a vertex cell`);
  }
});

test('buildDrawIOXml flattens a "rows" node\'s title + rows into one <br>-joined value', () => {
  const a = createNode(null, 0, 0, { shape: 'rect', text: 'User', rows: ['id: number', 'email: string'] });
  const text = buildDrawIOXml({ nodes: [a], edges: [] });
  assert.ok(text.includes('value="User&lt;br&gt;id: number&lt;br&gt;email: string"') || text.includes('User<br>id: number<br>email: string'));
});

test('buildDrawIOXml emits one mxCell edge per edge, referencing source/target node ids', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const b = createNode(null, 200, 0, { text: 'B' });
  const edge = createEdge(a.id, b.id, { label: 'call' });
  const text = buildDrawIOXml({ nodes: [a, b], edges: [edge] });
  assert.ok(text.includes('edge="1"'));
  assert.ok(text.includes('source="node1" target="node2"'));
  assert.ok(text.includes('value="call"'));
});

test('buildDrawIOXml XML-escapes special characters in labels', () => {
  const a = createNode(null, 0, 0, { text: 'A & <B> "C"' });
  const text = buildDrawIOXml({ nodes: [a], edges: [] });
  assert.ok(text.includes('A &amp; &lt;B&gt; &quot;C&quot;'));
});

test('buildDrawIOXml skips an edge whose endpoint is missing from the given node list', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const edge = createEdge(a.id, 'ghost-node-id', {});
  const text = buildDrawIOXml({ nodes: [a], edges: [edge] });
  assert.ok(!text.includes('ghost'));
});
