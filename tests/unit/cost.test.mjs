import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCostedNodes, computeMonthlyCostTotal, formatMonthlyCost } from '../../js/core/cost.js';

function node(monthlyCost) {
  return { id: `n-${Math.random()}`, monthlyCost };
}

test('getCostedNodes filters out nodes with no cost estimate and sorts highest first', () => {
  const nodes = [node(10), node(null), node(50), node(undefined), node(25)];
  const result = getCostedNodes(nodes);
  assert.deepEqual(result.map((n) => n.monthlyCost), [50, 25, 10]);
});

test('getCostedNodes returns an empty array when nothing has a cost', () => {
  assert.deepEqual(getCostedNodes([node(null), node(undefined)]), []);
});

test('computeMonthlyCostTotal sums every costed node and ignores uncosted ones', () => {
  const nodes = [node(10.5), node(null), node(4.5)];
  assert.equal(computeMonthlyCostTotal(nodes), 15);
});

test('computeMonthlyCostTotal is 0 for an empty or fully-uncosted node list', () => {
  assert.equal(computeMonthlyCostTotal([]), 0);
  assert.equal(computeMonthlyCostTotal([node(null)]), 0);
});

test('formatMonthlyCost formats whole numbers without decimals and adds thousands separators', () => {
  assert.equal(formatMonthlyCost(45), '$45');
  assert.equal(formatMonthlyCost(1234), '$1,234');
  assert.equal(formatMonthlyCost(0), '$0');
});

test('formatMonthlyCost keeps up to 2 decimals only when actually needed', () => {
  assert.equal(formatMonthlyCost(45.5), '$45.50');
  assert.equal(formatMonthlyCost(45.999), '$46'); // rounds to the nearest cent, which lands whole here
});
