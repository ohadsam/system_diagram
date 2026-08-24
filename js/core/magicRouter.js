// Pure, DOM-free obstacle-avoiding router (the "magic" routing style):
// finds an orthogonal path between two node anchors that avoids every
// other node's bounding box, using as few turns as possible. No DOM/store
// access, so it's trivially unit-testable and reusable — see
// canvas/connector.js for where it's actually rendered, and for how the
// default 'orthogonal' routing uses this exact same router.
//
// Approach: quantize the area between the two nodes (plus obstacles) into a
// grid, then run a 0-1-weighted shortest-path search (Dijkstra via a bucket
// queue — edges cost 0 to continue straight, 1 to turn) from the source's
// exit point to the target's entry point. The grid resolution adapts to the
// bounding area so the search stays bounded regardless of canvas scale; if
// it can't find a route within that budget, it returns null so the caller
// can fall back to a plain elbow route instead of hanging or crashing.
import { sideAnchor } from './geometry.js';

const MAX_CELLS = 14000;
const MARGIN = 60;
const OBSTACLE_PADDING = 12;
const EXIT_STUB = 28;
const MIN_CELL = 8;
const MAX_CELL = 40;

const DIRS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

function sideNormal(side) {
  if (side === 'top') return { dx: 0, dy: -1 };
  if (side === 'bottom') return { dx: 0, dy: 1 };
  if (side === 'left') return { dx: -1, dy: 0 };
  return { dx: 1, dy: 0 };
}

function dirIndex(dx, dy) {
  return DIRS.findIndex((d) => d.dx === dx && d.dy === dy);
}

function inflate(rect, padding) {
  return { x: rect.x - padding, y: rect.y - padding, w: rect.w + padding * 2, h: rect.h + padding * 2 };
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * @param {{x:number,y:number,w:number,h:number}} fromRect
 * @param {{x:number,y:number,w:number,h:number}} toRect
 * @param {{x:number,y:number,w:number,h:number}[]} obstacles other node rects to avoid (must already exclude fromRect/toRect)
 * @param {'top'|'right'|'bottom'|'left'} fromSide
 * @param {'top'|'right'|'bottom'|'left'} toSide
 * @param {number} [fromOffset] 0..1 along fromSide, default 0.5 (midpoint)
 * @param {number} [toOffset] 0..1 along toSide, default 0.5 (midpoint)
 * @returns {{x:number,y:number}[]|null} ordered waypoints from the `from` anchor to the `to` anchor, or null if no route was found
 */
export function computeMagicWaypoints(fromRect, toRect, obstacles, fromSide, toSide, fromOffset = 0.5, toOffset = 0.5) {
  const a = sideAnchor(fromRect, fromSide, fromOffset);
  const b = sideAnchor(toRect, toSide, toOffset);
  const aNormal = sideNormal(fromSide);
  const bNormal = sideNormal(toSide);
  const aStub = { x: a.x + aNormal.dx * EXIT_STUB, y: a.y + aNormal.dy * EXIT_STUB };
  const bStub = { x: b.x + bNormal.dx * EXIT_STUB, y: b.y + bNormal.dy * EXIT_STUB };

  const inflated = obstacles.map((o) => inflate(o, OBSTACLE_PADDING));

  const xs = [aStub.x, bStub.x, ...inflated.map((o) => o.x), ...inflated.map((o) => o.x + o.w)];
  const ys = [aStub.y, bStub.y, ...inflated.map((o) => o.y), ...inflated.map((o) => o.y + o.h)];
  const minX = Math.min(...xs) - MARGIN;
  const maxX = Math.max(...xs) + MARGIN;
  const minY = Math.min(...ys) - MARGIN;
  const maxY = Math.max(...ys) + MARGIN;

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const cell = clampInt(Math.sqrt((spanX * spanY) / MAX_CELLS), MIN_CELL, MAX_CELL);
  const cols = Math.max(2, Math.ceil(spanX / cell));
  const rows = Math.max(2, Math.ceil(spanY / cell));
  if (cols * rows > MAX_CELLS * 2) return null;

  const cellOf = (p) => ({
    cx: clampInt(Math.round((p.x - minX) / cell), 0, cols - 1),
    cy: clampInt(Math.round((p.y - minY) / cell), 0, rows - 1),
  });
  const pointOf = (cx, cy) => ({ x: minX + cx * cell, y: minY + cy * cell });

  const blocked = new Uint8Array(cols * rows);
  for (const o of inflated) {
    const c0 = cellOf({ x: o.x, y: o.y });
    const c1 = cellOf({ x: o.x + o.w, y: o.y + o.h });
    for (let cy = c0.cy; cy <= c1.cy; cy += 1) {
      for (let cx = c0.cx; cx <= c1.cx; cx += 1) blocked[cy * cols + cx] = 1;
    }
  }

  const start = cellOf(aStub);
  const goal = cellOf(bStub);
  blocked[start.cy * cols + start.cx] = 0;
  blocked[goal.cy * cols + goal.cx] = 0;

  const startDir = dirIndex(Math.sign(aNormal.dx), Math.sign(aNormal.dy));
  const cellPath = leastBendPath(cols, rows, blocked, start, goal, startDir);
  if (!cellPath) return null;

  const turnPoints = simplifyTurns(cellPath).map(({ cx, cy }) => pointOf(cx, cy));
  return enforceOrthogonal([a, aStub, ...turnPoints, bStub, b]);
}

/** 0-1 BFS (bucket-queue Dijkstra) over grid cells, state = (cell, last direction), minimizing turn count. */
function leastBendPath(cols, rows, blocked, start, goal, startDir) {
  const numCells = cols * rows;
  const numDirs = DIRS.length;
  const numStates = numCells * (numDirs + 1); // +1 slot (index 0) for "no direction chosen yet"
  const cellIndex = (cx, cy) => cy * cols + cx;
  const stateId = (ci, dir) => ci * (numDirs + 1) + dir;

  const startCell = cellIndex(start.cx, start.cy);
  const goalCell = cellIndex(goal.cx, goal.cy);
  const startState = stateId(startCell, startDir >= 0 ? startDir + 1 : 0);

  const dist = new Int32Array(numStates).fill(-1);
  const prevState = new Int32Array(numStates).fill(-1);
  const maxCost = cols + rows + 4;
  const buckets = Array.from({ length: maxCost + 2 }, () => []);
  dist[startState] = 0;
  buckets[0].push(startState);

  let foundState = -1;
  for (let cost = 0; cost <= maxCost && foundState === -1; cost += 1) {
    const bucket = buckets[cost];
    while (bucket.length) {
      const s = bucket.pop();
      if (dist[s] !== cost) continue; // stale entry from an earlier, worse relaxation
      const ci = Math.floor(s / (numDirs + 1));
      if (ci === goalCell) { foundState = s; break; }
      const dir = s % (numDirs + 1);
      const cx = ci % cols;
      const cy = Math.floor(ci / cols);
      for (let d = 0; d < numDirs; d += 1) {
        const nx = cx + DIRS[d].dx;
        const ny = cy + DIRS[d].dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const ni = cellIndex(nx, ny);
        if (blocked[ni]) continue;
        const turning = dir !== 0 && dir - 1 !== d;
        const ncost = cost + (turning ? 1 : 0);
        const ns = stateId(ni, d + 1);
        if (dist[ns] === -1 || ncost < dist[ns]) {
          dist[ns] = ncost;
          prevState[ns] = s;
          if (ncost <= maxCost) buckets[ncost].push(ns);
        }
      }
    }
  }
  if (foundState === -1) return null;

  const path = [];
  let cur = foundState;
  while (cur !== -1) {
    const ci = Math.floor(cur / (numDirs + 1));
    path.push({ cx: ci % cols, cy: Math.floor(ci / cols) });
    cur = prevState[cur];
  }
  path.reverse();
  return path;
}

/** Collapses a cell-by-cell path down to just its turning points (plus both endpoints). */
function simplifyTurns(path) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = path[i - 1];
    const cur = path[i];
    const next = path[i + 1];
    const inDx = cur.cx - prev.cx;
    const inDy = cur.cy - prev.cy;
    const outDx = next.cx - cur.cx;
    const outDy = next.cy - cur.cy;
    if (inDx !== outDx || inDy !== outDy) out.push(cur);
  }
  out.push(path[path.length - 1]);
  return out;
}

/** Safety pass: guarantees every consecutive pair of points shares an x or y
 * (never both different), inserting a corner if needed, and drops
 * duplicate/collinear-redundant points. Grid quantization near the fixed
 * anchor/stub points is the only place a diagonal could otherwise sneak in. */
function enforceOrthogonal(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    const p = points[i];
    const dx = Math.abs(p.x - prev.x);
    const dy = Math.abs(p.y - prev.y);
    if (dx < 0.01 && dy < 0.01) continue;
    if (dx > 0.01 && dy > 0.01) out.push({ x: p.x, y: prev.y });
    out.push(p);
  }
  return dedupeCollinear(out);
}

function dedupeCollinear(points) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const sameLine = (Math.abs(prev.x - cur.x) < 0.01 && Math.abs(cur.x - next.x) < 0.01)
      || (Math.abs(prev.y - cur.y) < 0.01 && Math.abs(cur.y - next.y) < 0.01);
    if (!sameLine) out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}
