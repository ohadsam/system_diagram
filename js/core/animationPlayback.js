// Diagram Animation playback — a small state machine (same pub-sub shape as
// canvas/toolMode.js / core/kioskMode.js) that steps through a snapshot of
// `project.animationSteps` one reveal at a time. Deliberately holds its own
// snapshot rather than reading live from the store on every tick: canvas.js
// still renders normally during playback (kiosk mode only hides chrome, it
// doesn't freeze the canvas), so a snapshot keeps "which steps exist and in
// what order" stable for the whole presentation even if something about the
// project were to change mid-playback.
//
// `revealedCount` is how many steps have been revealed so far — the next
// one to reveal is `steps[revealedCount]`. Going backward (prevStep) never
// re-arms an auto-timer on its own; the presenter must advance manually
// after going back, so stepping back never "runs away" forward again on its
// own a moment later.
let playing = false;
let steps = [];
let revealedCount = 0;
let frozen = false;
let timerHandle = null;
const listeners = new Set();

function clearTimer() {
  if (timerHandle != null) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
}

function notify() {
  const snapshot = getAnimationPlaybackState();
  listeners.forEach((fn) => fn(snapshot));
}

/** Arms an auto-advance timer for the next not-yet-revealed step, if it's
 * an 'auto' step and playback isn't frozen — a 'click' step (or the
 * sequence already being fully revealed) leaves nothing scheduled, waiting
 * for a manual `nextStep()` instead. */
function scheduleCurrent() {
  clearTimer();
  if (!playing || frozen || revealedCount >= steps.length) return;
  const step = steps[revealedCount];
  if (step.revealMode === 'auto') {
    timerHandle = setTimeout(() => nextStep(), step.delayMs);
  }
}

export function startPlayback(newSteps) {
  clearTimer();
  playing = true;
  steps = [...newSteps];
  revealedCount = 0;
  frozen = false;
  notify();
  scheduleCurrent();
}

export function stopPlayback() {
  clearTimer();
  playing = false;
  steps = [];
  revealedCount = 0;
  frozen = false;
  notify();
}

export function nextStep() {
  if (!playing || revealedCount >= steps.length) return;
  clearTimer();
  revealedCount += 1;
  notify();
  scheduleCurrent();
}

export function prevStep() {
  if (!playing || revealedCount <= 0) return;
  clearTimer();
  revealedCount -= 1;
  notify();
}

/** Pausing (freezing) cancels any pending auto-advance without changing
 * position — for the presenter's free-draw annotation overlay (see
 * canvas/animationOverlay.js), which wouldn't make sense with the diagram
 * still auto-advancing underneath it. Resuming always restarts the current
 * step's *full* delay rather than trying to track and resume a partial
 * remaining time — simpler, and a presenter resuming from a freeze almost
 * always wants a fresh, predictable window to keep talking anyway. */
export function setFrozen(next) {
  if (!playing || frozen === next) return;
  frozen = next;
  if (frozen) clearTimer();
  else scheduleCurrent();
  notify();
}

export function isAnimationPlaying() {
  return playing;
}

export function isAnimationFrozen() {
  return frozen;
}

export function getAnimationPlaybackState() {
  return { playing, steps, revealedCount, frozen };
}

/** `fn(state)` is called whenever playback starts/stops or the revealed
 * position/freeze state changes. */
export function onAnimationChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
