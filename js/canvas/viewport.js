// Pan/zoom state for the canvas and screen<->canvas coordinate conversion.
// Deliberately outside core/store.js: this is transient view state, not
// project data that needs undo/redo (the project's last-saved viewport is
// still persisted separately by canvas.js on gesture end).
import { clamp } from '../core/geometry.js';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

let viewportEl = null;
let contentEl = null;
let state = { x: 0, y: 0, zoom: 1 };
const listeners = new Set();

export function initViewport(viewportElement, contentElement, initial) {
  viewportEl = viewportElement;
  contentEl = contentElement;
  if (initial) state = { ...state, ...initial };
  applyTransform();
}

export function getViewport() {
  return { ...state };
}

export function setViewport(next, { silent = false } = {}) {
  state = { ...state, ...next };
  applyTransform();
  if (!silent) for (const fn of listeners) fn(state);
}

export function onViewportChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyTransform() {
  if (!contentEl) return;
  contentEl.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.zoom})`;
}

export function pan(dx, dy) {
  setViewport({ x: state.x + dx, y: state.y + dy });
}

/** Zoom by `factor`, keeping the point at (clientX, clientY) visually fixed. */
export function zoomAt(factor, clientX, clientY) {
  const rect = viewportEl.getBoundingClientRect();
  const nextZoom = clamp(state.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const actualFactor = nextZoom / state.zoom;
  const originX = clientX - rect.left;
  const originY = clientY - rect.top;
  const nextX = originX - (originX - state.x) * actualFactor;
  const nextY = originY - (originY - state.y) * actualFactor;
  setViewport({ x: nextX, y: nextY, zoom: nextZoom });
}

export function zoomTo(zoom, { center = true } = {}) {
  const rect = viewportEl.getBoundingClientRect();
  const clientX = center ? rect.left + rect.width / 2 : 0;
  const clientY = center ? rect.top + rect.height / 2 : 0;
  const factor = clamp(zoom, MIN_ZOOM, MAX_ZOOM) / state.zoom;
  if (center) zoomAt(factor, clientX, clientY);
  else setViewport({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
}

export function screenToCanvas(clientX, clientY) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.x) / state.zoom,
    y: (clientY - rect.top - state.y) / state.zoom,
  };
}

export function fitToContent(bounds, padding = 60) {
  if (!viewportEl || !bounds) return;
  const rect = viewportEl.getBoundingClientRect();
  const w = Math.max(bounds.w, 1);
  const h = Math.max(bounds.h, 1);
  const zoom = clamp(Math.min((rect.width - padding * 2) / w, (rect.height - padding * 2) / h, MAX_ZOOM), MIN_ZOOM, MAX_ZOOM);
  const x = rect.width / 2 - (bounds.x + w / 2) * zoom;
  const y = rect.height / 2 - (bounds.y + h / 2) * zoom;
  setViewport({ x, y, zoom });
}

export function resetViewport() {
  setViewport({ x: 0, y: 0, zoom: 1 });
}
