// Pure layout math for the on-canvas minimap overlay (see canvas/minimap.js)
// — maps every node's canvas-space rect, plus the currently-visible
// viewport rect, into a small fixed-size panel's own coordinate space. No
// DOM access, so it's directly unit-testable the same way
// core/groupBackgrounds.js#computeGroupBounds is.

/**
 * @param {{id:string,x:number,y:number,w:number,h:number}[]} nodes
 * @param {{x:number,y:number,zoom:number}} viewportState canvas/viewport.js#getViewport()
 * @param {{width:number,height:number}} viewportSize the on-screen size of #canvas-viewport
 * @param {{w:number,h:number}} mapSize the minimap panel's own pixel size
 * @param {number} [padding] extra canvas-space margin around the content/viewport union
 * @returns {{
 *   nodeRects: {id:string,x:number,y:number,w:number,h:number}[],
 *   viewportRect: {x:number,y:number,w:number,h:number},
 *   bounds: {x:number,y:number,w:number,h:number},
 *   scale: number,
 * }}
 */
export function computeMinimapLayout(nodes, viewportState, viewportSize, mapSize, padding = 24) {
  const zoom = viewportState.zoom || 1;
  const visible = {
    x: -viewportState.x / zoom,
    y: -viewportState.y / zoom,
    w: viewportSize.width / zoom,
    h: viewportSize.height / zoom,
  };

  // The visible viewport rect is always included in the bounds union (not
  // just the nodes) so the "you are here" indicator never lands outside the
  // minimap's own panel — a user panned far away from every component still
  // sees exactly how far, instead of a confusing indicator clipped at an edge.
  const xs = [visible.x, visible.x + visible.w, ...nodes.map((n) => n.x), ...nodes.map((n) => n.x + n.w)];
  const ys = [visible.y, visible.y + visible.h, ...nodes.map((n) => n.y), ...nodes.map((n) => n.y + n.h)];
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const boundsW = Math.max(Math.max(...xs) - minX + padding, 1);
  const boundsH = Math.max(Math.max(...ys) - minY + padding, 1);

  const scale = Math.min(mapSize.w / boundsW, mapSize.h / boundsH);
  const toMap = (r) => ({ x: (r.x - minX) * scale, y: (r.y - minY) * scale, w: r.w * scale, h: r.h * scale });

  return {
    nodeRects: nodes.map((n) => ({ id: n.id, ...toMap(n) })),
    viewportRect: toMap(visible),
    bounds: { x: minX, y: minY, w: boundsW, h: boundsH },
    scale,
  };
}

/** Inverse of computeMinimapLayout's mapping — a point clicked/dragged at
 * (mapX, mapY) inside the minimap panel back to a canvas-space point, for
 * click/drag-to-pan (see canvas/minimap.js). */
export function minimapPointToCanvas(mapX, mapY, layout) {
  return {
    x: layout.bounds.x + mapX / layout.scale,
    y: layout.bounds.y + mapY / layout.scale,
  };
}
