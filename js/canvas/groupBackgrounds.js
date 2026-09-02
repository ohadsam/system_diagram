// Pure bounding-box math for the "group background" boundary rendered
// behind every relevant group — see canvas.js's `groupBgLayer`. A regular
// Group/Ungroup group and a replication pair's side are the exact same
// mechanism under the hood (both are just nodes sharing a `groupId` — see
// core/replication.js's header comment), so this needs no special case
// for either *shape-wise*; the only difference is the member-count floor
// (see below).
// Exported so canvas.js#renderGroupBackgrounds can pad a shrunk group's own
// anchor-only override box (see that function's comment) by the exact same
// amount, rather than a second hardcoded magic number that could drift out
// of sync with this one.
export const PADDING = 20;

/**
 * Returns one `{ groupId, x, y, w, h, count }` per relevant `groupId`,
 * padded out from the tightest box around its members. Deliberately
 * unaware of "Group & Shrink" hiding a member's DOM element — `count` and
 * the box itself both come from *every* node carrying that `groupId`,
 * hidden or not (a shrunk group's label still needs its true member count);
 * canvas.js#renderGroupBackgrounds overrides just the box's x/y/w/h
 * afterward for a shrunk group, to its one visible anchor's own rect.
 *
 * A regular group needs 2+ members to mean anything visually (a
 * single-member "group" can legitimately happen transiently, e.g.
 * mid-ungroup, and has nothing to bound). A replication side is different:
 * it's just as meaningful — "this is a live-mirrored unit" — with a single
 * component on that side, which is the common case, so `replicatedGroupIds`
 * (every `pair.groupA`/`pair.groupB` currently in play) gets a floor of 1
 * instead. `oneMemberOkGroupIds` extends that same floor-of-1 allowance to
 * a "Group & Shrink" group whose anchor is genuinely its only remaining
 * member (every other one since deleted) — without it, that degenerate
 * case would fall below the regular floor of 2 and never get a frame.
 */
export function computeGroupBounds(nodes, replicatedGroupIds = new Set(), oneMemberOkGroupIds = new Set()) {
  const byGroup = new Map();
  for (const n of nodes) {
    if (!n.groupId) continue;
    if (!byGroup.has(n.groupId)) byGroup.set(n.groupId, []);
    byGroup.get(n.groupId).push(n);
  }
  const bounds = [];
  for (const [groupId, members] of byGroup) {
    const minMembers = (replicatedGroupIds.has(groupId) || oneMemberOkGroupIds.has(groupId)) ? 1 : 2;
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
