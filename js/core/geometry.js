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
