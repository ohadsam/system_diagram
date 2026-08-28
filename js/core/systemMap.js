// Pure layout math for modals/systemMapModal.js's visual graph of every
// saved project and the cross-project links between them (project.links,
// see core/project.js) — DOM-free and unit-testable, same reasoning as
// core/groupBackgrounds.js#computeGroupBounds for pulling layout math out
// of the modal that renders it. A simple circle layout (not force-directed)
// is deliberate: deterministic, so the same set of projects always draws
// the same map, and cheap enough to recompute on every render with no
// settling/animation needed.

/**
 * @param {{id: string, name: string, links?: {to: string, label?: string}[]}[]} projects
 * @param {{centerX?: number, centerY?: number, radius?: number}} [opts]
 * @returns {{nodes: {id: string, name: string, x: number, y: number}[], links: {id: string, fromId: string, toId: string, label: string}[]}}
 */
export function computeSystemMapLayout(projects, { centerX = 200, centerY = 200, radius = 160 } = {}) {
  const list = Array.isArray(projects) ? projects : [];
  const projectIds = new Set(list.map((p) => p.id));
  const count = list.length;

  const nodes = list.map((p, i) => {
    // A single project has nowhere meaningful to sit but the center — the
    // circle math below divides by `count`, which is fine for count > 1,
    // but placing a lone node at angle 0 on a full-size circle would look
    // arbitrarily off-center for no reason.
    if (count <= 1) return { id: p.id, name: p.name, x: centerX, y: centerY };
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      id: p.id,
      name: p.name,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const links = [];
  for (const p of list) {
    for (const link of p.links || []) {
      // A link to a project that's since been deleted (or never existed —
      // a hand-edited/imported file) is simply skipped, not an error — same
      // "never a dangling reference on screen" contract core/project.js's
      // own validateLinks already applies to the data itself.
      if (!projectIds.has(link.to)) continue;
      links.push({ id: link.id, fromId: p.id, toId: link.to, label: link.label || '' });
    }
  }

  return { nodes, links };
}
