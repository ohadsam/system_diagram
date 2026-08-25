import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProject, createNode, createEdge, removeNode, removeEdge, validateProject, nextZIndex, duplicateProject,
} from '../../js/core/project.js';

test('createEmptyProject has the expected shape', () => {
  const p = createEmptyProject('Test');
  assert.equal(p.name, 'Test');
  assert.equal(p.nodes.length, 0);
  assert.equal(p.edges.length, 0);
  assert.equal(p.viewport.zoom, 1);
  assert.ok(p.id.startsWith('proj_'));
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
