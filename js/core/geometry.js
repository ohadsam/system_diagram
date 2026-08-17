// Pure geometry helpers used by the canvas and connector routing.
// No DOM access here so this module is unit-testable in plain Node.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function rectCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Anchor point on a node's border for a given side ('top'|'right'|'bottom'|'left'). */
export function sideAnchor(rect, side) {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.w / 2, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case 'left':
      return { x: rect.x, y: rect.y + rect.h / 2 };
    case 'right':
    default:
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }
}

/** Pick the side of `rect` closest to `point` (used to auto-pick a connector anchor). */
export function closestSide(rect, point) {
  const c = rectCenter(rect);
  const dx = point.x - c.x;
  const dy = point.y - c.y;
  const ratioX = rect.w ? dx / (rect.w / 2) : dx;
  const ratioY = rect.h ? dy / (rect.h / 2) : dy;
  if (Math.abs(ratioX) > Math.abs(ratioY)) {
    return ratioX > 0 ? 'right' : 'left';
  }
  return ratioY > 0 ? 'bottom' : 'top';
}

/**
 * Picks the most sensible anchor side *pair* for a connector between two
 * rects, based purely on their relative position — not on whichever exact
 * connection-point handle a user happened to drag from/to. Prefers
 * whichever axis (horizontal/vertical) the two rects are actually
 * separated along; if they're separated along both (a diagonal
 * arrangement), picks the axis with the *larger* gap, since that's the
 * more clearly dominant separation. Falls back to comparing center deltas
 * only when the rects overlap on both axes (e.g. one nested in/crossing
 * the other), where there's no real "gap" to measure.
 */
export function pickBestSides(fromRect, toRect) {
  const gapX = toRect.x >= fromRect.x + fromRect.w
    ? toRect.x - (fromRect.x + fromRect.w)
    : fromRect.x >= toRect.x + toRect.w
      ? fromRect.x - (toRect.x + toRect.w)
      : -1;
  const gapY = toRect.y >= fromRect.y + fromRect.h
    ? toRect.y - (fromRect.y + fromRect.h)
    : fromRect.y >= toRect.y + toRect.h
      ? fromRect.y - (toRect.y + toRect.h)
      : -1;

  const fc = rectCenter(fromRect);
  const tc = rectCenter(toRect);
  const useX = gapX >= 0 && gapX >= gapY
    ? true
    : gapY >= 0
      ? false
      : Math.abs(tc.x - fc.x) >= Math.abs(tc.y - fc.y);

  if (useX) {
    return tc.x >= fc.x ? { fromSide: 'right', toSide: 'left' } : { fromSide: 'left', toSide: 'right' };
  }
  return tc.y >= fc.y ? { fromSide: 'bottom', toSide: 'top' } : { fromSide: 'top', toSide: 'bottom' };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Straight-line SVG path 'd' between two points. */
export function straightPath(a, b) {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

/** Cubic-bezier curved SVG path 'd' between two points, bulging along the dominant axis. */
export function curvedPath(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = a.x + dx / 2;
    return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  }
  const my = a.y + dy / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
}

/**
 * Orthogonal ("elbow") SVG path between two anchor points, taking the side
 * each point is anchored on into account so the line leaves/enters
 * perpendicular to the node border.
 */
export function orthogonalPath(a, b, fromSide, toSide) {
  const isHFrom = fromSide === 'left' || fromSide === 'right';
  const isHTo = toSide === 'left' || toSide === 'right';

  if (isHFrom && isHTo) {
    const midX = a.x + (b.x - a.x) / 2;
    return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
  }
  if (!isHFrom && !isHTo) {
    const midY = a.y + (b.y - a.y) / 2;
    return `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;
  }
  // Mixed: go from the horizontal side first, then the vertical one.
  if (isHFrom) {
    return `M ${a.x} ${a.y} L ${b.x} ${a.y} L ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} L ${a.x} ${b.y} L ${b.x} ${b.y}`;
}

export function buildPath(routing, a, b, fromSide, toSide) {
  if (routing === 'curved') return curvedPath(a, b);
  if (routing === 'orthogonal') return orthogonalPath(a, b, fromSide, toSide);
  return straightPath(a, b);
}

/** SVG path 'd' through an ordered list of {x,y} points (straight segments). Used for magic-routed edges — see core/magicRouter.js. */
export function waypointsPath(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function rectsIntersect(r1, r2) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function snap(value, gridSize) {
  if (!gridSize) return value;
  return Math.round(value / gridSize) * gridSize;
}
