import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createEdge } from '../../js/core/project.js';
import { buildFlowchartMermaid } from '../../js/io/exportFlowchartMermaid.js';

function node(shape, text, rows = []) {
  return createNode(null, 0, 0, { shape, text, rows });
}

test('buildFlowchartMermaid starts with "flowchart LR" and emits one node line per node', () => {
  const a = node('rect', 'Client');
  const b = node('rounded', 'Server');
  const text = buildFlowchartMermaid({ nodes: [a, b], edges: [] });
  const lines = text.split('\n');
  assert.equal(lines[0], 'flowchart LR');
  assert.ok(lines.some((l) => l.includes('N1["Client"]')));
  assert.ok(lines.some((l) => l.includes('N2("Server")')));
});

test('buildFlowchartMermaid maps every node shape to its Mermaid bracket pair', () => {
  const shapes = {
    rect: '["X"]',
    rounded: '("X")',
    circle: '(("X"))',
    diamond: '{"X"}',
    cylinder: '[("X")]',
    hexagon: '{{"X"}}',
    cloud: '(["X"])',
    note: '["X"]',
    lifeline: '["X"]',
  };
  for (const [shape, expected] of Object.entries(shapes)) {
    const text = buildFlowchartMermaid({ nodes: [node(shape, 'X')], edges: [] });
    assert.ok(text.includes(`N1${expected}`), `${shape} should render as ${expected}, got: ${text}`);
  }
});

test('buildFlowchartMermaid flattens a "rows" node\'s title + rows into one <br/>-joined label', () => {
  const a = node('rect', 'User', ['id: number', 'email: string']);
  const text = buildFlowchartMermaid({ nodes: [a], edges: [] });
  assert.ok(text.includes('N1["User<br/>id: number<br/>email: string"]'));
});

test('buildFlowchartMermaid maps dash/arrowhead to solid/dotted, with-or-without an arrowhead', () => {
  const a = node('rect', 'A');
  const b = node('rect', 'B');
  const edges = [
    createEdge(a.id, b.id, { dash: 'solid', endArrow: 'filled' }),
    createEdge(a.id, b.id, { dash: 'solid', endArrow: 'none' }),
    createEdge(a.id, b.id, { dash: 'dashed', endArrow: 'filled' }),
    createEdge(a.id, b.id, { dash: 'dashed', endArrow: 'none' }),
  ];
  const text = buildFlowchartMermaid({ nodes: [a, b], edges });
  assert.ok(text.includes('N1 --> N2'));
  assert.ok(text.includes('N1 --- N2'));
  assert.ok(text.includes('N1 -.-> N2'));
  assert.ok(text.includes('N1 -.- N2'));
});

test('buildFlowchartMermaid includes an edge label when set, and omits the pipes when empty', () => {
  const a = node('rect', 'A');
  const b = node('rect', 'B');
  const edges = [createEdge(a.id, b.id, { label: 'HTTP GET' })];
  const text = buildFlowchartMermaid({ nodes: [a, b], edges });
  assert.ok(text.includes('N1 -->|HTTP GET| N2'));
});

test('buildFlowchartMermaid skips an edge whose endpoint is missing from the given node list', () => {
  const a = node('rect', 'A');
  const b = node('rect', 'B');
  const edges = [createEdge(a.id, 'ghost-node-id', {})];
  const text = buildFlowchartMermaid({ nodes: [a, b], edges });
  assert.ok(!text.includes('ghost'));
});
