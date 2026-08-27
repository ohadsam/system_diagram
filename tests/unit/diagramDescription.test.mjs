import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagramDescription } from '../../js/core/diagramDescription.js';

const resolveDef = (defId) => (defId === 'net-api-gateway' ? { categoryId: 'Networking' } : null);

test('an empty diagram gets a plain "no components" summary', () => {
  const d = buildDiagramDescription([], [], resolveDef);
  assert.match(d.summary, /empty/);
  assert.deepEqual(d.categoryLines, []);
});

test('summarizes component/connection counts, categories, connections, and isolated components', () => {
  const nodes = [
    { id: 'n1', text: 'API Gateway', defId: 'net-api-gateway' },
    { id: 'n2', text: 'Mystery', defId: 'unknown-def' },
    { id: 'n3', text: 'Lonely' },
  ];
  const edges = [{ from: 'n1', to: 'n2', label: 'routes to' }];
  const d = buildDiagramDescription(nodes, edges, resolveDef);
  assert.match(d.summary, /3 components? and 1 connection/);
  assert.deepEqual(d.categoryLines, ['Other: 2', 'Networking: 1']);
  assert.deepEqual(d.connectionLines, ['API Gateway → Mystery ("routes to")']);
  assert.deepEqual(d.isolatedLines, ['Lonely']);
});

test('detects a sequence diagram (lifeline shapes) and phrases the summary accordingly', () => {
  const nodes = [{ id: 'n1', shape: 'lifeline', text: 'Client' }, { id: 'n2', shape: 'lifeline', text: 'Server' }];
  const edges = [{ from: 'n1', to: 'n2' }];
  const d = buildDiagramDescription(nodes, edges, resolveDef);
  assert.match(d.summary, /sequence diagram/);
  assert.match(d.summary, /2 lifelines/);
  assert.match(d.summary, /1 message/);
});
