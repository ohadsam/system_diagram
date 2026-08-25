// Live "keep two sides mirrored" engine for a replication pair — see
// docs/SPEC.md "Live Replication". Pure and DOM-free: core/store.js runs
// syncReplication() on every dispatch/loadProject, so every mutation path
// (canvas drag, a details-panel edit, JSON import, the AI-generate paste,
// undo/redo replay) gets mirroring for free without any of those call
// sites needing to know replication exists.
import { nextId } from './id.js';

const REPLICATION_GAP = 120; // px between side A's bounding box and side B, when auto-placing a new pair

// Fields copied verbatim from a changed node onto its peer. x/y are handled
// separately via the pair's constant offset rather than copied directly;
// id/groupId/zIndex/replicationExcluded are inherently per-side and are
// never mirrored — each side keeps its own identity, stacking order and
// opt-out state independently.
const MIRROR_FIELDS = [
  'defId', 'w', 'h', 'shape', 'fill', 'stroke', 'strokeWidth', 'text', 'fontSize',
  'textAlign', 'textPosition', 'icon', 'iconVisible', 'iconImage', 'notes', 'labels', 'monthlyCost',
  'subComponentsDisplay', 'rows', 'destroyOffset', 'fragmentType',
];

function signature(node) {
  // Cheap deep-equality check for "did this node change since prevProject" —
  // x/y are included so a move/resize counts as a change; id/groupId/
  // zIndex/replicationExcluded are excluded since none of them are content
  // a peer would ever need to match.
  const { id: _id, groupId: _g, zIndex: _z, replicationExcluded: _r, ...rest } = node;
  return JSON.stringify(rest);
}

// Like subComponents, an activation bar carries its own id (used to look up
// which entry a drag is resizing/moving — see nodeInteractions.js) — copied
// with a fresh one per side rather than through MIRROR_FIELDS' plain
// verbatim-value fields, same "the copy never shares identity with the
// original" reasoning as subComponents' own id.
function mirrorActivations(source) {
  return (source.activations || []).map((a) => ({ ...a, id: nextId('act') }));
}

function cloneAsMirror(source, groupId, x, y) {
  const clone = { ...source, id: nextId('node'), groupId, x, y, replicationExcluded: false };
  clone.subComponents = (source.subComponents || []).map((sc) => ({ ...sc, id: nextId('sc') }));
  clone.activations = mirrorActivations(source);
  return clone;
}

function applyMirroredContent(target, source, x, y) {
  const next = { ...target, x, y };
  for (const field of MIRROR_FIELDS) next[field] = source[field];
  next.subComponents = (source.subComponents || []).map((sc) => ({ ...sc, id: nextId('sc') }));
  next.activations = mirrorActivations(source);
  return next;
}

// Every edge field except id/from/to (inherently per-side, like a node's
// id/groupId) is mirrored verbatim — unlike a node's x/y, an edge has no
// position of its own (its rendered path is derived live from its two
// endpoint nodes, see canvas/connector.js#sideAnchor), and side B is always
// a rigid translation of side A, so the same fromSide/toSide/fromOffset/
// toOffset already describes the correct anchor point on the mirrored pair
// with no adjustment needed.
const EDGE_MIRROR_FIELDS = [
  'fromSide', 'toSide', 'fromOffset', 'toOffset', 'routing',
  'color', 'width', 'dash', 'startArrow', 'endArrow', 'label', 'labelPosition', 'notes',
  'sequenceNumberOverride', 'waypoints',
];

function edgeSignature(edge) {
  const { id: _id, from: _f, to: _t, ...rest } = edge;
  return JSON.stringify(rest);
}

function cloneAsMirrorEdge(source, fromId, toId) {
  return { ...source, id: nextId('edge'), from: fromId, to: toId };
}

function applyMirroredEdgeContent(target, source) {
  const next = { ...target };
  for (const field of EDGE_MIRROR_FIELDS) next[field] = source[field];
  return next;
}

/**
 * One full sync pass over every replication pair in `nextProject`, given
 * the project as it was just before this mutation (`prevProject`). Returns
 * a new project (never mutates its inputs) with every pair's two sides
 * brought back into sync:
 * - a member deleted, excluded, or moved out of its side's group on either
 *   side severs that member's link (its peer is deleted too, unless the
 *   peer is the one that was excluded/moved — that one is left exactly as
 *   it is, now independent);
 * - a still-linked member whose content or position changed in this pass
 *   (compared to prevProject) propagates that change to its peer;
 * - any node newly found with a side's groupId and no existing mapping
 *   (whether just added, or already there — e.g. right after a JSON
 *   import that carries matching groupIds — "detects the existing state"
 *   for free) gets a mirror created on the other side, unless it's
 *   replicationExcluded;
 * - an **internal edge** — one connecting two nodes that are *both*
 *   currently-mapped members of the same side (e.g. a sequence diagram's
 *   messages between its lifelines) — is mirrored to the other side the
 *   same way a node is: newly drawn → a mirror is created; content
 *   (label/color/routing/notes/...) changed on one side → propagated to
 *   the other; deleted on one side → the mirror is cascade-deleted too. An
 *   edge that only touches one member and something outside the pair
 *   (or one whose endpoint later stopped being a live member — excluded,
 *   moved to another group) is left alone — it's not part of the
 *   replicated unit;
 * - a pair with `frozen: true` is skipped entirely (see `syncPair`) — lets
 *   a user temporarily edit one side without touching the other, then
 *   resume live syncing later.
 */
export function syncReplication(prevProject, nextProject) {
  const pairs = nextProject.replicationPairs;
  if (!pairs || !pairs.length) return nextProject;

  const prevById = new Map(prevProject.nodes.map((n) => [n.id, n]));
  const prevEdgeById = new Map(prevProject.edges.map((e) => [e.id, e]));
  let nodes = nextProject.nodes;
  let edges = nextProject.edges;
  const nextPairs = [];
  const allDeletedIds = new Set();
  let anyChange = false;

  for (const pair of pairs) {
    const result = syncPair(pair, nodes, edges, prevById, prevEdgeById);
    nodes = result.nodes;
    edges = result.edges;
    if (result.changed) anyChange = true;
    if (result.pair) nextPairs.push(result.pair);
    for (const id of result.deletedNodeIds) allDeletedIds.add(id);
  }

  if (!anyChange) return nextProject;
  // A cascade-deleted mirror can have its own edges (the user may have
  // connected it to something else) — clean those up the same way
  // core/project.js#removeNode does for an ordinary delete, or they'd be
  // left dangling. (A cascade-deleted *edge* mirror, by contrast, is
  // already removed by syncPair itself above — this pass only needs to
  // catch edges left dangling by a *node* deletion.)
  const finalEdges = allDeletedIds.size
    ? edges.filter((e) => !allDeletedIds.has(e.from) && !allDeletedIds.has(e.to))
    : edges;
  return { ...nextProject, nodes, edges: finalEdges, replicationPairs: nextPairs };
}

function syncPair(pair, nodes, edges, prevById, prevEdgeById) {
  // A frozen pair is completely inert: no propagation, no new-member
  // discovery, no cascade-delete. This is what lets a user make changes to
  // one side that deliberately do NOT reach the other, for as long as the
  // pair stays frozen — see docs/SPEC.md "Live Replication".
  if (pair.frozen) return { nodes, edges, pair, changed: false, deletedNodeIds: [] };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  let changed = false;
  const toDelete = new Set();
  const survivingMembers = [];

  // 1. Reconcile existing members: drop/cascade-delete broken links, or
  //    propagate a change from whichever side actually changed this pass.
  const updates = new Map(); // nodeId -> replacement node
  for (const m of pair.members) {
    const a = byId.get(m.a);
    const b = byId.get(m.b);
    const aLive = a && a.groupId === pair.groupA && !a.replicationExcluded;
    const bLive = b && b.groupId === pair.groupB && !b.replicationExcluded;

    if (aLive && bLive) {
      const prevA = prevById.get(a.id);
      const prevB = prevById.get(b.id);
      const aChanged = prevA ? signature(prevA) !== signature(a) : false;
      const bChanged = prevB ? signature(prevB) !== signature(b) : false;
      if (aChanged && !bChanged) {
        updates.set(b.id, applyMirroredContent(b, a, a.x + pair.offsetX, a.y + pair.offsetY));
        changed = true;
      } else if (bChanged && !aChanged) {
        updates.set(a.id, applyMirroredContent(a, b, b.x - pair.offsetX, b.y - pair.offsetY));
        changed = true;
      }
      survivingMembers.push(m);
      continue;
    }

    // The link is broken. Only a genuine deletion cascades to the peer —
    // excluding a node or moving it to a different group is a deliberate
    // "this one opts out" action, not a removal, so in that case both
    // nodes are simply left exactly as they are and the mapping is just
    // dropped. The surviving peer also gets flagged replicationExcluded
    // itself (if it wasn't already): without that, it would still look
    // like an ordinary, unmapped member of its side's group and the
    // discovery pass below would mistake it for a *new* addition and
    // mirror it right back — freezing it out is what actually makes the
    // severance stick, and it also keeps the "excluded" checkbox honest
    // (it now reads as excluded because it genuinely no longer syncs).
    changed = true;
    const aDeleted = !a;
    const bDeleted = !b;
    if (aDeleted && !bDeleted) toDelete.add(b.id);
    else if (bDeleted && !aDeleted) toDelete.add(a.id);
    else if (!aDeleted && !bDeleted) {
      if (!aLive && bLive) updates.set(b.id, { ...(updates.get(b.id) || b), replicationExcluded: true });
      else if (!bLive && aLive) updates.set(a.id, { ...(updates.get(a.id) || a), replicationExcluded: true });
    }
  }

  // 2. Discover new/unmapped members on either side (also covers nodes
  //    that were already sitting in the group with no mapping yet, e.g.
  //    right after import) and create their mirror.
  const mappedA = new Set(survivingMembers.map((m) => m.a));
  const mappedB = new Set(survivingMembers.map((m) => m.b));
  const newNodes = [];
  for (const raw of nodes) {
    if (toDelete.has(raw.id)) continue;
    // Use the post-update version (e.g. a peer just frozen out above by
    // being marked replicationExcluded) — checking the stale pre-update
    // node here would immediately re-adopt it as a "new" member.
    const node = updates.get(raw.id) || raw;
    if (node.replicationExcluded) continue;
    if (node.groupId === pair.groupA && !mappedA.has(node.id)) {
      const mirror = cloneAsMirror(node, pair.groupB, node.x + pair.offsetX, node.y + pair.offsetY);
      newNodes.push(mirror);
      survivingMembers.push({ a: node.id, b: mirror.id });
      changed = true;
    } else if (node.groupId === pair.groupB && !mappedB.has(node.id)) {
      const mirror = cloneAsMirror(node, pair.groupA, node.x - pair.offsetX, node.y - pair.offsetY);
      newNodes.push(mirror);
      survivingMembers.push({ a: mirror.id, b: node.id });
      changed = true;
    }
  }

  // 3. Reconcile existing internal-edge members, exactly the same shape as
  //    step 1 for nodes: a still-internal edge (both endpoints still live
  //    members, on both sides) propagates a content change; an edge that
  //    genuinely no longer exists on one side cascade-deletes its mirror;
  //    an edge whose endpoint quietly stopped being a live member (excluded,
  //    regrouped, or cascade-deleted above) just has its mapping dropped —
  //    the edge itself, if it still exists, is left alone, same as an
  //    excluded node's own content is.
  const aToB = new Map(survivingMembers.map((m) => [m.a, m.b]));
  const bToA = new Map(survivingMembers.map((m) => [m.b, m.a]));
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const toDeleteEdges = new Set();
  const survivingEdgeMembers = [];
  const edgeUpdates = new Map();

  for (const em of pair.edgeMembers || []) {
    const ea = edgeById.get(em.a);
    const eb = edgeById.get(em.b);
    if (!ea && !eb) { changed = true; continue; }
    if (ea && !eb) { toDeleteEdges.add(ea.id); changed = true; continue; }
    if (!ea && eb) { toDeleteEdges.add(eb.id); changed = true; continue; }

    const aStillInternal = aToB.has(ea.from) && aToB.has(ea.to);
    const bStillInternal = bToA.has(eb.from) && bToA.has(eb.to);
    if (!aStillInternal || !bStillInternal) { changed = true; continue; }

    const prevA = prevEdgeById.get(ea.id);
    const prevB = prevEdgeById.get(eb.id);
    const aChanged = prevA ? edgeSignature(prevA) !== edgeSignature(ea) : false;
    const bChanged = prevB ? edgeSignature(prevB) !== edgeSignature(eb) : false;
    if (aChanged && !bChanged) {
      edgeUpdates.set(eb.id, applyMirroredEdgeContent(eb, ea));
      changed = true;
    } else if (bChanged && !aChanged) {
      edgeUpdates.set(ea.id, applyMirroredEdgeContent(ea, eb));
      changed = true;
    }
    survivingEdgeMembers.push(em);
  }

  // 4. Discover new internal edges — connecting two nodes that are both
  //    live members of the same side, with no mapping yet (whether just
  //    drawn, or already there right after an import that carries matching
  //    edge structure — same "detect the existing state" behavior step 2
  //    gives nodes).
  const mappedEdgeA = new Set(survivingEdgeMembers.map((em) => em.a));
  const mappedEdgeB = new Set(survivingEdgeMembers.map((em) => em.b));
  const newEdges = [];
  for (const edge of edges) {
    if (toDeleteEdges.has(edge.id) || mappedEdgeA.has(edge.id) || mappedEdgeB.has(edge.id)) continue;
    if (aToB.has(edge.from) && aToB.has(edge.to)) {
      const mirror = cloneAsMirrorEdge(edge, aToB.get(edge.from), aToB.get(edge.to));
      newEdges.push(mirror);
      survivingEdgeMembers.push({ a: edge.id, b: mirror.id });
      changed = true;
    } else if (bToA.has(edge.from) && bToA.has(edge.to)) {
      const mirror = cloneAsMirrorEdge(edge, bToA.get(edge.from), bToA.get(edge.to));
      newEdges.push(mirror);
      survivingEdgeMembers.push({ a: mirror.id, b: edge.id });
      changed = true;
    }
  }

  if (!changed) return { nodes, edges, pair, changed: false, deletedNodeIds: [] };

  const resultNodes = nodes
    .filter((n) => !toDelete.has(n.id))
    .map((n) => updates.get(n.id) || n)
    .concat(newNodes);

  const resultEdges = edges
    .filter((e) => !toDeleteEdges.has(e.id))
    .map((e) => edgeUpdates.get(e.id) || e)
    .concat(newEdges);

  return {
    nodes: resultNodes,
    edges: resultEdges,
    pair: { ...pair, members: survivingMembers, edgeMembers: survivingEdgeMembers },
    changed: true,
    deletedNodeIds: toDelete,
  };
}

/**
 * Pure builder for turning the currently-selected nodes into a brand-new
 * replication pair: mints a shared groupId for side A (reusing one common
 * existing groupId if the whole selection already shares it), duplicates
 * every non-excluded selected node as side B offset to the right of side
 * A's bounding box, and returns everything the caller needs to fold into
 * one atomic dispatch. Returns null for an empty selection.
 *
 * `edges` (all of the project's edges — optional, defaults to none) is
 * scanned for **internal** ones — both endpoints among the selected,
 * non-excluded nodes — which get mirrored onto side B too, exactly like
 * `buildGroupSnapshotFromSelection`'s "Save as Component" does for the
 * same reason: a selection with edges between its own members (e.g. a
 * sequence diagram's lifelines and messages) needs those edges to survive
 * the trip, or side B is just a set of disconnected, message-less
 * lifelines. An edge to something *outside* the selection is left alone —
 * it's not part of the replicated unit. `syncReplication` takes over from
 * here for anything drawn *after* this initial pair is created.
 */
export function buildReplicationPair(nodes, selectedNodeIds, mode, edges = []) {
  const selected = selectedNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean);
  if (!selected.length) return null;

  const commonGroupId = selected.every((n) => n.groupId && n.groupId === selected[0].groupId) ? selected[0].groupId : null;
  const groupA = commonGroupId || nextId('group');
  const groupB = nextId('group');

  const minX = Math.min(...selected.map((n) => n.x));
  const maxX = Math.max(...selected.map((n) => n.x + n.w));
  const offsetX = maxX - minX + REPLICATION_GAP;
  const offsetY = 0;

  const mirrorNodes = [];
  const members = [];
  const nodeIdMap = new Map();
  for (const node of selected) {
    if (node.replicationExcluded) continue;
    const mirror = cloneAsMirror(node, groupB, node.x + offsetX, node.y + offsetY);
    mirrorNodes.push(mirror);
    members.push({ a: node.id, b: mirror.id });
    nodeIdMap.set(node.id, mirror.id);
  }

  const edgeMirrors = [];
  const edgeMembers = [];
  for (const edge of edges) {
    if (!nodeIdMap.has(edge.from) || !nodeIdMap.has(edge.to)) continue;
    const mirror = cloneAsMirrorEdge(edge, nodeIdMap.get(edge.from), nodeIdMap.get(edge.to));
    edgeMirrors.push(mirror);
    edgeMembers.push({ a: edge.id, b: mirror.id });
  }

  const pair = { id: nextId('repl'), mode, groupA, groupB, offsetX, offsetY, members, edgeMembers, frozen: false };
  return { pair, groupA, regroupNodeIds: commonGroupId ? [] : selectedNodeIds, mirrorNodes, edgeMirrors };
}
