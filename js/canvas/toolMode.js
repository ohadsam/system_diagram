// Active canvas interaction tool: 'select' (default — click/marquee-drag,
// dragging a node moves it) or 'hand' (pan-only — dragging anywhere,
// including over a node, pans the canvas without touching components).
// A tiny pub-sub keeps the toolbar button and canvas.js's background
// dispatch in sync, unlike the older Magic Arrow toggle
// (connectorInteractions.js) which only updates its own button's CSS class
// and can desync if the mode were ever changed from elsewhere.
//
// `baseTool` is the persistent choice (toggled by the toolbar buttons or
// the H/V keyboard shortcuts). `spaceHeld` is a momentary override — Figma-
// style hold-Space-to-pan — that never changes `baseTool` itself, so
// releasing Space always restores whichever tool was active before.
let baseTool = 'select';
let spaceHeld = false;
const listeners = new Set();

function effectiveTool() {
  return spaceHeld ? 'hand' : baseTool;
}

/** The tool that should currently govern canvas pointer interactions (accounts for a held Space override). */
export function getToolMode() {
  return effectiveTool();
}

/** The persistently-selected tool (ignores a momentary Space override) — what a toolbar toggle button should show as pressed. */
export function getBaseToolMode() {
  return baseTool;
}

export function setToolMode(mode) {
  if (mode !== 'select' && mode !== 'hand') return;
  if (baseTool === mode) return;
  baseTool = mode;
  notify();
}

export function setSpaceHeld(held) {
  if (spaceHeld === held) return;
  spaceHeld = held;
  notify();
}

function notify() {
  const tool = effectiveTool();
  listeners.forEach((fn) => fn(tool));
}

/** `fn(effectiveTool)` is called whenever the effective tool changes (base tool switched, or Space pressed/released). */
export function onToolModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
