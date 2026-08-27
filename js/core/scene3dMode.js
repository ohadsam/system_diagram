// "🧊 3D Presentation" on/off state — same tiny pub-sub shape as
// core/kioskMode.js, kept separate since the two are independent (3D mode
// layers a full-viewport WebGL canvas + its own floating controls on top
// of whatever's currently showing, rather than replacing the toolbar/
// sidebar chrome the way Presenter Mode does). In-memory only, not
// persisted — reloading the page should never come back into a 3D view
// with no easy way out.
let active = false;
const listeners = new Set();

export function isScene3DActive() {
  return active;
}

export function setScene3DActive(next) {
  if (next === active) return;
  active = next;
  listeners.forEach((fn) => fn(active));
}

export function toggleScene3D() {
  setScene3DActive(!active);
}

/** `fn(active)` is called whenever 3D Presentation mode is turned on or off. */
export function onScene3DChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
