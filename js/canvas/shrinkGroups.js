// Pure derivation of "Group & Shrink" state from plain node data — see
// core/project.js's `shrunkAnchorId` field comment and
// canvas.js#groupAndShrinkSelection. A shrunk group is nodes sharing the
// same `shrunkAnchorId` value (the anchor's own id); this never looks at
// `groupId` at all, since Group/Ungroup and Shrink/Expand are deliberately
// independent axes (see that same field comment for why).

/**
 * Returns a Map of anchorId -> array of *hidden* member node ids (the
 * group's own members minus the anchor) for every currently-shrunk group
 * whose anchor node still exists among `nodes`. A dangling anchor (deleted
 * without going through canvas.js#groupAndShrinkSelection/removeNode's own
 * cleanup — e.g. malformed hand-edited JSON that validateProject didn't
 * catch) is simply skipped rather than surfaced as an empty/broken group.
 */
export function computeShrunkGroups(nodes) {
  const byAnchor = new Map();
  for (const n of nodes) {
    if (!n.shrunkAnchorId) continue;
    if (!byAnchor.has(n.shrunkAnchorId)) byAnchor.set(n.shrunkAnchorId, []);
    byAnchor.get(n.shrunkAnchorId).push(n.id);
  }
  const groups = new Map();
  for (const [anchorId, memberIds] of byAnchor) {
    if (!nodes.some((n) => n.id === anchorId)) continue;
    groups.set(anchorId, memberIds.filter((id) => id !== anchorId));
  }
  return groups;
}
