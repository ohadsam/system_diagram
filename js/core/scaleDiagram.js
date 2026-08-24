// Pure math for the "Scale Diagram" action (see canvas.js#scaleDiagram) —
// unlike the view-only pan/zoom (canvas/viewport.js), which is a pure CSS
// transform and never touches the underlying data, this permanently resizes
// every node's own position/size *and* font size by one factor, so the
// diagram looks the same at 100% view zoom afterward as it did before at
// the chosen scale. No DOM/store access.
const MIN_FONT_SIZE = 6;

/**
 * @param {object[]} nodes
 * @param {number} factor multiplier, e.g. 1.5 for +50%, 0.5 for -50%
 * @param {{x:number,y:number}} origin canvas point the scale is centered on
 *   (typically the content's own bounding-box center, so the diagram stays
 *   roughly in the same place instead of drifting toward the canvas origin)
 * @returns {object[]} new node objects — originals are left untouched
 */
export function scaleNodes(nodes, factor, origin) {
  return nodes.map((n) => ({
    ...n,
    x: origin.x + (n.x - origin.x) * factor,
    y: origin.y + (n.y - origin.y) * factor,
    w: n.w * factor,
    h: n.h * factor,
    fontSize: Math.max(MIN_FONT_SIZE, Math.round(n.fontSize * factor)),
  }));
}
