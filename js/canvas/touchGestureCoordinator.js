// Tracks the "tear-down" callback for whichever single-finger drag gesture
// (canvas pan, node move/resize, activation move/resize, connector draw) is
// currently active from a touch pointer, so canvas.js#wireTouchGestures can
// cancel it the moment a second finger lands and a two-finger pinch/rotate
// gesture takes over — without this, the first finger's gesture would keep
// reading every subsequent pointermove event (none of this app's drag
// gestures filter by pointerId, since normally only one pointer is ever
// active at a time) and fight the pinch/rotate gesture for the same events.
// Deliberately its own tiny module rather than living in canvas.js: both
// nodeInteractions.js and connectorInteractions.js already import *some*
// things from canvas.js, but this piece of state has nothing to do with
// canvas.js's own rendering and is simpler to reason about on its own.
//
// Only wired into the two gesture families where a first finger landing
// before a deliberate two-finger pinch is actually plausible — canvas pan
// (beginPan) and node move/resize/activation drag (nodeInteractions.js),
// both of which cover large draggable areas. Deliberately NOT wired into
// small precision-target drags (connectorInteractions.js's draw-a-connector,
// edgeReconnect.js, waypointHandles.js, minimap.js) — a second finger
// interrupting one of those would need to "cancel" by simulating a pointerup
// at whatever position was last recorded, which for a connector draw could
// silently commit an edge to a stale hover target instead of cleanly
// aborting; better to leave that rare, extremely low-value edge case as a
// harmless race than risk creating unintended project data.
let cancelActiveTouchGesture = null;

/** Call from a begin*() gesture's own setup, only when `e.pointerType ===
 * 'touch'` — registers `fn` (typically that gesture's own onUp/teardown) as
 * the one to call if a second finger interrupts it. */
export function registerTouchGestureCancel(fn) {
  cancelActiveTouchGesture = fn;
}

/** Call from inside the same `fn` once the gesture ends on its own (finger
 * lifted normally) — clears the registration only if it's still pointing at
 * this exact gesture, so an unrelated later gesture's registration is never
 * accidentally wiped by a stale call. */
export function clearTouchGestureCancel(fn) {
  if (cancelActiveTouchGesture === fn) cancelActiveTouchGesture = null;
}

/** Called by canvas.js#wireTouchGestures the moment a second finger lands —
 * tears down whatever single-finger gesture (if any) the first finger had
 * already started. */
export function cancelAnyActiveTouchGesture() {
  const fn = cancelActiveTouchGesture;
  cancelActiveTouchGesture = null;
  fn?.();
}
