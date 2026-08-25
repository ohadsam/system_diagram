// Presenter/Kiosk clean mode — hides all UI chrome (toolbar, sidebar, side
// panels) leaving a full-bleed canvas, for presenting a diagram on a screen
// or projector without editing controls in the way. A tiny pub-sub, same
// shape as canvas/toolMode.js, so the toolbar button and the exit-affordance
// UI (toolbar/kioskModeUi.js) stay in sync. Deliberately in-memory only, not
// persisted like io/uiPrefs.js's other toggles — reloading the page should
// never leave a visitor stuck looking at a chrome-less canvas with no
// toolbar to find their way back out of.
let active = false;
const listeners = new Set();

export function isKioskMode() {
  return active;
}

export function setKioskMode(next) {
  if (next === active) return;
  active = next;
  listeners.forEach((fn) => fn(active));
}

export function toggleKioskMode() {
  setKioskMode(!active);
}

/** `fn(active)` is called whenever kiosk mode is turned on or off. */
export function onKioskModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
