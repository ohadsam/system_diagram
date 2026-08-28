import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROJECTS, getDemoProjectById, buildDemoProject } from '../../js/core/demoProjects.js';
import { validateProject } from '../../js/core/project.js';

test('DEMO_PROJECTS has unique ids, and every entry has a name/icon/description', () => {
  const ids = new Set();
  for (const demo of DEMO_PROJECTS) {
    assert.ok(!ids.has(demo.id), `duplicate demo id: ${demo.id}`);
    ids.add(demo.id);
    assert.ok(demo.name, `${demo.id} missing name`);
    assert.ok(demo.icon, `${demo.id} missing icon`);
    assert.ok(demo.description, `${demo.id} missing description`);
    assert.equal(typeof demo.build, 'function', `${demo.id} missing build()`);
  }
});

test('getDemoProjectById resolves a real id and returns null for an unknown one', () => {
  assert.equal(getDemoProjectById('demo-basic-web-app').id, 'demo-basic-web-app');
  assert.equal(getDemoProjectById('nope'), null);
});

test('every demo builds at least one node, with every defId resolving to a real component', () => {
  for (const demo of DEMO_PROJECTS) {
    const { nodes, edges } = demo.build();
    assert.ok(nodes.length > 0, `${demo.id} produced no nodes`);
    for (const node of nodes) {
      assert.ok(node.id, `${demo.id} produced a node with no id`);
      assert.ok(node.defId, `${demo.id} produced a node with no defId`);
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges || []) {
      assert.ok(nodeIds.has(edge.from), `${demo.id} has an edge referencing an unknown "from" node`);
      assert.ok(nodeIds.has(edge.to), `${demo.id} has an edge referencing an unknown "to" node`);
    }
  }
});

test('buildDemoProject returns a validateProject-clean project for every demo', () => {
  for (const demo of DEMO_PROJECTS) {
    const project = buildDemoProject(demo.id);
    assert.ok(project, `${demo.id} failed to build`);
    const result = validateProject(project);
    assert.equal(result.ok, true, `${demo.id} failed validateProject: ${result.error}`);
    assert.equal(result.project.nodes.length, project.nodes.length);
  }
});

test('buildDemoProject returns null for an unknown demo id', () => {
  assert.equal(buildDemoProject('nope'), null);
});

test('the combo demo actually combines two kinds: plain nodes plus lifeline nodes', () => {
  const project = buildDemoProject('demo-combo-system-and-sequence');
  const lifelineNodes = project.nodes.filter((n) => n.shape === 'lifeline');
  const plainNodes = project.nodes.filter((n) => n.shape !== 'lifeline');
  assert.ok(lifelineNodes.length >= 2, 'expected 2+ lifelines in the combo demo');
  assert.ok(plainNodes.length >= 2, 'expected 2+ regular components in the combo demo');
});
