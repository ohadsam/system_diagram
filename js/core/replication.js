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
  'textAlign', 'textPosition', 'icon', 'iconVisible', 'notes', 'labels',
  'subComponentsDisplay', 'rows',
];

function signature(node) {
  // Cheap deep-equality check for "did this node change since prevProject" —
  // x/y are included so a move/resize counts as a change; id/groupId/
  // zIndex/replicationExcluded are excluded since none of them are content
  // a peer would ever need to match.
  const { id: _id, groupId: _g, zIndex: _z, replicationExcluded: _r, ...rest } = node;
  return JSON.stringify(rest);
}

function cloneAsMirror(source, groupId, x, y) {
  const clone = { ...source, id: nextId('node'), groupId, x, y, replicationExcluded: false };
  clone.subComponents = (source.subComponents || []).map((sc) => ({ ...sc, id: nextId('sc') }));
  return clone;
}

function applyMirroredContent(target, source, x, y) {
  const next = { ...target, x, y };
  for (const field of MIRROR_FIELDS) next[field] = source[field];
  next.subComponents = (source.subComponents || []).map((sc) => ({ ...sc, id: nextId('sc') }));
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
 * - a pair with `frozen: true` is skipped entirely (see `syncPair`) — lets
 *   a user temporarily edit one side without touching the other, then
 *   resume live syncing later.
 */
export function syncReplication(prevProject, nextProject) {
  const pairs = nextProject.replicationPairs;
  if (!pairs || !pairs.length) return nextProject;

  const prevById = new Map(prevProject.nodes.map((n) => [n.id, n]));
  let nodes = nextProject.nodes;
  const nextPairs = [];
  const allDeletedIds = new Set();
  let anyChange = false;

  for (const pair of pairs) {
    const result = syncPair(pair, nodes, prevById);
    nodes = result.nodes;
    if (result.changed) anyChange = true;
    if (result.pair) nextPairs.push(result.pair);
    for (const id of result.deletedNodeIds) allDeletedIds.add(id);
  }

  if (!anyChange) return nextProject;
  // A cascade-deleted mirror can have its own edges (the user may have
  // connected it to something else) — clean those up the same way
  // core/project.js#removeNode does for an ordinary delete, or they'd be
  // left dangling.
  const edges = allDeletedIds.size
    ? nextProject.edges.filter((e) => !allDeletedIds.has(e.from) && !allDeletedIds.has(e.to))
    : nextProject.edges;
  return { ...nextProject, nodes, edges, replicationPairs: nextPairs };
}

function syncPair(pair, nodes, prevById) {
  // A frozen pair is completely inert: no propagation, no new-member
  // discovery, no cascade-delete. This is what lets a user make changes to
  // one side that deliberately do NOT reach the other, for as long as the
  // pair stays frozen — see docs/SPEC.md "Live Replication".
  if (pair.frozen) return { nodes, pair, changed: false, deletedNodeIds: [] };

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

  if (!changed) return { nodes, pair, changed: false, deletedNodeIds: [] };

  const resultNodes = nodes
    .filter((n) => !toDelete.has(n.id))
    .map((n) => updates.get(n.id) || n)
    .concat(newNodes);

  return { nodes: resultNodes, pair: { ...pair, members: survivingMembers }, changed: true, deletedNodeIds: toDelete };
}

/**
 * Pure builder for turning the currently-selected nodes into a brand-new
 * replication pair: mints a shared groupId for side A (reusing one common
 * existing groupId if the whole selection already shares it), duplicates
 * every non-excluded selected node as side B offset to the right of side
 * A's bounding box, and returns everything the caller needs to fold into
 * one atomic dispatch. Returns null for an empty selection.
 */
export function buildReplicationPair(nodes, selectedNodeIds, mode) {
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
  for (const node of selected) {
    if (node.replicationExcluded) continue;
    const mirror = cloneAsMirror(node, groupB, node.x + offsetX, node.y + offsetY);
    mirrorNodes.push(mirror);
    members.push({ a: node.id, b: mirror.id });
  }

  const pair = { id: nextId('repl'), mode, groupA, groupB, offsetX, offsetY, members, frozen: false };
  return { pair, groupA, regroupNodeIds: commonGroupId ? [] : selectedNodeIds, mirrorNodes };
}
