import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProject, createNode, createEdge, removeNode, removeEdge, validateProject, nextZIndex, duplicateProject,
  createVersionSnapshot, removeVersion, createComment, createReply, createAnimationStep, createAnimation,
  countUnresolvedComments,
} from '../../js/core/project.js';

test('createEmptyProject has the expected shape', () => {
  const p = createEmptyProject('Test');
  assert.equal(p.name, 'Test');
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
  assert.equal(p.viewport.zoom, 1);
  assert.ok(p.id.startsWith('proj_'));
  assert.deepEqual(p.versions, []);
  assert.deepEqual(p.presentations, []);
});

test('createNode applies defaults and overrides', () => {
  const def = { id: 'aws-ec2', name: 'EC2', icon: '🖥️', shape: 'rounded', color: '#FF9900', fill: '#FFF', subComponents: [{ name: 'Auth', icon: '🔐' }], defaultSize: { w: 160, h: 84 } };
  const node = createNode(def, 10, 20);
  assert.equal(node.defId, 'aws-ec2');
  assert.equal(node.x, 10);
  assert.equal(node.y, 20);
  assert.equal(node.text, 'EC2');
  assert.equal(node.subComponents.length, 1);
  assert.ok(node.subComponents[0].id);
  assert.notEqual(node.id, undefined);
  assert.equal(node.iconVisible, true, 'icon visible by default');
  assert.equal(node.textPosition, 'center', 'text position centered by default');
  assert.equal(node.subComponentsDisplay, 'chips', 'sub-components shown as chips by default');
});

test('createNode overrides can set iconVisible/textPosition/subComponentsDisplay', () => {
  const node = createNode(null, 0, 0, { iconVisible: false, textPosition: 'above', subComponentsDisplay: 'full', fill: 'transparent' });
  assert.equal(node.iconVisible, false);
  assert.equal(node.textPosition, 'above');
  assert.equal(node.subComponentsDisplay, 'full');
  assert.equal(node.fill, 'transparent');
});

test('createEdge applies sane defaults', () => {
  const edge = createEdge('n1', 'n2');
  assert.equal(edge.from, 'n1');
  assert.equal(edge.to, 'n2');
  assert.equal(edge.endArrow, 'filled');
  assert.equal(edge.startArrow, 'none');
  assert.equal(edge.routing, 'orthogonal');
});

test('createNode defaults groupId to null and it is overridable', () => {
  const node = createNode(null, 0, 0);
  assert.equal(node.groupId, null);
  const grouped = createNode(null, 0, 0, { groupId: 'group_1' });
  assert.equal(grouped.groupId, 'group_1');
});

test('createEdge accepts "magic" as a routing override', () => {
  const edge = createEdge('n1', 'n2', { routing: 'magic' });
  assert.equal(edge.routing, 'magic');
});

test('createEdge defaults fromOffset/toOffset to the midpoint and notes to empty, both overridable', () => {
  const edge = createEdge('n1', 'n2');
  assert.equal(edge.fromOffset, 0.5);
  assert.equal(edge.toOffset, 0.5);
  assert.equal(edge.notes, '');
  const custom = createEdge('n1', 'n2', { fromOffset: 0.2, toOffset: 0.8, notes: 'the initial call' });
  assert.equal(custom.fromOffset, 0.2);
  assert.equal(custom.toOffset, 0.8);
  assert.equal(custom.notes, 'the initial call');
});

test('createEdge defaults labelPosition to "middle" and it is overridable', () => {
  const edge = createEdge('n1', 'n2');
  assert.equal(edge.labelPosition, 'middle');
  const custom = createEdge('n1', 'n2', { labelPosition: 'start' });
  assert.equal(custom.labelPosition, 'start');
});

test('validateProject defaults an invalid/missing labelPosition to "middle" and preserves a valid one', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 200, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id, { labelPosition: 'end' }));
  p.edges.push({ ...createEdge(n1.id, n2.id), labelPosition: 'bogus' });
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  assert.equal(project.edges[0].labelPosition, 'end');
  assert.equal(project.edges[1].labelPosition, 'middle');
});

test('createEdge defaults sequenceNumberOverride to null and it is overridable', () => {
  const edge = createEdge('n1', 'n2');
  assert.equal(edge.sequenceNumberOverride, null);
  const custom = createEdge('n1', 'n2', { sequenceNumberOverride: 7 });
  assert.equal(custom.sequenceNumberOverride, 7);
});

test('validateProject keeps a valid positive-integer sequenceNumberOverride and discards an invalid one', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 200, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id, { sequenceNumberOverride: 5 }));
  p.edges.push({ ...createEdge(n1.id, n2.id), sequenceNumberOverride: -1 });
  p.edges.push({ ...createEdge(n1.id, n2.id), sequenceNumberOverride: 2.5 });
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  assert.equal(project.edges[0].sequenceNumberOverride, 5);
  assert.equal(project.edges[1].sequenceNumberOverride, null);
  assert.equal(project.edges[2].sequenceNumberOverride, null);
});

test('createEdge defaults waypoints to an empty array and it is overridable', () => {
  const edge = createEdge('n1', 'n2');
  assert.deepEqual(edge.waypoints, []);
  const custom = createEdge('n1', 'n2', { waypoints: [{ x: 10, y: 20 }] });
  assert.deepEqual(custom.waypoints, [{ x: 10, y: 20 }]);
});

test('validateProject keeps well-formed waypoints and drops malformed entries', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 200, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id, {
    waypoints: [{ x: 50, y: 60 }, { x: 'nope', y: 10 }, { x: 90, y: 100 }, null, 'garbage'],
  }));
  p.edges.push({ ...createEdge(n1.id, n2.id), waypoints: 'not-an-array' });
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  assert.deepEqual(project.edges[0].waypoints, [{ x: 50, y: 60 }, { x: 90, y: 100 }]);
  assert.deepEqual(project.edges[1].waypoints, []);
});

test('createNode accepts "lifeline" as a valid shape', () => {
  const node = createNode(null, 0, 0, { shape: 'lifeline' });
  assert.equal(node.shape, 'lifeline');
});

test('createNode defaults destroyOffset to null, and validateProject clamps it to [0,1] or nulls it out', () => {
  const node = createNode(null, 0, 0, { shape: 'lifeline' });
  assert.equal(node.destroyOffset, null);

  const p = createEmptyProject();
  p.nodes.push(
    createNode(null, 0, 0, { shape: 'lifeline', destroyOffset: 0.7 }),
    createNode(null, 100, 0, { shape: 'lifeline', destroyOffset: 5 }),
    createNode(null, 200, 0, { shape: 'lifeline', destroyOffset: -3 }),
    createNode(null, 300, 0, { shape: 'lifeline', destroyOffset: 'nope' }),
  );
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  assert.equal(project.nodes[0].destroyOffset, 0.7);
  assert.equal(project.nodes[1].destroyOffset, 1);
  assert.equal(project.nodes[2].destroyOffset, 0);
  assert.equal(project.nodes[3].destroyOffset, null);
});

test('createNode defaults monthlyCost to null, and validateProject keeps a valid non-negative number or nulls out anything else', () => {
  const node = createNode(null, 0, 0, {});
  assert.equal(node.monthlyCost, null);

  const p = createEmptyProject();
  p.nodes.push(
    createNode(null, 0, 0, { monthlyCost: 45.5 }),
    createNode(null, 100, 0, { monthlyCost: 0 }),
    createNode(null, 200, 0, { monthlyCost: -10 }),
    createNode(null, 300, 0, { monthlyCost: 'nope' }),
    createNode(null, 400, 0, { monthlyCost: null }),
  );
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  assert.equal(project.nodes[0].monthlyCost, 45.5);
  assert.equal(project.nodes[1].monthlyCost, 0);
  assert.equal(project.nodes[2].monthlyCost, null);
  assert.equal(project.nodes[3].monthlyCost, null);
  assert.equal(project.nodes[4].monthlyCost, null);
});

test('createNode defaults iconImage to null, and validateProject keeps a well-formed data:image/... URL or nulls out anything else', () => {
  const node = createNode(null, 0, 0, {});
  assert.equal(node.iconImage, null);

  const p = createEmptyProject();
  p.nodes.push(
    createNode(null, 0, 0, { iconImage: 'data:image/png;base64,AAAA' }),
    createNode(null, 100, 0, { iconImage: 'not-a-data-url' }),
    createNode(null, 200, 0, { iconImage: 'data:text/plain;base64,AAAA' }),
    createNode(null, 300, 0, { iconImage: `data:image/png;base64,${'A'.repeat(800000)}` }),
    createNode(null, 400, 0, { iconImage: null }),
  );
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  assert.equal(project.nodes[0].iconImage, 'data:image/png;base64,AAAA');
  assert.equal(project.nodes[1].iconImage, null, 'not a data URL at all');
  assert.equal(project.nodes[2].iconImage, null, 'not an image MIME type');
  assert.equal(project.nodes[3].iconImage, null, 'over the size cap');
  assert.equal(project.nodes[4].iconImage, null);
});

test('createNode defaults activations to [], and validateProject clamps/normalizes/id-backfills each entry', () => {
  const node = createNode(null, 0, 0, { shape: 'lifeline' });
  assert.deepEqual(node.activations, []);

  const p = createEmptyProject();
  p.nodes.push(createNode(null, 0, 0, {
    shape: 'lifeline',
    activations: [
      { id: 'act_1', startOffset: 0.2, endOffset: 0.5 },
      { id: 'act_2', startOffset: 0.9, endOffset: 0.1 }, // swapped -> normalized
      { startOffset: 5, endOffset: -3 }, // out of range + missing id
      { startOffset: 'nope', endOffset: 0.5 }, // invalid -> dropped
      null, // garbage -> dropped
    ],
  }));
  const { ok, project } = validateProject(p);
  assert.ok(ok);
  const acts = project.nodes[0].activations;
  assert.equal(acts.length, 3);
  assert.deepEqual(acts[0], { id: 'act_1', startOffset: 0.2, endOffset: 0.5 });
  assert.deepEqual(acts[1], { id: 'act_2', startOffset: 0.1, endOffset: 0.9 });
  assert.equal(acts[2].startOffset, 0);
  assert.equal(acts[2].endOffset, 1);
  assert.ok(acts[2].id);
});

test('removeNode cascades to connected edges', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id));
  removeNode(p, n1.id);
  assert.equal(p.nodes.length, 1);
  assert.equal(p.edges.length, 0, 'edge referencing the removed node must be cascade-deleted');
});

test('removeEdge only removes the targeted edge', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  const e1 = createEdge(n1.id, n2.id);
  const e2 = createEdge(n2.id, n1.id);
  p.edges.push(e1, e2);
  removeEdge(p, e1.id);
  assert.equal(p.edges.length, 1);
  assert.equal(p.edges[0].id, e2.id);
});

test('nextZIndex increments above the current max', () => {
  const p = createEmptyProject();
  p.nodes.push(createNode(null, 0, 0, { zIndex: 5 }), createNode(null, 0, 0, { zIndex: 2 }));
  assert.equal(nextZIndex(p), 6);
});

test('validateProject rejects non-object input', () => {
  assert.equal(validateProject(null).ok, false);
  assert.equal(validateProject('a string').ok, false);
  assert.equal(validateProject({}).ok, false, 'missing nodes/edges arrays should fail');
});

test('validateProject accepts a well-formed project and fills in defaults for a minimal node', () => {
  const raw = {
    name: 'My Diagram',
    nodes: [{ id: 'n1', x: 5, y: 5 }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes.length, 1);
  assert.equal(result.project.nodes[0].w, 160, 'missing width should default');
  assert.equal(result.project.nodes[0].shape, 'rounded', 'missing/invalid shape should default');
});

test('validateProject drops edges referencing unknown nodes (no dangling references)', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }],
    edges: [{ id: 'e1', from: 'n1', to: 'does-not-exist' }],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.edges.length, 0);
});

test('validateProject clamps unknown enum values to safe defaults instead of throwing', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, shape: 'not-a-real-shape', textAlign: 'diagonal', textPosition: 'sideways', subComponentsDisplay: 'exploded' }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes[0].shape, 'rounded');
  assert.equal(result.project.nodes[0].textAlign, 'center');
  assert.equal(result.project.nodes[0].textPosition, 'center');
  assert.equal(result.project.nodes[0].subComponentsDisplay, 'chips');
});

test('validateProject preserves "lifeline" as a valid shape', () => {
  const raw = { nodes: [{ id: 'n1', x: 0, y: 0, shape: 'lifeline' }], edges: [] };
  const result = validateProject(raw);
  assert.equal(result.project.nodes[0].shape, 'lifeline');
});

test('validateProject preserves valid fromOffset/toOffset/notes, clamps an out-of-range offset, and defaults missing ones', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 100, y: 0 }, { id: 'n3', x: 200, y: 0 }],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', fromOffset: 0.2, toOffset: 0.9, notes: 'a note' },
      { id: 'e2', from: 'n2', to: 'n3', fromOffset: -5, toOffset: 50 },
      { id: 'e3', from: 'n1', to: 'n3' },
    ],
  };
  const result = validateProject(raw);
  assert.equal(result.project.edges[0].fromOffset, 0.2);
  assert.equal(result.project.edges[0].toOffset, 0.9);
  assert.equal(result.project.edges[0].notes, 'a note');
  assert.equal(result.project.edges[1].fromOffset, 0, 'clamped to 0');
  assert.equal(result.project.edges[1].toOffset, 1, 'clamped to 1');
  assert.equal(result.project.edges[2].fromOffset, 0.5, 'defaults to the midpoint when missing');
  assert.equal(result.project.edges[2].toOffset, 0.5);
  assert.equal(result.project.edges[2].notes, '', 'defaults to empty when missing');
});

test('validateProject preserves valid textPosition/iconVisible/subComponentsDisplay values', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, textPosition: 'below', iconVisible: false, subComponentsDisplay: 'full' }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.project.nodes[0].textPosition, 'below');
  assert.equal(result.project.nodes[0].iconVisible, false);
  assert.equal(result.project.nodes[0].subComponentsDisplay, 'full');
});

test('validateProject preserves a valid groupId and defaults a missing/invalid one to null', () => {
  const raw = {
    nodes: [
      { id: 'n1', x: 0, y: 0, groupId: 'group_abc' },
      { id: 'n2', x: 0, y: 0, groupId: 42 },
      { id: 'n3', x: 0, y: 0 },
    ],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.project.nodes[0].groupId, 'group_abc');
  assert.equal(result.project.nodes[1].groupId, null);
  assert.equal(result.project.nodes[2].groupId, null);
});

test('validateProject accepts "magic" as a valid edge routing', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 100, y: 0 }],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', routing: 'magic' }],
  };
  const result = validateProject(raw);
  assert.equal(result.project.edges[0].routing, 'magic');
});

test('validateProject never throws on malformed/malicious input', () => {
  const inputs = [undefined, 42, [], { nodes: 'not-array', edges: null }, { nodes: [null, 5, { id: 1 }], edges: [{}] }];
  for (const input of inputs) {
    assert.doesNotThrow(() => validateProject(input));
  }
});

test('duplicateProject clones the project under a new id/name, regenerating every node and edge id', () => {
  const p = createEmptyProject('Original');
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  p.edges.push(createEdge(n1.id, n2.id, { label: 'HTTPS' }));

  const copy = duplicateProject(p);

  assert.notEqual(copy.id, p.id);
  assert.equal(copy.name, 'Original (Copy)');
  assert.equal(copy.nodes.length, 2);
  assert.equal(copy.edges.length, 1);
  assert.notEqual(copy.nodes[0].id, n1.id);
  assert.notEqual(copy.nodes[1].id, n2.id);
  assert.equal(copy.edges[0].from, copy.nodes[0].id, 'the cloned edge should reference the cloned node ids, not the originals');
  assert.equal(copy.edges[0].to, copy.nodes[1].id);
  assert.equal(copy.edges[0].label, 'HTTPS', 'other edge fields carry over unchanged');
});

test('duplicateProject regenerates sub-component ids and remaps groupId so the copy forms its own group', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0, { groupId: 'group_x', subComponents: [{ id: 'sc_1', name: 'Auth', icon: '🔐' }] });
  const n2 = createNode(null, 100, 0, { groupId: 'group_x' });
  p.nodes.push(n1, n2);

  const copy = duplicateProject(p);

  assert.notEqual(copy.nodes[0].groupId, 'group_x');
  assert.equal(copy.nodes[0].groupId, copy.nodes[1].groupId, 'both copied nodes should share the same new group id');
  assert.notEqual(copy.nodes[0].subComponents[0].id, 'sc_1');
  assert.equal(copy.nodes[0].subComponents[0].name, 'Auth');
});

test('duplicateProject remaps a replication pair\'s edgeMembers to the newly-regenerated edge ids', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0, { groupId: 'gA' });
  const n2 = createNode(null, 300, 0, { groupId: 'gA' });
  const n3 = createNode(null, 0, 200, { groupId: 'gB' });
  const n4 = createNode(null, 300, 200, { groupId: 'gB' });
  p.nodes.push(n1, n2, n3, n4);
  const eA = createEdge(n1.id, n2.id, { label: 'call' });
  const eB = createEdge(n3.id, n4.id, { label: 'call' });
  p.edges.push(eA, eB);
  p.replicationPairs.push({
    id: 'repl_1', mode: 'active-active', groupA: 'gA', groupB: 'gB', offsetX: 300, offsetY: 0,
    members: [{ a: n1.id, b: n3.id }, { a: n2.id, b: n4.id }],
    edgeMembers: [{ a: eA.id, b: eB.id }],
    frozen: false,
  });

  const copy = duplicateProject(p);
  const pair = copy.replicationPairs[0];
  assert.equal(pair.edgeMembers.length, 1);
  assert.notEqual(pair.edgeMembers[0].a, eA.id, 'edge ids should be regenerated, not reused');
  assert.notEqual(pair.edgeMembers[0].b, eB.id);
  assert.ok(copy.edges.some((e) => e.id === pair.edgeMembers[0].a));
  assert.ok(copy.edges.some((e) => e.id === pair.edgeMembers[0].b));
});

test('duplicateProject leaves the original project completely untouched', () => {
  const p = createEmptyProject('Original');
  const n1 = createNode(null, 0, 0);
  p.nodes.push(n1);
  const originalId = p.id;
  const originalNodeId = n1.id;

  duplicateProject(p);

  assert.equal(p.id, originalId);
  assert.equal(p.nodes[0].id, originalNodeId);
  assert.equal(p.name, 'Original');
});

test('validateProject backfills a missing/invalid node or edge id instead of dropping it', () => {
  const raw = {
    nodes: [{ x: 0, y: 0, text: 'No id' }, { id: 42, x: 100, y: 0, text: 'Numeric id' }],
    edges: [],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes.length, 2, 'both nodes should be kept, not dropped');
  assert.equal(typeof result.project.nodes[0].id, 'string');
  assert.ok(result.project.nodes[0].id.length > 0);
  assert.notEqual(result.project.nodes[1].id, 42, 'a non-string id should be replaced, not left as-is');

  const raw2 = {
    nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 100, y: 0 }],
    edges: [{ from: 'n1', to: 'n2', label: 'calls' }], // no id
  };
  const result2 = validateProject(raw2);
  assert.equal(result2.project.edges.length, 1, 'an edge missing only its id should be kept');
  assert.equal(typeof result2.project.edges[0].id, 'string');
  assert.ok(result2.project.edges[0].id.length > 0);
});

test('createEmptyProject and createNode default to an empty/unexcluded replication state', () => {
  const p = createEmptyProject();
  assert.deepEqual(p.replicationPairs, []);
  const node = createNode(null, 0, 0);
  assert.equal(node.replicationExcluded, false);
});

test('validateProject keeps a well-formed replicationPairs entry, backfilling a missing id', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, groupId: 'gA' }, { id: 'n2', x: 300, y: 0, groupId: 'gB' }],
    edges: [],
    replicationPairs: [{ mode: 'active-passive', groupA: 'gA', groupB: 'gB', offsetX: 300, offsetY: 0, members: [{ a: 'n1', b: 'n2' }] }],
  };
  const result = validateProject(raw);
  assert.equal(result.ok, true);
  assert.equal(result.project.replicationPairs.length, 1);
  const pair = result.project.replicationPairs[0];
  assert.equal(typeof pair.id, 'string');
  assert.ok(pair.id.length > 0);
  assert.equal(pair.mode, 'active-passive');
  assert.equal(pair.members.length, 1);
  assert.equal(pair.frozen, false, 'missing frozen should default to false');
});

test('validateProject preserves a well-formed edgeMembers entry and drops one referencing an unknown edge id', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, groupId: 'gA' }, { id: 'n2', x: 300, y: 0, groupId: 'gB' }],
    edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
    replicationPairs: [{
      groupA: 'gA', groupB: 'gB', members: [{ a: 'n1', b: 'n2' }],
      edgeMembers: [{ a: 'e1', b: 'e1' }, { a: 'e1', b: 'no-such-edge' }],
    }],
  };
  const result = validateProject(raw);
  const pair = result.project.replicationPairs[0];
  assert.equal(pair.edgeMembers.length, 1, 'only the entry whose both ids resolve to real edges survives');
  assert.deepEqual(pair.edgeMembers[0], { a: 'e1', b: 'e1' });
});

test('validateProject defaults edgeMembers to an empty array when missing', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, groupId: 'gA' }, { id: 'n2', x: 300, y: 0, groupId: 'gB' }],
    edges: [],
    replicationPairs: [{ groupA: 'gA', groupB: 'gB', members: [] }],
  };
  const result = validateProject(raw);
  assert.deepEqual(result.project.replicationPairs[0].edgeMembers, []);
});

test('validateProject preserves an explicit frozen:true on a replication pair', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0, groupId: 'gA' }, { id: 'n2', x: 300, y: 0, groupId: 'gB' }],
    edges: [],
    replicationPairs: [{ groupA: 'gA', groupB: 'gB', members: [], frozen: true }],
  };
  const result = validateProject(raw);
  assert.equal(result.project.replicationPairs[0].frozen, true);
});

test('validateProject drops a replication pair with equal/missing groupA-groupB, and clamps an unknown mode', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }],
    edges: [],
    replicationPairs: [
      { groupA: 'same', groupB: 'same', members: [] }, // groupA === groupB -> nonsensical, dropped
      { groupA: '', groupB: 'gB', members: [] }, // missing groupA -> dropped
      { groupA: 'gA', groupB: 'gB', mode: 'not-a-real-mode', members: [] }, // kept, mode clamped
    ],
  };
  const result = validateProject(raw);
  assert.equal(result.project.replicationPairs.length, 1);
  assert.equal(result.project.replicationPairs[0].mode, 'active-active');
});

test('validateProject drops a replication pair member referencing a node id that does not exist', () => {
  const raw = {
    nodes: [{ id: 'n1', x: 0, y: 0 }],
    edges: [],
    replicationPairs: [{ groupA: 'gA', groupB: 'gB', members: [{ a: 'n1', b: 'does-not-exist' }] }],
  };
  const result = validateProject(raw);
  assert.equal(result.project.replicationPairs[0].members.length, 0);
});

test('validateProject never throws on a malformed replicationPairs value', () => {
  for (const bad of [null, 'nope', 42, [null, 5, {}], [{ groupA: 1, groupB: 2 }]]) {
    assert.doesNotThrow(() => validateProject({ nodes: [], edges: [], replicationPairs: bad }));
  }
});

test('duplicateProject remaps a replication pair\'s groups/members to the freshly-cloned ids', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0, { groupId: 'gA' });
  const n2 = createNode(null, 300, 0, { groupId: 'gB' });
  p.nodes.push(n1, n2);
  p.replicationPairs.push({ id: 'repl_1', mode: 'active-active', groupA: 'gA', groupB: 'gB', offsetX: 300, offsetY: 0, members: [{ a: n1.id, b: n2.id }], frozen: true });

  const copy = duplicateProject(p);

  assert.equal(copy.replicationPairs.length, 1);
  const pair = copy.replicationPairs[0];
  assert.notEqual(pair.id, 'repl_1');
  assert.equal(pair.groupA, copy.nodes[0].groupId);
  assert.equal(pair.groupB, copy.nodes[1].groupId);
  assert.equal(pair.members[0].a, copy.nodes[0].id);
  assert.equal(pair.members[0].b, copy.nodes[1].id);
  assert.equal(pair.frozen, true, 'frozen state should carry over into the copy');
});

test('duplicateProject drops a replication pair whose group has no surviving members', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0, { groupId: 'gA' });
  p.nodes.push(n1);
  // groupB never appears on any node — an orphaned pair reference.
  p.replicationPairs.push({ id: 'repl_1', mode: 'active-active', groupA: 'gA', groupB: 'gB', offsetX: 300, offsetY: 0, members: [] });

  const copy = duplicateProject(p);
  assert.equal(copy.replicationPairs.length, 0);
});

test('duplicateProject starts with a clean version/presentation history rather than carrying the original\'s', () => {
  const p = createEmptyProject();
  p.nodes.push(createNode(null, 0, 0, {}));
  p.versions.push(createVersionSnapshot(p, 'v1'));
  p.presentations.push({ id: 'pres_1', name: 'Talk', createdAt: new Date().toISOString(), slides: [{ versionId: p.versions[0].id, title: '', notes: '' }] });

  const copy = duplicateProject(p);
  assert.deepEqual(copy.versions, []);
  assert.deepEqual(copy.presentations, []);
});

test('createVersionSnapshot deep-clones current content so later edits to the live project do not retroactively change it', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0, { text: 'Original' });
  p.nodes.push(n1);

  const version = createVersionSnapshot(p, 'v1');
  assert.equal(version.name, 'v1');
  assert.ok(version.id.startsWith('ver_'));
  assert.equal(version.snapshot.nodes.length, 1);
  assert.equal(version.snapshot.nodes[0].text, 'Original');

  // Mutate the "live" project's node after the snapshot was taken.
  p.nodes[0].text = 'Changed';
  assert.equal(version.snapshot.nodes[0].text, 'Original', 'the version must not share object identity with the live node');
});

test('createVersionSnapshot defaults to an auto-numbered name when none is given', () => {
  const p = createEmptyProject();
  const v1 = createVersionSnapshot(p, '');
  assert.equal(v1.name, 'Version 1');
  p.versions.push(v1);
  const v2 = createVersionSnapshot(p, '   ');
  assert.equal(v2.name, 'Version 2');
});

test('removeVersion deletes the version and strips it from any presentation slide that referenced it', () => {
  const p = createEmptyProject();
  const v1 = createVersionSnapshot(p, 'v1');
  p.versions.push(v1);
  const v2 = createVersionSnapshot(p, 'v2');
  p.versions.push(v2);
  p.presentations.push({
    id: 'pres_1',
    name: 'Talk',
    createdAt: new Date().toISOString(),
    slides: [{ versionId: v1.id, title: 'Slide 1', notes: '' }, { versionId: v2.id, title: 'Slide 2', notes: '' }],
  });

  removeVersion(p, v1.id);

  assert.equal(p.versions.length, 1);
  assert.equal(p.versions[0].id, v2.id);
  assert.equal(p.presentations[0].slides.length, 1);
  assert.equal(p.presentations[0].slides[0].versionId, v2.id);
});

test('validateProject backfills/validates a stored version\'s own snapshot the same way it does the top-level project', () => {
  const raw = {
    nodes: [],
    edges: [],
    versions: [
      {
        // missing id/name/createdAt on purpose
        snapshot: {
          nodes: [{ text: 'From a version', x: 5, y: 5 }], // missing id, on purpose
          edges: [],
        },
      },
    ],
  };
  const { ok, project } = validateProject(raw);
  assert.ok(ok);
  assert.equal(project.versions.length, 1);
  const v = project.versions[0];
  assert.ok(v.id.startsWith('ver_'));
  assert.equal(v.name, 'Version');
  assert.equal(v.snapshot.nodes.length, 1);
  assert.ok(v.snapshot.nodes[0].id.startsWith('node_'), 'a missing id inside a version snapshot should be backfilled just like a top-level node');
});

test('validateProject drops a version with no usable snapshot object', () => {
  const raw = { nodes: [], edges: [], versions: [{ id: 'ver_x', name: 'bad' }, null, 'not an object'] };
  const { project } = validateProject(raw);
  assert.deepEqual(project.versions, []);
});

test('validateProject keeps a presentation slide that points at a real version, and drops one that points at a missing version', () => {
  const raw = {
    nodes: [],
    edges: [],
    versions: [{ id: 'ver_real', name: 'Real', createdAt: new Date().toISOString(), snapshot: { nodes: [], edges: [] } }],
    presentations: [
      {
        id: 'pres_1',
        name: 'Talk',
        slides: [
          { versionId: 'ver_real', title: 'Kept' },
          { versionId: 'ver_missing', title: 'Dropped' },
        ],
      },
    ],
  };
  const { project } = validateProject(raw);
  assert.equal(project.presentations.length, 1);
  assert.equal(project.presentations[0].slides.length, 1);
  assert.equal(project.presentations[0].slides[0].title, 'Kept');
});

test('validateProject defaults versions/presentations to empty arrays when absent from the input', () => {
  const { project } = validateProject({ nodes: [], edges: [] });
  assert.deepEqual(project.versions, []);
  assert.deepEqual(project.presentations, []);
});

test('createEmptyProject starts with an empty comments array', () => {
  const p = createEmptyProject();
  assert.deepEqual(p.comments, []);
});

test('createComment builds a pin with the expected shape, unresolved by default', () => {
  const c = createComment(50, 60, 'Check this flow');
  assert.equal(c.x, 50);
  assert.equal(c.y, 60);
  assert.equal(c.text, 'Check this flow');
  assert.equal(c.resolved, false);
  assert.ok(c.id);
  assert.ok(c.createdAt);
});

test('createComment defaults text to an empty string', () => {
  const c = createComment(0, 0);
  assert.equal(c.text, '');
});

test('createComment starts with an empty replies array', () => {
  const c = createComment(0, 0, 'note');
  assert.deepEqual(c.replies, []);
});

test('createReply builds a reply with the expected shape', () => {
  const r = createReply('Use a queue here');
  assert.equal(r.text, 'Use a queue here');
  assert.ok(r.id);
  assert.ok(r.createdAt);
});

test('countUnresolvedComments counts only unresolved comments', () => {
  const resolved = { ...createComment(0, 0, 'a'), resolved: true };
  const unresolvedOne = createComment(1, 1, 'b');
  const unresolvedTwo = createComment(2, 2, 'c');
  assert.equal(countUnresolvedComments([resolved, unresolvedOne, unresolvedTwo]), 2);
});

test('countUnresolvedComments handles an empty/missing array without throwing', () => {
  assert.equal(countUnresolvedComments([]), 0);
  assert.equal(countUnresolvedComments(undefined), 0);
  assert.equal(countUnresolvedComments(null), 0);
});

test('validateProject keeps well-formed comments and drops one missing x/y', () => {
  const raw = {
    nodes: [],
    edges: [],
    comments: [
      { id: 'c1', x: 10, y: 20, text: 'Hello', resolved: true },
      { x: 'nope', y: 5, text: 'Bad position' },
      { id: 'c3', x: 1, y: 2 },
    ],
  };
  const { ok, project } = validateProject(raw);
  assert.ok(ok);
  assert.equal(project.comments.length, 2);
  assert.equal(project.comments[0].text, 'Hello');
  assert.equal(project.comments[0].resolved, true);
  assert.equal(project.comments[1].id, 'c3');
  assert.equal(project.comments[1].text, '', 'missing text defaults to empty string');
  assert.equal(project.comments[1].resolved, false, 'missing resolved defaults to false');
});

test('validateProject defaults comments to an empty array when absent or malformed', () => {
  assert.deepEqual(validateProject({ nodes: [], edges: [] }).project.comments, []);
  assert.deepEqual(validateProject({ nodes: [], edges: [], comments: 'not-an-array' }).project.comments, []);
});

test('validateProject keeps well-formed replies and backfills a missing id, dropping a malformed entry', () => {
  const raw = {
    nodes: [],
    edges: [],
    comments: [
      { id: 'c1', x: 0, y: 0, text: 'Thread', replies: [
        { text: 'Reply with id', id: 'r1', createdAt: '2024-01-01T00:00:00.000Z' },
        { text: 'Reply missing id' },
        { notAText: true },
        'garbage',
      ] },
    ],
  };
  const { project } = validateProject(raw);
  const replies = project.comments[0].replies;
  assert.equal(replies.length, 2);
  assert.equal(replies[0].id, 'r1');
  assert.equal(replies[0].createdAt, '2024-01-01T00:00:00.000Z');
  assert.ok(replies[1].id, 'a missing reply id gets backfilled rather than dropping the reply');
  assert.equal(replies[1].text, 'Reply missing id');
});

test('validateProject migrates a pre-threaded-replies comment (no replies field) to an empty array', () => {
  const { project } = validateProject({ nodes: [], edges: [], comments: [{ id: 'c1', x: 0, y: 0, text: 'Old comment' }] });
  assert.deepEqual(project.comments[0].replies, []);
});

test('duplicateProject regenerates comment ids but keeps their content, including replies', () => {
  const p = createEmptyProject();
  const comment = createComment(10, 20, 'Original note');
  comment.replies.push(createReply('First reply'));
  p.comments.push(comment);
  const copy = duplicateProject(p);
  assert.equal(copy.comments.length, 1);
  assert.notEqual(copy.comments[0].id, p.comments[0].id);
  assert.equal(copy.comments[0].text, 'Original note');
  assert.equal(copy.comments[0].x, 10);
  assert.equal(copy.comments[0].y, 20);
  assert.equal(copy.comments[0].replies.length, 1);
  assert.equal(copy.comments[0].replies[0].text, 'First reply');
  assert.notEqual(copy.comments[0].replies[0].id, p.comments[0].replies[0].id);
});

test('createEmptyProject includes an empty animations array and no active animation', () => {
  const p = createEmptyProject();
  assert.deepEqual(p.animations, []);
  assert.equal(p.activeAnimationId, null);
});

test('createAnimationStep normalizes a single target into a one-element array, and defaults revealMode/delayMs/notes', () => {
  const step = createAnimationStep({ targetType: 'node', targetId: 'node_1' });
  assert.deepEqual(step.targets, [{ targetType: 'node', targetId: 'node_1' }]);
  assert.equal(step.revealMode, 'click');
  assert.equal(step.delayMs, 2000);
  assert.equal(step.notes, '');
  assert.ok(step.id.startsWith('anim_'));
});

test('createAnimationStep accepts an array of targets for a "reveal together" group', () => {
  const step = createAnimationStep([{ targetType: 'node', targetId: 'a' }, { targetType: 'edge', targetId: 'b' }]);
  assert.equal(step.targets.length, 2);
});

test('createAnimation defaults name, empty steps, and autoFocus false', () => {
  const a = createAnimation('My Animation');
  assert.equal(a.name, 'My Animation');
  assert.deepEqual(a.steps, []);
  assert.equal(a.autoFocus, false);
  assert.ok(a.id.startsWith('animset_'));
});

test('validateProject keeps a well-formed animation (grouped step, notes, autoFocus), backfilling missing ids', () => {
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  const e1 = createEdge(n1.id, n2.id);
  const result = validateProject({
    nodes: [n1, n2],
    edges: [e1],
    animations: [
      {
        name: 'Walkthrough',
        autoFocus: true,
        steps: [
          { targets: [{ targetType: 'node', targetId: n1.id }, { targetType: 'edge', targetId: e1.id }], revealMode: 'auto', delayMs: 1500, notes: 'Say hello' },
          { id: 'anim_keep', targets: [{ targetType: 'node', targetId: n2.id }], revealMode: 'click', delayMs: 500 },
        ],
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.project.animations.length, 1);
  const anim = result.project.animations[0];
  assert.equal(anim.name, 'Walkthrough');
  assert.equal(anim.autoFocus, true);
  assert.equal(anim.steps.length, 2);
  assert.ok(anim.steps[0].id, 'a missing id is backfilled rather than dropping the step');
  assert.equal(anim.steps[0].targets.length, 2);
  assert.equal(anim.steps[0].revealMode, 'auto');
  assert.equal(anim.steps[0].delayMs, 1500);
  assert.equal(anim.steps[0].notes, 'Say hello');
  assert.equal(anim.steps[1].id, 'anim_keep');
  assert.equal(result.project.activeAnimationId, anim.id);
});

test('validateProject drops a target referencing a node/edge that does not exist, dropping the whole step once empty, and clamps invalid revealMode/delayMs/notes', () => {
  const n1 = createNode(null, 0, 0);
  const result = validateProject({
    nodes: [n1],
    edges: [],
    animations: [{
      name: 'A',
      steps: [
        { targets: [{ targetType: 'node', targetId: n1.id }], revealMode: 'bogus', delayMs: -5, notes: 42 },
        { targets: [{ targetType: 'node', targetId: 'no-such-node' }], revealMode: 'auto', delayMs: 1000 },
        { targets: [{ targetType: 'edge', targetId: 'no-such-edge' }], revealMode: 'auto', delayMs: 1000 },
        { targets: [{ targetType: 'nonsense', targetId: n1.id }] },
        { targets: [{ targetType: 'node', targetId: n1.id }, { targetType: 'node', targetId: 'no-such-node' }] },
      ],
    }],
  });
  assert.equal(result.ok, true);
  const steps = result.project.animations[0].steps;
  assert.equal(steps.length, 2, 'only steps with at least one surviving target survive');
  assert.equal(steps[0].revealMode, 'click', 'an invalid revealMode falls back to the default');
  assert.equal(steps[0].delayMs, 2000, 'a non-positive delayMs falls back to the default');
  assert.equal(steps[0].notes, '', 'a non-string notes value falls back to empty');
  assert.equal(steps[1].targets.length, 1, 'a grouped step keeps its surviving target and drops the missing one');
});

test('validateProject migrates a legacy flat animationSteps array into one "Animation 1"', () => {
  const n1 = createNode(null, 0, 0);
  const result = validateProject({
    nodes: [n1],
    edges: [],
    animationSteps: [
      { targetType: 'node', targetId: n1.id, revealMode: 'auto', delayMs: 1500 },
      { targetType: 'node', targetId: 'no-such-node', revealMode: 'click', delayMs: 2000 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.project.animations.length, 1);
  const anim = result.project.animations[0];
  assert.equal(anim.name, 'Animation 1');
  assert.equal(anim.steps.length, 1, 'the step referencing a missing node is dropped');
  assert.deepEqual(anim.steps[0].targets, [{ targetType: 'node', targetId: n1.id }]);
  assert.equal(result.project.activeAnimationId, anim.id);
});

test('validateProject falls back activeAnimationId to the first animation when the given id does not resolve', () => {
  const n1 = createNode(null, 0, 0);
  const result = validateProject({
    nodes: [n1],
    edges: [],
    activeAnimationId: 'nonexistent',
    animations: [{ name: 'A', steps: [{ targets: [{ targetType: 'node', targetId: n1.id }] }] }],
  });
  assert.equal(result.project.activeAnimationId, result.project.animations[0].id);
});

test('removeNode strips just the removed node from a grouped step, dropping the step only once every target is gone, across every animation', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  const n3 = createNode(null, 200, 0);
  p.nodes.push(n1, n2, n3);
  const e1 = createEdge(n1.id, n2.id);
  p.edges.push(e1);
  p.animations.push(
    createAnimation('A', { steps: [
      createAnimationStep([{ targetType: 'node', targetId: n1.id }, { targetType: 'node', targetId: n3.id }]), // survives: n3 remains
      createAnimationStep({ targetType: 'edge', targetId: e1.id }), // dropped: cascade-deleted edge
    ] }),
    createAnimation('B', { steps: [createAnimationStep({ targetType: 'node', targetId: n1.id })] }), // dropped entirely
  );
  removeNode(p, n1.id);
  assert.equal(p.animations[0].steps.length, 1);
  assert.deepEqual(p.animations[0].steps[0].targets, [{ targetType: 'node', targetId: n3.id }]);
  assert.equal(p.animations[1].steps.length, 0, 'animation B\'s only step is gone, but the animation itself is kept');
});

test('removeEdge drops only the step referencing that edge', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  const e1 = createEdge(n1.id, n2.id);
  const e2 = createEdge(n2.id, n1.id);
  p.edges.push(e1, e2);
  p.animations.push(createAnimation('A', { steps: [
    createAnimationStep({ targetType: 'edge', targetId: e1.id }),
    createAnimationStep({ targetType: 'edge', targetId: e2.id }),
  ] }));
  removeEdge(p, e1.id);
  assert.equal(p.animations[0].steps.length, 1);
  assert.deepEqual(p.animations[0].steps[0].targets, [{ targetType: 'edge', targetId: e2.id }]);
});

test('duplicateProject remaps every animation\'s step targets onto the copy\'s fresh ids, and follows activeAnimationId to its own remapped id', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  const e1 = createEdge(n1.id, n2.id);
  p.edges.push(e1);
  const animation = createAnimation('A', { steps: [
    createAnimationStep([{ targetType: 'node', targetId: n1.id }, { targetType: 'edge', targetId: e1.id }], { revealMode: 'auto', delayMs: 3000 }),
  ] });
  p.animations.push(animation);
  p.activeAnimationId = animation.id;

  const copy = duplicateProject(p);
  assert.equal(copy.animations.length, 1);
  assert.notEqual(copy.animations[0].id, animation.id);
  assert.equal(copy.activeAnimationId, copy.animations[0].id);
  const step = copy.animations[0].steps[0];
  assert.notEqual(step.id, animation.steps[0].id);
  assert.equal(step.revealMode, 'auto');
  assert.equal(step.delayMs, 3000);
  assert.deepEqual(step.targets, [
    { targetType: 'node', targetId: copy.nodes[0].id },
    { targetType: 'edge', targetId: copy.edges[0].id },
  ]);
});

test('duplicateProject drops a step whose only target did not survive the copy, keeping the (now-emptier) animation', () => {
  const p = createEmptyProject();
  const n1 = createNode(null, 0, 0);
  const n2 = createNode(null, 100, 0);
  p.nodes.push(n1, n2);
  const danglingEdge = createEdge(n1.id, n2.id);
  // Not pushed into p.edges — simulates a since-deleted edge an older
  // build's animation step still references.
  p.animations.push(createAnimation('A', { steps: [createAnimationStep({ targetType: 'edge', targetId: danglingEdge.id })] }));
  const copy = duplicateProject(p);
  assert.equal(copy.animations.length, 1);
  assert.deepEqual(copy.animations[0].steps, []);
});
