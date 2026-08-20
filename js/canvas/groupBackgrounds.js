// Pure bounding-box math for the "group background" boundary rendered
// behind every relevant group — see canvas.js's `groupBgLayer`. A regular
// Group/Ungroup group and a replication pair's side are the exact same
// mechanism under the hood (both are just nodes sharing a `groupId` — see
// core/replication.js's header comment), so this needs no special case
// for either *shape-wise*; the only difference is the member-count floor
// (see below).
const PADDING = 20;

/**
 * Returns one `{ groupId, x, y, w, h, count }` per relevant `groupId`,
 * padded out from the tightest box around its members.
 *
 * A regular group needs 2+ members to mean anything visually (a
 * single-member "group" can legitimately happen transiently, e.g.
 * mid-ungroup, and has nothing to bound). A replication side is different:
 * it's just as meaningful — "this is a live-mirrored unit" — with a single
 * component on that side, which is the common case, so `replicatedGroupIds`
 * (every `pair.groupA`/`pair.groupB` currently in play) gets a floor of 1
 * instead.
 */
export function computeGroupBounds(nodes, replicatedGroupIds = new Set()) {
  const byGroup = new Map();
  for (const n of nodes) {
    if (!n.groupId) continue;
    if (!byGroup.has(n.groupId)) byGroup.set(n.groupId, []);
    byGroup.get(n.groupId).push(n);
  }
  const bounds = [];
  for (const [groupId, members] of byGroup) {
    const minMembers = replicatedGroupIds.has(groupId) ? 1 : 2;
    if (members.length < minMembers) continue;
    const minX = Math.min(...members.map((n) => n.x));
    const minY = Math.min(...members.map((n) => n.y));
    const maxX = Math.max(...members.map((n) => n.x + n.w));
    const maxY = Math.max(...members.map((n) => n.y + n.h));
    bounds.push({
      groupId,
      x: minX - PADDING,
      y: minY - PADDING,
      w: maxX - minX + PADDING * 2,
      h: maxY - minY + PADDING * 2,
      count: members.length,
    });
  }
  return bounds;
}
