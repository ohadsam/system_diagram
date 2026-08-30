import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestEdgeLabel } from '../../js/core/smartEdgeLabels.js';

test('suggestEdgeLabel returns null for missing defs', () => {
  assert.equal(suggestEdgeLabel(null, { categoryId: 'databases' }), null);
  assert.equal(suggestEdgeLabel({ categoryId: 'client' }, null), null);
});

test('suggestEdgeLabel guesses "reads/writes" for a backend service connecting to a database', () => {
  const from = { name: 'Node.js Service', categoryId: 'backend-frameworks' };
  const to = { name: 'PostgreSQL', categoryId: 'databases' };
  assert.equal(suggestEdgeLabel(from, to), 'reads/writes');
});

test('suggestEdgeLabel guesses "calls" for a client connecting to a backend service', () => {
  const from = { name: 'React App', categoryId: 'client' };
  const to = { name: 'Node.js Service', categoryId: 'backend-frameworks' };
  assert.equal(suggestEdgeLabel(from, to), 'calls');
});

test('suggestEdgeLabel recognizes a load balancer by name regardless of category pairing', () => {
  const from = { name: 'Load Balancer', categoryId: 'networking' };
  const to = { name: 'Custom Widget', categoryId: 'misc' };
  assert.equal(suggestEdgeLabel(from, to), 'routes to');
});

test('suggestEdgeLabel labels a queue edge so it reads correctly in either direction', () => {
  const queue = { name: 'Kafka', categoryId: 'messaging' };
  const service = { name: 'Order Service', categoryId: 'backend-frameworks' };
  // "Order Service publishes to Kafka"
  assert.equal(suggestEdgeLabel(service, queue), 'publishes to');
  // "Kafka delivers to Order Service"
  assert.equal(suggestEdgeLabel(queue, service), 'delivers to');
});

test('suggestEdgeLabel returns null for an unrecognized category pairing', () => {
  const from = { name: 'Something', categoryId: 'misc' };
  const to = { name: 'Something Else', categoryId: 'misc' };
  assert.equal(suggestEdgeLabel(from, to), null);
});
