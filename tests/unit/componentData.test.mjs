import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, ALL_COMPONENTS, COMPONENTS_BY_CATEGORY, getComponentById, getComponentsForCategory, getLayerComponents, getRelatedComponents, getRelatedLayers,
} from '../../js/data/index.js';

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

test('getLayerComponents returns a rich, consistent set of kind:"layer" items', () => {
  const layers = getLayerComponents();
  assert.ok(layers.length >= 50, `expected at least 50 layer items, got ${layers.length}`);
  for (const layer of layers) {
    assert.equal(layer.kind, 'layer');
    assert.equal(layer.categoryId, 'layers');
  }
});

test('every design-pattern node defId resolves to a real component/layer', () => {
  const patterns = ALL_COMPONENTS.filter((c) => c.kind === 'pattern');
  assert.ok(patterns.length >= 10, `expected at least 10 patterns, got ${patterns.length}`);
  for (const pattern of patterns) {
    assert.ok(pattern.pattern?.nodes?.length >= 2, `pattern "${pattern.id}" should have at least 2 nodes`);
    for (const node of pattern.pattern.nodes) {
      assert.ok(getComponentById(node.defId), `pattern "${pattern.id}" node "${node.key}" references unknown defId "${node.defId}"`);
    }
  }
});

test('every design-pattern edge only references keys that exist in its own node list', () => {
  const patterns = ALL_COMPONENTS.filter((c) => c.kind === 'pattern');
  for (const pattern of patterns) {
    const keys = new Set(pattern.pattern.nodes.map((n) => n.key));
    for (const edge of pattern.pattern.edges) {
      assert.ok(keys.has(edge.from), `pattern "${pattern.id}" edge references unknown "from" key "${edge.from}"`);
      assert.ok(keys.has(edge.to), `pattern "${pattern.id}" edge references unknown "to" key "${edge.to}"`);
    }
  }
});

test('pattern node keys are unique within each pattern (no ambiguous edge targets)', () => {
  const patterns = ALL_COMPONENTS.filter((c) => c.kind === 'pattern');
  for (const pattern of patterns) {
    const keys = pattern.pattern.nodes.map((n) => n.key);
    assert.equal(new Set(keys).size, keys.length, `pattern "${pattern.id}" has duplicate node keys`);
  }
});

test('the "AI Providers & Agents" category is rich and covers providers, models, MCP, agents and skills', () => {
  const aiAgents = getComponentsForCategory('ai-agents');
  assert.ok(aiAgents.length >= 40, `expected at least 40 AI Providers & Agents items, got ${aiAgents.length}`);
  const names = aiAgents.map((c) => c.name).join(' | ');
  for (const expected of ['OpenAI', 'Anthropic', 'MCP Server', 'AI Agent', 'Skill']) {
    assert.ok(names.includes(expected), `expected "${expected}" to be present in AI Providers & Agents`);
  }
});

test('every component\'s "related" (Smart Suggestions) ids resolve to real components, and none self-references', () => {
  const withRelated = ALL_COMPONENTS.filter((c) => c.related?.length);
  assert.ok(withRelated.length >= 30, `expected at least 30 components with curated related-suggestions, got ${withRelated.length}`);
  for (const comp of withRelated) {
    for (const relId of comp.related) {
      assert.ok(getComponentById(relId), `"${comp.id}".related references unknown id "${relId}"`);
      assert.notEqual(relId, comp.id, `"${comp.id}" lists itself in its own related array`);
    }
    assert.equal(new Set(comp.related).size, comp.related.length, `"${comp.id}" has duplicate entries in its related array`);
  }
});

test('getRelatedComponents resolves ids to real defs and is empty/safe for components with none', () => {
  const redisRelated = getRelatedComponents('db-redis').map((c) => c.id);
  assert.ok(redisRelated.includes('db-postgres'));
  assert.ok(redisRelated.includes('db-mysql'));
  assert.deepEqual(getRelatedComponents('does-not-exist'), []);
  assert.deepEqual(getRelatedComponents('net-dns'), []); // a real component with no curated related list
});

test('every component\'s "relatedLayers" (Smart Suggestions sub-components) ids resolve to real kind:"layer" components', () => {
  const withRelatedLayers = ALL_COMPONENTS.filter((c) => c.relatedLayers?.length);
  assert.ok(withRelatedLayers.length >= 8, `expected at least 8 components with curated relatedLayers, got ${withRelatedLayers.length}`);
  for (const comp of withRelatedLayers) {
    for (const relId of comp.relatedLayers) {
      const rel = getComponentById(relId);
      assert.ok(rel, `"${comp.id}".relatedLayers references unknown id "${relId}"`);
      assert.equal(rel.kind, 'layer', `"${comp.id}".relatedLayers references "${relId}", which isn't a layer (kind: "${rel.kind}")`);
    }
    assert.equal(new Set(comp.relatedLayers).size, comp.relatedLayers.length, `"${comp.id}" has duplicate entries in its relatedLayers array`);
  }
});

test('getRelatedLayers resolves ids to real layer defs and is empty/safe for components with none', () => {
  const expressLayers = getRelatedLayers('be-express').map((c) => c.id);
  assert.ok(expressLayers.includes('layer-controller'));
  assert.ok(expressLayers.includes('layer-middleware'));
  for (const layer of getRelatedLayers('fe-react')) {
    assert.equal(layer.kind, 'layer');
  }
  assert.deepEqual(getRelatedLayers('does-not-exist'), []);
  assert.deepEqual(getRelatedLayers('net-dns'), []); // a real component with no curated relatedLayers list
});

test('the "State Machines" category mixes state shapes and ready-made pattern templates', () => {
  const stateMachines = getComponentsForCategory('state-machines');
  assert.ok(stateMachines.length >= 10, `expected at least 10 State Machines items, got ${stateMachines.length}`);
  const shapes = stateMachines.filter((c) => c.kind === 'component');
  const patterns = stateMachines.filter((c) => c.kind === 'pattern');
  assert.ok(shapes.length >= 5, `expected at least 5 state shapes, got ${shapes.length}`);
  assert.ok(patterns.length >= 5, `expected at least 5 state-machine pattern templates, got ${patterns.length}`);
  const names = stateMachines.map((c) => c.name).join(' | ');
  for (const expected of ['Initial State', 'Final State', 'Choice', 'Traffic Light']) {
    assert.ok(names.includes(expected), `expected "${expected}" to be present in State Machines`);
  }
});
