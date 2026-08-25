import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createEdge } from '../../js/core/project.js';
import { computeDiagramLint } from '../../js/core/diagramLint.js';

function fakeResolveDef(catByDefId) {
  return (defId) => catByDefId[defId] || null;
}

test('computeDiagramLint flags a client node connected directly to a database node', () => {
  const client = createNode(null, 0, 0, { text: 'Web App', defId: 'fe-react' });
  const db = createNode(null, 200, 0, { text: 'Postgres', defId: 'db-postgres' });
  const edge = createEdge(client.id, db.id, {});
  const resolveDef = fakeResolveDef({ 'fe-react': { categoryId: 'client', name: 'React' }, 'db-postgres': { categoryId: 'databases', name: 'PostgreSQL' } });

  const findings = computeDiagramLint([client, db], [edge], [], resolveDef);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, `client-to-db-${edge.id}`);
  assert.ok(findings[0].message.includes('Web App'));
  assert.ok(findings[0].message.includes('Postgres'));
});

test('computeDiagramLint does not flag a client connected to a non-database, or a client through a service to a database', () => {
  const client = createNode(null, 0, 0, { text: 'Web App', defId: 'fe-react' });
  const service = createNode(null, 200, 0, { text: 'API', defId: 'srv-app-server' });
  const db = createNode(null, 400, 0, { text: 'Postgres', defId: 'db-postgres' });
  const edges = [createEdge(client.id, service.id, {}), createEdge(service.id, db.id, {})];
  const resolveDef = fakeResolveDef({
    'fe-react': { categoryId: 'client', name: 'React' },
    'srv-app-server': { categoryId: 'servers', name: 'Application Server' },
    'db-postgres': { categoryId: 'databases', name: 'PostgreSQL' },
  });

  const findings = computeDiagramLint([client, service, db], edges, [], resolveDef);
  assert.equal(findings.length, 0);
});

test('computeDiagramLint flags a node with no connections, but only when the diagram has at least one edge elsewhere', () => {
  const a = createNode(null, 0, 0, { text: 'A' });
  const b = createNode(null, 200, 0, { text: 'B' });
  const orphan = createNode(null, 400, 0, { text: 'Forgotten' });
  const resolveDef = fakeResolveDef({});

  const withEdge = computeDiagramLint([a, b, orphan], [createEdge(a.id, b.id, {})], [], resolveDef);
  assert.equal(withEdge.length, 1);
  assert.ok(withEdge[0].message.includes('Forgotten'));

  const noEdgesAtAll = computeDiagramLint([a, b, orphan], [], [], resolveDef);
  assert.equal(noEdgesAtAll.length, 0, 'an entirely unconnected diagram (nothing wired up yet) should not be flagged node-by-node');
});

test('computeDiagramLint ignores lifelines and fragment boxes for the orphan check', () => {
  const lifeline = createNode(null, 0, 0, { text: 'Client', shape: 'lifeline' });
  const other = createNode(null, 400, 0, { text: 'B' });
  const another = createNode(null, 600, 0, { text: 'C' });
  const resolveDef = fakeResolveDef({});
  const findings = computeDiagramLint([lifeline, other, another], [createEdge(other.id, another.id, {})], [], resolveDef);
  assert.ok(!findings.some((f) => f.message.includes('Client')));
});

test('computeDiagramLint ignores a "Group / Container" boundary box for the orphan check — it is purely visual and never meant to have an edge', () => {
  const group = createNode(null, 0, 0, { text: 'Backend', defId: 'shape-group' });
  const other = createNode(null, 400, 0, { text: 'B' });
  const another = createNode(null, 600, 0, { text: 'C' });
  const resolveDef = fakeResolveDef({});
  const findings = computeDiagramLint([group, other, another], [createEdge(other.id, another.id, {})], [], resolveDef);
  assert.ok(!findings.some((f) => f.message.includes('Backend')));
});

test('computeDiagramLint flags a replication pair with no load balancer/gateway routing to it', () => {
  const a = createNode(null, 0, 0, { text: 'Service A' });
  const b = createNode(null, 400, 0, { text: 'Service B (mirror)' });
  const pair = { id: 'repl_1', members: [{ a: a.id, b: b.id }] };
  const resolveDef = fakeResolveDef({});

  const findings = computeDiagramLint([a, b], [], [pair], resolveDef);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, 'unrouted-replicas-repl_1');
  assert.ok(findings[0].message.includes('Service A'));
  assert.ok(findings[0].message.includes('Service B'));
});

test('computeDiagramLint does not flag a replication pair that has a load balancer routing to it', () => {
  const lb = createNode(null, -200, 0, { text: 'Load Balancer', defId: 'net-lb' });
  const a = createNode(null, 0, 0, { text: 'Service A' });
  const b = createNode(null, 400, 0, { text: 'Service B (mirror)' });
  const pair = { id: 'repl_1', members: [{ a: a.id, b: b.id }] };
  const resolveDef = fakeResolveDef({ 'net-lb': { categoryId: 'networking', name: 'Load Balancer' } });

  const findings = computeDiagramLint([lb, a, b], [createEdge(lb.id, a.id, {}), createEdge(lb.id, b.id, {})], [pair], resolveDef);
  assert.ok(!findings.some((f) => f.id.startsWith('unrouted-replicas-')), 'should not flag the pair as unrouted once the load balancer reaches it');
});

test('computeDiagramLint returns no findings for an empty diagram', () => {
  const resolveDef = fakeResolveDef({});
  assert.deepEqual(computeDiagramLint([], [], [], resolveDef), []);
});
