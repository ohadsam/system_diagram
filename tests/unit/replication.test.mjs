import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncReplication, buildReplicationPair } from '../../js/core/replication.js';
import { createEmptyProject, createNode, createEdge } from '../../js/core/project.js';

function mkNode(id, groupId, x = 0, y = 0, overrides = {}) {
  return { ...createNode(null, x, y, { groupId, ...overrides }), id };
}

function setupPair(nodeSpecs, mode = 'active-active') {
  const project = createEmptyProject();
  project.nodes = nodeSpecs.map((s) => mkNode(s.id, null, s.x ?? 0, s.y ?? 0, s.overrides ?? {}));
  const built = buildReplicationPair(project.nodes, nodeSpecs.map((s) => s.id), mode);
  project.nodes = project.nodes.map((n) => (built.regroupNodeIds.includes(n.id) ? { ...n, groupId: built.groupA } : n));
  project.nodes.push(...built.mirrorNodes);
  project.replicationPairs.push(built.pair);
  return { project, built };
}

test('buildReplicationPair mirrors every selected node offset to the right, preserving content', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', null, 0, 0, { text: 'App', w: 160 }), mkNode('n2', null, 0, 200, { text: 'DB', w: 160 })];
  const built = buildReplicationPair(project.nodes, ['n1', 'n2'], 'active-passive');

  assert.equal(built.pair.mode, 'active-passive');
  assert.equal(built.mirrorNodes.length, 2);
  assert.equal(built.pair.members.length, 2);
  assert.equal(built.mirrorNodes[0].text, 'App');
  assert.equal(built.mirrorNodes[0].groupId, built.pair.groupB);
  assert.equal(built.mirrorNodes[0].x, 0 + built.pair.offsetX);
  assert.ok(built.pair.offsetX > 160, 'offset should clear the widest selected node plus a gap');
});

test('buildReplicationPair skips excluded nodes entirely (no mirror, not a member)', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', null, 0, 0), mkNode('n2', null, 0, 200, { replicationExcluded: true })];
  const built = buildReplicationPair(project.nodes, ['n1', 'n2'], 'active-active');
  assert.equal(built.mirrorNodes.length, 1);
  assert.equal(built.pair.members.length, 1);
  assert.equal(built.pair.members[0].a, 'n1');
});

test('buildReplicationPair reuses an existing common groupId instead of minting a new one', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', 'group_x', 0, 0), mkNode('n2', 'group_x', 0, 200)];
  const built = buildReplicationPair(project.nodes, ['n1', 'n2'], 'active-active');
  assert.equal(built.groupA, 'group_x');
  assert.deepEqual(built.regroupNodeIds, []);
});

test('buildReplicationPair returns null for an empty selection', () => {
  assert.equal(buildReplicationPair([], [], 'active-active'), null);
});

test('syncReplication is a no-op when the project has no replication pairs', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', null)];
  const result = syncReplication(project, project);
  assert.equal(result, project);
});

test('syncReplication mirrors a new node added to side A onto side B', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const withNew = { ...project, nodes: [...project.nodes, mkNode('n3', built.groupA, 0, 400, { text: 'Cache' })] };
  const synced = syncReplication(project, withNew);

  assert.equal(synced.nodes.length, 4); // n1 + its mirror + n3 + n3's new mirror
  assert.equal(synced.replicationPairs[0].members.length, 2);
  const n3Mirror = synced.nodes.find((n) => n.text === 'Cache' && n.groupId === built.pair.groupB);
  assert.ok(n3Mirror, 'the new node should have a mirror on side B');
  assert.equal(n3Mirror.x, 0 + built.pair.offsetX);
});

test('syncReplication "detects the existing state" on a self-diff (e.g. right after loadProject)', () => {
  // Simulate a hand-edited/imported project where side A already has an
  // extra, never-mirrored node sitting in its group.
  const { project, built } = setupPair([{ id: 'n1' }]);
  const imported = { ...project, nodes: [...project.nodes, mkNode('n9', built.groupA, 50, 50, { text: 'Imported' })] };
  const synced = syncReplication(imported, imported); // self-diff, like store.loadProject does
  assert.equal(synced.nodes.length, 4);
  assert.ok(synced.nodes.some((n) => n.text === 'Imported' && n.groupId === built.pair.groupB));
});

test('syncReplication propagates a content change from the side that actually changed', () => {
  const { project, built } = setupPair([{ id: 'n1', overrides: { text: 'Original' } }]);
  const edited = { ...project, nodes: project.nodes.map((n) => (n.id === 'n1' ? { ...n, text: 'Renamed', fill: '#FF0000' } : n)) };
  const synced = syncReplication(project, edited);

  const mirrorId = synced.replicationPairs[0].members[0].b;
  const mirror = synced.nodes.find((n) => n.id === mirrorId);
  assert.equal(mirror.text, 'Renamed');
  assert.equal(mirror.fill, '#FF0000');
});

test('syncReplication propagates a position change via the pair\'s constant offset, in either direction', () => {
  const { project, built } = setupPair([{ id: 'n1', x: 0, y: 0 }]);
  const moved = { ...project, nodes: project.nodes.map((n) => (n.id === 'n1' ? { ...n, x: 300, y: 40 } : n)) };
  let synced = syncReplication(project, moved);
  const mirrorId = synced.replicationPairs[0].members[0].b;
  let mirror = synced.nodes.find((n) => n.id === mirrorId);
  assert.equal(mirror.x, 300 + built.pair.offsetX);
  assert.equal(mirror.y, 40);

  // now move the mirror (side B) itself — should propagate back to n1
  const movedBack = { ...synced, nodes: synced.nodes.map((n) => (n.id === mirrorId ? { ...n, x: 900, y: 90 } : n)) };
  synced = syncReplication(synced, movedBack);
  const n1After = synced.nodes.find((n) => n.id === 'n1');
  assert.equal(n1After.x, 900 - built.pair.offsetX);
  assert.equal(n1After.y, 90);
});

test('syncReplication does not propagate when both sides changed identically in the same pass (tie)', () => {
  const { project } = setupPair([{ id: 'n1' }]);
  const bothEdited = { ...project, nodes: project.nodes.map((n) => ({ ...n, stroke: '#00FF00' })) };
  const synced = syncReplication(project, bothEdited);
  assert.equal(synced.nodes.length, 2, 'no extra nodes should be created on a tie');
  assert.ok(synced.nodes.every((n) => n.stroke === '#00FF00'));
});

test('syncReplication cascade-deletes a member\'s mirror when the member is structurally deleted', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const n1MirrorId = built.pair.members.find((m) => m.a === 'n1').b;
  const afterDelete = { ...project, nodes: project.nodes.filter((n) => n.id !== 'n1') };
  const synced = syncReplication(project, afterDelete);

  assert.equal(synced.nodes.length, 2, 'n1 and its mirror should both be gone, n2 and its mirror remain');
  assert.equal(synced.replicationPairs[0].members.length, 1);
  assert.ok(!synced.nodes.some((n) => n.id === n1MirrorId), "n1's mirror must be gone too");
  assert.ok(synced.nodes.some((n) => n.id === 'n2'), 'n2 (unrelated member) must survive');
});

test('syncReplication cleans up an edge attached to a cascade-deleted mirror, like an ordinary delete would', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'other' }]);
  const n1MirrorId = built.pair.members.find((m) => m.a === 'n1').b;
  const otherMirrorId = built.pair.members.find((m) => m.a === 'other').b;
  // The user connected the two mirrors to each other directly.
  const withEdge = { ...project, edges: [createEdge(n1MirrorId, otherMirrorId, { id: 'e1' })] };

  const afterDelete = { ...withEdge, nodes: withEdge.nodes.filter((n) => n.id !== 'n1') };
  const synced = syncReplication(withEdge, afterDelete);

  assert.ok(!synced.nodes.some((n) => n.id === n1MirrorId), "n1's mirror should be cascade-deleted");
  assert.equal(synced.edges.length, 0, 'the edge referencing the deleted mirror must be cleaned up too, not left dangling');
});

test('syncReplication leaves edges alone when nothing was deleted', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const withEdge = { ...project, edges: [createEdge('n1', built.pair.members[0].b, { id: 'e1' })] };
  const renamed = { ...withEdge, nodes: withEdge.nodes.map((n) => (n.id === 'n1' ? { ...n, text: 'Renamed' } : n)) };
  const synced = syncReplication(withEdge, renamed);
  assert.equal(synced.edges.length, 1);
  assert.equal(synced.edges[0].id, 'e1');
});

test('syncReplication severs the link on exclusion WITHOUT deleting the peer, and freezes the peer too', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const excluded = { ...project, nodes: project.nodes.map((n) => (n.id === 'n1' ? { ...n, replicationExcluded: true } : n)) };
  const synced = syncReplication(project, excluded);

  assert.equal(synced.nodes.length, 2, 'both nodes must still exist');
  assert.equal(synced.replicationPairs[0].members.length, 0, 'the link should be dropped');
  const peer = synced.nodes.find((n) => n.groupId === built.pair.groupB);
  assert.equal(peer.replicationExcluded, true, 'the orphaned peer should be frozen out too, or it would be re-adopted as a "new" member next pass');
});

test('syncReplication severs the link when a member is moved to a different group, without deleting either node', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const regrouped = { ...project, nodes: project.nodes.map((n) => (n.id === 'n1' ? { ...n, groupId: 'some_other_group' } : n)) };
  const synced = syncReplication(project, regrouped);

  assert.equal(synced.nodes.length, 2);
  assert.equal(synced.replicationPairs[0].members.length, 0);
});

test('syncReplication does not re-adopt a frozen/excluded peer on the very next pass', () => {
  const { project } = setupPair([{ id: 'n1' }]);
  const excluded = { ...project, nodes: project.nodes.map((n) => (n.id === 'n1' ? { ...n, replicationExcluded: true } : n)) };
  const afterExclude = syncReplication(project, excluded);
  // a no-op dispatch (nothing changes) should stay stable, not spawn more mirrors
  const stable = syncReplication(afterExclude, afterExclude);
  assert.equal(stable.nodes.length, 2);
});

test('un-excluding a node creates a brand-new mirror rather than restoring the old severed link', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const excluded = { ...project, nodes: project.nodes.map((n) => (n.id === 'n1' ? { ...n, replicationExcluded: true } : n)) };
  const afterExclude = syncReplication(project, excluded);

  const unExcluded = { ...afterExclude, nodes: afterExclude.nodes.map((n) => (n.id === 'n1' ? { ...n, replicationExcluded: false } : n)) };
  const synced = syncReplication(afterExclude, unExcluded);
  assert.equal(synced.nodes.length, 3, 'a fresh mirror should be created for n1');
  assert.equal(synced.replicationPairs[0].members.length, 1);
  assert.equal(synced.replicationPairs[0].members[0].a, 'n1');
});

test('syncReplication running twice on an already-synced project is a true no-op (idempotent)', () => {
  const { project } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const synced = syncReplication(project, project);
  assert.equal(synced, project, 'a self-diff on an already-consistent project should return the same reference, not a new object');
});
