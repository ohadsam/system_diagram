// Pure geometry for a small "what's in this pattern" thumbnail — a
// generic version of sidebar/patternPreview.js's lifeline-only sketch,
// usable for ANY definePattern() blueprint (schema.js) regardless of shape:
// Design Patterns and Reference Architectures use ordinary component
// nodes (dx/dy offsets + a real defId for icon/color), not lifelines.
// Kept DOM-free so the box-placement math is unit-testable —
// modals/templateGalleryModal.js turns the result into actual SVG.
const BOX_W = 46;
const BOX_H = 30;
const MARGIN = 10;

/**
 * @param {{nodes: {key:string, defId:string, dx:number, dy:number}[], edges?: {from:string, to:string}[]}} pattern
 * @returns {{width: number, height: number, boxes: {key:string, defId:string, x:number, y:number, w:number, h:number, cx:number, cy:number}[], edges: {x1:number, y1:number, x2:number, y2:number}[]}}
 */
export function computePatternThumbnailLayout(pattern) {
  const nodes = pattern?.nodes || [];
  if (!nodes.length) return { width: 0, height: 0, boxes: [], edges: [] };

  const xs = nodes.map((n) => n.dx);
  const ys = nodes.map((n) => n.dy);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const ox = -minX + MARGIN;
  const oy = -minY + MARGIN;

  const boxByKey = new Map();
  const boxes = nodes.map((n) => {
    const x = n.dx + ox;
    const y = n.dy + oy;
    const box = { key: n.key, defId: n.defId, x, y, w: BOX_W, h: BOX_H, cx: x + BOX_W / 2, cy: y + BOX_H / 2 };
    boxByKey.set(n.key, box);
    return box;
  });

  const edges = (pattern.edges || [])
    .map((e) => {
      const from = boxByKey.get(e.from);
      const to = boxByKey.get(e.to);
      if (!from || !to) return null;
      return { x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy };
    })
    .filter(Boolean);

  return {
    width: (maxX - minX) + BOX_W + MARGIN * 2,
    height: (maxY - minY) + BOX_H + MARGIN * 2,
    boxes,
    edges,
  };
}
