// Pure geometry mapping from this app's flat 2D diagram (core/project.js's
// node/edge shape) to a 3D scene — used by js/render3d/scene3dRenderer.js
// (the actual Three.js-touching renderer) so the "how do we turn a 2D
// diagram into a 3D one" logic stays DOM/WebGL-free and independently
// unit-testable, same split as core/animationAutoBuild.js vs. the DOM
// side that actually plays an animation.
//
// Coordinate mapping: canvas X -> 3D X, canvas Y -> 3D Z (the diagram lies
// flat on the ground plane, viewed from an angled camera above — a
// standard "map view" 3D convention), 3D Y is the extrusion height
// (upward) synthesized per shape below since a flat 2D diagram has no
// third dimension of its own to reuse.
const SHAPE_HEIGHT = {
  cylinder: 90,
  circle: 40,
  diamond: 40,
  rows: 50,
  note: 30,
  cuboid: 70,
};
const DEFAULT_HEIGHT = 60;

export const FORWARD_COLOR = '#2563EB';
export const BACKWARD_COLOR = '#DC2626';

/** Maps one project node to a 3D box: center position (x/y/z) + full
 * width/height/depth, so the renderer can build a `THREE.BoxGeometry`
 * directly from it (Three.js boxes are centered on their own origin). */
export function computeNode3D(node) {
  const height = SHAPE_HEIGHT[node.shape] ?? DEFAULT_HEIGHT;
  return {
    id: node.id,
    x: node.x + node.w / 2,
    y: height / 2,
    z: node.y + node.h / 2,
    width: node.w,
    depth: node.h,
    height,
    // The 3D box's main surface uses the node's *stroke* color, not its
    // fill — a 2D node's fill is deliberately a very light pastel tint of
    // its stroke (see data/schema.js#tint) so text/icons stay legible on
    // top of it, but that same light tint reads as washed-out/gray once
    // it's a lit 3D surface instead of a small flat swatch. The stroke
    // color is the one every component's own visual identity is actually
    // built around (it's what a user picks/sees as "this component's
    // color" in the style editor), so it's what should carry over here.
    color: node.stroke || node.fill || '#6B7280',
    label: node.text || '',
  };
}

/**
 * Maps one edge to a 3D "cable" between two already-computed node3D
 * points — a start/mid/end control-point triple (mid is raised well above
 * both endpoints so the cable visibly arcs over the boxes between them,
 * like a suspended power line, rather than a straight line puncturing
 * through anything in between) plus a direction/color pair. Direction is
 * purely geometric (which of X/Z dominates the displacement, and its
 * sign) — deliberately not tied to the edge's own semantic direction,
 * mirroring a real electrical/network cable's convention of coloring by
 * physical run direction rather than by which end is the "source." Two
 * edges between the same two nodes but drawn in opposite directions will
 * always render as one blue, one red.
 */
export function computeEdge3D(fromNode3D, toNode3D) {
  const dx = toNode3D.x - fromNode3D.x;
  const dz = toNode3D.z - fromNode3D.z;
  const dominant = Math.abs(dx) >= Math.abs(dz) ? dx : dz;
  const direction = dominant >= 0 ? 'forward' : 'backward';
  const color = direction === 'forward' ? FORWARD_COLOR : BACKWARD_COLOR;

  const start = { x: fromNode3D.x, y: fromNode3D.height, z: fromNode3D.z };
  const end = { x: toNode3D.x, y: toNode3D.height, z: toNode3D.z };
  const archHeight = Math.max(fromNode3D.height, toNode3D.height) + 50;
  const mid = { x: (start.x + end.x) / 2, y: archHeight, z: (start.z + end.z) / 2 };

  return { start, mid, end, direction, color };
}
