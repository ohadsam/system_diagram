import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, ALL_COMPONENTS, COMPONENTS_BY_CATEGORY, getComponentById, getComponentsForCategory } from '../../js/data/index.js';

test('the library loads with a large, rich set of categories and components', () => {
  assert.ok(CATEGORIES.length >= 15, `expected at least 15 categories, got ${CATEGORIES.length}`);
  assert.ok(ALL_COMPONENTS.length >= 150, `expected at least 150 components, got ${ALL_COMPONENTS.length}`);
});

test('categories are sorted alphabetically by label', () => {
  const labels = CATEGORIES.map((c) => c.label);
  const sorted = [...labels].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(labels, sorted);
});

test('components within each category are sorted alphabetically by name', () => {
  for (const cat of CATEGORIES) {
    const names = getComponentsForCategory(cat.id).map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted, `category "${cat.id}" is not alphabetically sorted`);
  }
});

test('every component id is globally unique', () => {
  const ids = ALL_COMPONENTS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every component has the required fields for rendering', () => {
  for (const comp of ALL_COMPONENTS) {
    assert.equal(typeof comp.id, 'string');
    assert.ok(comp.id.length > 0);
    assert.equal(typeof comp.name, 'string');
    assert.ok(comp.name.length > 0);
    assert.equal(typeof comp.icon, 'string');
    assert.equal(typeof comp.color, 'string');
    assert.equal(typeof comp.fill, 'string');
    assert.ok(comp.defaultSize.w > 0 && comp.defaultSize.h > 0);
  }
});

test('getComponentById finds a known built-in and returns null for unknown ids', () => {
  assert.equal(getComponentById('aws-ec2')?.name, 'EC2 (Elastic Compute Cloud)');
  assert.equal(getComponentById('does-not-exist'), null);
});

test('COMPONENTS_BY_CATEGORY is consistent with ALL_COMPONENTS', () => {
  let total = 0;
  for (const [, list] of COMPONENTS_BY_CATEGORY) total += list.length;
  assert.equal(total, ALL_COMPONENTS.length);
});
