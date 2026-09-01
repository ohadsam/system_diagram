// Pure math for the "🎬 Camera Tour" feature (both 3D Presentation Mode and
// its "Realistic Room" variant, render3d/scene3dRenderer.js) — split out so
// the interpolation/easing/auto-shot-placement logic is unit-testable
// without touching Three.js/WebGL at all, same split as
// core/scene3dLayout.js vs. render3d/scene3dRenderer.js itself.
//
// A "shot" is a plain camera pose: { theta, phi, radius, target: {x,y,z},
// label }. A tour is just an ordered array of shots — playback (in the
// renderer) holds on each shot for TOUR_HOLD_MS, then spends TOUR_MOVE_MS
// tweening to the next one via interpolateShot below.

export const TOUR_HOLD_MS = 2200;
export const TOUR_MOVE_MS = 1600;

/** Shortest-path interpolation between two angles (radians) at fraction
 * `t` (0..1) — without this, a transition from e.g. theta=350° to theta=10°
 * would spin the "long way around" (340° of travel) instead of the visibly
 * correct 20°. */
export function lerpAngle(from, to, t) {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return from + delta * t;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

/** The eased camera pose `t` (0..1) of the way from shot `from` to shot
 * `to` — used every frame while a tour is in its "move" phase. */
export function interpolateShot(from, to, t) {
  const eased = easeInOutCubic(Math.min(1, Math.max(0, t)));
  return {
    theta: lerpAngle(from.theta, to.theta, eased),
    phi: from.phi + (to.phi - from.phi) * eased,
    radius: from.radius + (to.radius - from.radius) * eased,
    target: {
      x: from.target.x + (to.target.x - from.target.x) * eased,
      y: from.target.y + (to.target.y - from.target.y) * eased,
      z: from.target.z + (to.target.z - from.target.z) * eased,
    },
  };
}

/** Builds one auto-generated tour: a shot per node (angled to look at it
 * from a pleasant offset rather than dead-on, and framed close enough that
 * the component actually fills the view) plus a final "Overview" shot using
 * the scene's own default framing. Pure/DOM-free — takes already-computed
 * 3D node placements (core/scene3dLayout.js#computeNode3D output) and the
 * scene's default view, rather than touching Three.js or the live camera
 * state itself. Returns `[]` for an empty diagram (nothing to tour). */
export function computeAutoTourShots(nodes3D, defaultView) {
  // Cycled rather than randomized so re-generating the same diagram's tour
  // twice in a row gives the same result — small, deliberate side angles
  // (never dead-on/0) so every shot reads as "looking at" the component
  // rather than a flat head-on elevation.
  const ANGLE_OFFSETS = [0.55, -0.55, 1.1, -1.1, 1.7, -1.7];
  const shots = nodes3D.map((n3d, i) => {
    const size = Math.max(n3d.width, n3d.height, n3d.depth);
    return {
      theta: defaultView.theta + ANGLE_OFFSETS[i % ANGLE_OFFSETS.length],
      phi: defaultView.phi,
      radius: Math.max(220, size * 2.6),
      target: { x: n3d.x, y: n3d.height / 2, z: n3d.z },
      label: (n3d.label || `Component ${i + 1}`).slice(0, 40),
    };
  });
  if (!shots.length) return [];
  shots.push({
    theta: defaultView.theta,
    phi: defaultView.phi,
    radius: defaultView.radius,
    target: { ...defaultView.target },
    label: 'Overview',
  });
  return shots;
}
