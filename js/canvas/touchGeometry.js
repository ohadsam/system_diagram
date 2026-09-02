// Pure math for canvas.js's two-finger touch gestures (pinch-to-zoom,
// two-finger rotate) — kept dependency-free (no DOM access) so it's
// directly unit-testable, unlike canvas.js itself which can't be imported
// outside a browser (see tests/unit/touchGeometry.test.mjs's header comment).

export function touchPointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function touchPointAngleDeg(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

/** Wraps a rotation delta/sum into the [0, 360) range node.rotation is
 * stored in (see core/project.js's rotation field) — same convention the
 * Rotation style-editor field already normalizes to. */
export function normalizeRotationDeg(deg) {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
