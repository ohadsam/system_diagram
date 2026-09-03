// Pure geometry for the small "what's grouped in here" composite drawn
// inside a "Group & Shrink" anchor's own node face (see canvas/node.js's
// buildShrinkThumbnailBody) — mirrors core/patternThumbnailLayout.js's
// box+edge approach, but built from a group's real, live member nodes
// (actual x/y/w/h/icon/fill) rather than a static pattern template's dx/dy
// offsets, and scaled to fit a given target box (the anchor's own current
// w/h) instead of a fixed thumbnail size. Kept DOM-free so the scaling math
// is unit-testable — canvas/node.js turns the result into actual DOM.
const PADDING = 3;
const MIN_SCALE = 0.02; // guards against a division blow-up for a degenerate (zero-span) group

/**
 * @param {{id:string, x:number, y:number, w:number, h:number, icon?:string, fill?:string}[]} members
 * @param {{from:string, to:string}[]} edges edges among `members` only (caller filters)
 * @param {number} targetW
 * @param {number} targetH
 * @returns {{boxes: {id:string, icon:string, fill:string, x:number, y:number, w:number, h:number}[], lines: {x1:number,y1:number,x2:number,y2:number}[]}}
 */
export function computeShrinkThumbnail(members, edges, targetW, targetH) {
  if (!members?.length || targetW <= 0 || targetH <= 0) return { boxes: [], lines: [] };

  const minX = Math.min(...members.map((n) => n.x));
  const minY = Math.min(...members.map((n) => n.y));
  const maxX = Math.max(...members.map((n) => n.x + n.w));
  const maxY = Math.max(...members.map((n) => n.y + n.h));
  const spanW = Math.max(1, maxX - minX);
  const spanH = Math.max(1, maxY - minY);
  const scale = Math.max(MIN_SCALE, Math.min((targetW - PADDING * 2) / spanW, (targetH - PADDING * 2) / spanH));
  const offsetX = (targetW - spanW * scale) / 2;
  const offsetY = (targetH - spanH * scale) / 2;

  const boxById = new Map();
  const boxes = members.map((n) => {
    const box = {
      id: n.id,
      icon: n.iconImage ? '' : (n.icon || ''),
      fill: n.fill || '#FFFFFF',
      x: (n.x - minX) * scale + offsetX,
      y: (n.y - minY) * scale + offsetY,
      w: Math.max(2, n.w * scale),
      h: Math.max(2, n.h * scale),
    };
    boxById.set(n.id, box);
    return box;
  });

  const lines = (edges || [])
    .map((e) => {
      const from = boxById.get(e.from);
      const to = boxById.get(e.to);
      if (!from || !to) return null;
      return {
        x1: from.x + from.w / 2, y1: from.y + from.h / 2,
        x2: to.x + to.w / 2, y2: to.y + to.h / 2,
      };
    })
    .filter(Boolean);

  return { boxes, lines };
}
