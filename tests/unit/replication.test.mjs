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

test('buildReplicationPair creates a pair that starts unfrozen', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', null, 0, 0)];
  const built = buildReplicationPair(project.nodes, ['n1'], 'active-active');
  assert.equal(built.pair.frozen, false);
});

test('syncReplication skips a frozen pair entirely: no propagation, no new-member mirroring, no cascade-delete', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const frozenProject = { ...project, replicationPairs: [{ ...built.pair, frozen: true }] };

  // content/position edit on side A must NOT propagate while frozen
  const edited = { ...frozenProject, nodes: frozenProject.nodes.map((n) => (n.id === 'n1' ? { ...n, text: 'Local only', x: 999 } : n)) };
  let synced = syncReplication(frozenProject, edited);
  const mirror = synced.nodes.find((n) => n.id !== 'n1');
  assert.notEqual(mirror.text, 'Local only');
  assert.notEqual(mirror.x, 999 + built.pair.offsetX);

  // a new node dropped into side A's group must NOT get mirrored while frozen
  const withNew = { ...synced, nodes: [...synced.nodes, mkNode('n3', built.groupA, 0, 300)] };
  synced = syncReplication(synced, withNew);
  assert.equal(synced.nodes.length, 3, 'no mirror should be created for the new node while frozen');

  // deleting n1 while frozen must NOT cascade-delete its (already-diverged) mirror
  const afterDelete = { ...synced, nodes: synced.nodes.filter((n) => n.id !== 'n1') };
  synced = syncReplication(synced, afterDelete);
  assert.equal(synced.nodes.length, 2, 'the mirror and n3 must both survive — frozen pairs never cascade-delete');
});

test('syncReplication resumes normal syncing once a pair is unfrozen again', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const frozen = { ...project, replicationPairs: [{ ...built.pair, frozen: true }] };
  const editedWhileFrozen = { ...frozen, nodes: frozen.nodes.map((n) => (n.id === 'n1' ? { ...n, text: 'Changed while frozen' } : n)) };
  const stillFrozenState = syncReplication(frozen, editedWhileFrozen);

  const resumed = { ...stillFrozenState, replicationPairs: [{ ...stillFrozenState.replicationPairs[0], frozen: false }] };
  // Resuming alone (self-diff) does not retroactively reconcile past drift.
  let synced = syncReplication(resumed, resumed);
  let mirror = synced.nodes.find((n) => n.id !== 'n1');
  assert.notEqual(mirror.text, 'Changed while frozen', 'resuming must not retroactively reconcile drift from while it was frozen');

  // but a *new* change after resuming propagates normally again
  const editedAfterResume = { ...synced, nodes: synced.nodes.map((n) => (n.id === 'n1' ? { ...n, text: 'Changed after resume' } : n)) };
  synced = syncReplication(synced, editedAfterResume);
  mirror = synced.nodes.find((n) => n.id !== 'n1');
  assert.equal(mirror.text, 'Changed after resume');
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

test('syncReplication propagates destroyOffset, fragmentType, and a fresh-id copy of activations to the mirror', () => {
  const { project } = setupPair([{ id: 'n1', overrides: { shape: 'lifeline' } }]);
  const edited = {
    ...project,
    nodes: project.nodes.map((n) => (n.id === 'n1' ? {
      ...n,
      destroyOffset: 0.75,
      fragmentType: 'alt',
      activations: [{ id: 'act_source', startOffset: 0.2, endOffset: 0.5 }],
    } : n)),
  };
  const synced = syncReplication(project, edited);

  const mirrorId = synced.replicationPairs[0].members[0].b;
  const mirror = synced.nodes.find((n) => n.id === mirrorId);
  assert.equal(mirror.destroyOffset, 0.75);
  assert.equal(mirror.fragmentType, 'alt');
  assert.equal(mirror.activations.length, 1);
  assert.equal(mirror.activations[0].startOffset, 0.2);
  assert.equal(mirror.activations[0].endOffset, 0.5);
  // A fresh id per side, same "copy never shares identity" precedent as
  // subComponents — not the literal source id.
  assert.notEqual(mirror.activations[0].id, 'act_source');
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

// ---- Internal edges (e.g. a sequence diagram's lifelines + messages) ----

test('buildReplicationPair mirrors an internal edge (both endpoints selected) onto side B, preserving content', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', null, 0, 0), mkNode('n2', null, 200, 0)];
  const edge = createEdge('n1', 'n2', { id: 'e1', label: 'call', dash: 'dashed', fromOffset: 0.3, toOffset: 0.7 });
  const built = buildReplicationPair(project.nodes, ['n1', 'n2'], 'active-active', [edge]);

  assert.equal(built.edgeMirrors.length, 1);
  assert.equal(built.pair.edgeMembers.length, 1);
  assert.equal(built.pair.edgeMembers[0].a, 'e1');
  const mirror = built.edgeMirrors[0];
  assert.equal(mirror.id, built.pair.edgeMembers[0].b);
  assert.notEqual(mirror.id, 'e1');
  assert.equal(mirror.label, 'call');
  assert.equal(mirror.dash, 'dashed');
  assert.equal(mirror.fromOffset, 0.3);
  assert.equal(mirror.toOffset, 0.7);
  const nodeIdMap = new Map(built.pair.members.map((m) => [m.a, m.b]));
  assert.equal(mirror.from, nodeIdMap.get('n1'));
  assert.equal(mirror.to, nodeIdMap.get('n2'));
});

test('buildReplicationPair does not mirror an edge that touches a node outside the selection', () => {
  const project = createEmptyProject();
  project.nodes = [mkNode('n1', null, 0, 0), mkNode('n2', null, 200, 0), mkNode('other', null, 400, 0)];
  const edge = createEdge('n1', 'other', { id: 'e1' });
  const built = buildReplicationPair(project.nodes, ['n1', 'n2'], 'active-active', [edge]);
  assert.equal(built.edgeMirrors.length, 0);
  assert.equal(built.pair.edgeMembers.length, 0);
});

test('syncReplication discovers a new internal edge drawn between two already-paired members and mirrors it', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const n1MirrorId = built.pair.members.find((m) => m.a === 'n1').b;
  const n2MirrorId = built.pair.members.find((m) => m.a === 'n2').b;
  const withEdge = { ...project, edges: [createEdge('n1', 'n2', { id: 'e1', label: 'req' })] };
  const synced = syncReplication(project, withEdge);

  assert.equal(synced.edges.length, 2, 'the new edge plus its freshly-mirrored counterpart on side B');
  assert.equal(synced.replicationPairs[0].edgeMembers.length, 1);
  const mirrorEdge = synced.edges.find((e) => e.id !== 'e1');
  assert.equal(mirrorEdge.from, n1MirrorId);
  assert.equal(mirrorEdge.to, n2MirrorId);
  assert.equal(mirrorEdge.label, 'req');
});

test('syncReplication propagates an internal edge content change from the side that actually changed', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const withEdge = { ...project, edges: [createEdge('n1', 'n2', { id: 'e1', label: 'req' })] };
  const afterDiscovery = syncReplication(project, withEdge);
  const mirrorId = afterDiscovery.replicationPairs[0].edgeMembers[0].b;

  const relabeled = { ...afterDiscovery, edges: afterDiscovery.edges.map((e) => (e.id === 'e1' ? { ...e, label: 'response' } : e)) };
  const synced = syncReplication(afterDiscovery, relabeled);
  const mirror = synced.edges.find((e) => e.id === mirrorId);
  assert.equal(mirror.label, 'response');
});

test('syncReplication cascade-deletes an internal edge\'s mirror when the original is deleted', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const withEdge = { ...project, edges: [createEdge('n1', 'n2', { id: 'e1' })] };
  const afterDiscovery = syncReplication(project, withEdge);
  assert.equal(afterDiscovery.edges.length, 2);

  const afterDelete = { ...afterDiscovery, edges: afterDiscovery.edges.filter((e) => e.id !== 'e1') };
  const synced = syncReplication(afterDiscovery, afterDelete);
  assert.equal(synced.edges.length, 0, 'the mirrored message must be cascade-deleted too');
  assert.equal(synced.replicationPairs[0].edgeMembers.length, 0);
});

test('syncReplication drops (without deleting) an internal edge\'s mapping once an endpoint stops being a live member', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const withEdge = { ...project, edges: [createEdge('n1', 'n2', { id: 'e1' })] };
  const afterDiscovery = syncReplication(project, withEdge);
  assert.equal(afterDiscovery.edges.length, 2);

  const excluded = { ...afterDiscovery, nodes: afterDiscovery.nodes.map((n) => (n.id === 'n1' ? { ...n, replicationExcluded: true } : n)) };
  const synced = syncReplication(afterDiscovery, excluded);
  assert.equal(synced.edges.length, 2, 'both the original and its now-unsynced mirror remain untouched');
  assert.equal(synced.replicationPairs[0].edgeMembers.length, 0, 'the mapping is dropped, not left dangling');
});

test('syncReplication does not mirror an edge from a member to a node outside the pair', () => {
  const { project, built } = setupPair([{ id: 'n1' }]);
  const withOutsider = { ...project, nodes: [...project.nodes, mkNode('outsider', null, 500, 0)], edges: [createEdge('n1', 'outsider', { id: 'e1' })] };
  const synced = syncReplication(project, withOutsider);
  assert.equal(synced.edges.length, 1, 'the outside edge is left exactly as it is, not mirrored');
  assert.equal(synced.replicationPairs[0].edgeMembers.length, 0);
});

test('syncReplication with internal edges is idempotent on a stable pass', () => {
  const { project, built } = setupPair([{ id: 'n1' }, { id: 'n2' }]);
  const withEdge = { ...project, edges: [createEdge('n1', 'n2', { id: 'e1' })] };
  const afterDiscovery = syncReplication(project, withEdge);
  const stable = syncReplication(afterDiscovery, afterDiscovery);
  assert.equal(stable, afterDiscovery, 'a self-diff once everything (nodes and internal edges) is already synced should return the same reference');
});
