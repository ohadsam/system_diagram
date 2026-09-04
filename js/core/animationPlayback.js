// Diagram Animation playback — a small state machine (same pub-sub shape as
// canvas/toolMode.js / core/kioskMode.js) that steps through a snapshot of
// the active animation's steps one reveal at a time. Deliberately holds its
// own snapshot rather than reading live from the store on every tick:
// canvas.js still renders normally during playback (kiosk mode only hides
// chrome, it doesn't freeze the canvas), so a snapshot keeps "which steps
// exist and in what order" stable for the whole presentation even if
// something about the project were to change mid-playback.
//
// `revealedCount` is how many steps have been revealed so far — the next
// one to reveal is `steps[revealedCount]`. Going backward (prevStep) never
// re-arms an auto-timer on its own; the presenter must advance manually
// after going back, so stepping back never "runs away" forward again on its
// own a moment later.
//
// `autoPlayAll`/`loop` are live, session-only presenter choices (the
// overlay's Autoplay/Loop buttons) — deliberately NOT part of the saved
// animation like a step's own revealMode/delayMs or an animation's
// autoFocus: they describe how *this particular showing* should run, reset
// on every stop/start, same as `frozen`.
let playing = false;
let steps = [];
let revealedCount = 0;
let frozen = false;
// Whether the freeze+draw annotation overlay is up — a *subset* of `frozen`
// (drawing always freezes, since scribbling while the diagram keeps
// auto-advancing underneath makes no sense) but not the other way around: a
// presenter can also plain-pause (freeze without drawing) via setFrozen
// directly, e.g. to pause and talk without opening the drawing canvas.
// canvas/animationOverlay.js only shows the draw overlay itself while this
// is true, not merely whenever `frozen` is true.
let drawingActive = false;
let autoPlayAll = false;
let loop = false;
let timerHandle = null;
const listeners = new Set();
// Steps whose own `hideAfterMs` has elapsed since they were revealed — see
// armExpiryFor/syncExpiryToRevealedCount below. A step's targets are
// excluded from the "revealed" set canvas.js#applyAnimationVisibility
// computes once its id lands here,
// even though `revealedCount` itself never moves backward on its own —
// `hideAfterMs` only ever hides a step's *targets*, it never un-advances
// the presentation or affects which step reveals next.
let expiredStepIds = new Set();
// stepId -> setTimeout handle for that step's own pending auto-hide, kept
// separate from `timerHandle` (which only ever tracks the *next-step*
// auto-advance) since a step can have both running at once — a step can be
// 'auto'-advancing to the next one *and* independently counting down its
// own hideAfterMs at the same time.
const expireTimers = new Map();

// Brief pause before looping back to the start, so restarting doesn't feel
// like a jarring instant cut.
const LOOP_RESTART_DELAY_MS = 1200;

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

function clearExpireTimer(stepId) {
  const handle = expireTimers.get(stepId);
  if (handle != null) {
    clearTimeout(handle);
    expireTimers.delete(stepId);
  }
}

function clearAllExpireTimers() {
  for (const handle of expireTimers.values()) clearTimeout(handle);
  expireTimers.clear();
}

/** Arms (or re-arms) a step's own `hideAfterMs` countdown — always the
 * step's *full* duration, never a resumed remainder, same "fresh window"
 * philosophy as setFrozen's own comment below. A no-op step (`hideAfterMs`
 * falsy) just cancels any stale timer, so calling this unconditionally on
 * every reveal is always safe. */
function armExpiryFor(step) {
  clearExpireTimer(step.id);
  if (!step.hideAfterMs) return;
  const handle = setTimeout(() => {
    expiredStepIds.add(step.id);
    expireTimers.delete(step.id);
    notify();
  }, step.hideAfterMs);
  expireTimers.set(step.id, handle);
}

/** Keeps the expire-timer bookkeeping in sync with `revealedCount` actually
 * changing (forward or back) — every step newly in `[oldCount, newCount)`
 * gets a fresh countdown armed (and is un-expired first, in case it was
 * left expired from a previous visit), and every step falling *out* of
 * "revealed" in `[newCount, oldCount)` has its pending countdown cancelled
 * and its expired flag cleared, so revealing it again later always gets a
 * full, fresh hideAfterMs window rather than an instantly-expired one. */
function syncExpiryToRevealedCount(oldCount, newCount) {
  if (newCount > oldCount) {
    for (let i = oldCount; i < newCount; i++) {
      const step = steps[i];
      if (!step) continue;
      expiredStepIds.delete(step.id);
      armExpiryFor(step);
    }
  } else if (newCount < oldCount) {
    for (let i = newCount; i < oldCount; i++) {
      const step = steps[i];
      if (!step) continue;
      clearExpireTimer(step.id);
      expiredStepIds.delete(step.id);
    }
  }
}

/** Re-arms a full, fresh hideAfterMs countdown for every currently-revealed,
 * not-yet-expired step — used when resuming from a freeze (see setFrozen),
 * mirroring its "always a fresh window, never a resumed remainder" choice
 * for the next-step auto-advance timer. */
function rearmExpiryForRevealed() {
  for (let i = 0; i < revealedCount; i++) {
    const step = steps[i];
    if (step && !expiredStepIds.has(step.id)) armExpiryFor(step);
  }
}

/** Arms the next timer: an auto-advance for the next not-yet-revealed step
 * (if it's an 'auto' step, or `autoPlayAll` is forcing every step to
 * advance on its own regardless of its own revealMode), or — once every
 * step is revealed and `loop` is on — a restart back to the beginning.
 * Frozen or not playing leaves nothing scheduled either way. */
function scheduleCurrent() {
  clearTimer();
  if (!playing || frozen) return;
  if (revealedCount >= steps.length) {
    if (loop && steps.length) {
      timerHandle = setTimeout(() => {
        clearAllExpireTimers();
        expiredStepIds = new Set();
        revealedCount = 0;
        notify();
        scheduleCurrent();
      }, LOOP_RESTART_DELAY_MS);
    }
    return;
  }
  const step = steps[revealedCount];
  if (step.revealMode === 'auto' || autoPlayAll) {
    timerHandle = setTimeout(() => nextStep(), step.delayMs);
  }
}

export function startPlayback(newSteps) {
  clearTimer();
  clearAllExpireTimers();
  playing = true;
  steps = [...newSteps];
  revealedCount = 0;
  frozen = false;
  drawingActive = false;
  autoPlayAll = false;
  loop = false;
  expiredStepIds = new Set();
  notify();
  scheduleCurrent();
}

export function stopPlayback() {
  clearTimer();
  clearAllExpireTimers();
  playing = false;
  steps = [];
  revealedCount = 0;
  frozen = false;
  drawingActive = false;
  autoPlayAll = false;
  loop = false;
  expiredStepIds = new Set();
  notify();
}

/** Jumps straight back to the very first step (still revealedCount 0, not
 * "playing" — nothing is auto-revealed) — the panel's/overlay's own
 * "⏮ Restart" button, a one-move shortcut for what repeated `prevStep()`
 * calls would already reach. A thin wrapper over `jumpToStep(0)` so it gets
 * the exact same expire-timer/notify handling for free. */
export function goToStart() {
  jumpToStep(0);
}

export function nextStep() {
  if (!playing || revealedCount >= steps.length) return;
  clearTimer();
  syncExpiryToRevealedCount(revealedCount, revealedCount + 1);
  revealedCount += 1;
  notify();
  scheduleCurrent();
}

export function prevStep() {
  if (!playing || revealedCount <= 0) return;
  clearTimer();
  syncExpiryToRevealedCount(revealedCount, revealedCount - 1);
  revealedCount -= 1;
  notify();
}

/** Jumps straight to a given position (e.g. clicking a progress dot) rather
 * than stepping one at a time — same end state `nextStep`/`prevStep` would
 * reach, just in one move. A no-op if already there. */
export function jumpToStep(targetRevealedCount) {
  if (!playing) return;
  const clamped = Math.max(0, Math.min(steps.length, targetRevealedCount));
  if (clamped === revealedCount) return;
  clearTimer();
  syncExpiryToRevealedCount(revealedCount, clamped);
  revealedCount = clamped;
  notify();
  scheduleCurrent();
}

/** Pausing (freezing) cancels any pending auto-advance without changing
 * position — for the presenter's free-draw annotation overlay (see
 * canvas/animationOverlay.js), which wouldn't make sense with the diagram
 * still auto-advancing underneath it. Resuming always restarts the current
 * step's *full* delay rather than trying to track and resume a partial
 * remaining time — simpler, and a presenter resuming from a freeze almost
 * always wants a fresh, predictable window to keep talking anyway. Any
 * step's own `hideAfterMs` countdown gets the identical treatment: paused
 * (not just left running invisibly) while frozen, then re-armed at its
 * full duration on resume — a presenter who freezes to talk through a step
 * shouldn't come back to find it already vanished, or vanishing a moment
 * later from a countdown that kept running unseen. */
export function setFrozen(next) {
  if (!playing || frozen === next) return;
  frozen = next;
  if (frozen) {
    clearTimer();
    clearAllExpireTimers();
  } else {
    // Resuming always exits drawing too — there's no such thing as "still
    // drawing but no longer frozen" (see `drawingActive`'s own comment).
    drawingActive = false;
    scheduleCurrent();
    rearmExpiryForRevealed();
  }
  notify();
}

/** Forces every remaining step to auto-advance on its own (using its own
 * delayMs) regardless of whether it's set to 'auto' or 'click' — for
 * running the whole sequence unattended (e.g. a kiosk display) without
 * having to change every step's own setting first. */
export function setAutoPlayAll(next) {
  const value = !!next;
  if (autoPlayAll === value) return;
  autoPlayAll = value;
  scheduleCurrent();
  notify();
}

/** Once every step is revealed, restart from the beginning after a short
 * pause instead of just stopping — for a looping unattended display. */
export function setLoop(next) {
  const value = !!next;
  if (loop === value) return;
  loop = value;
  scheduleCurrent();
  notify();
}

export function isAnimationPlaying() {
  return playing;
}

export function isAnimationFrozen() {
  return frozen;
}

/** Toggles the freeze+draw overlay specifically — see `drawingActive`'s own
 * comment. Turning it on also freezes (drawing while the diagram keeps
 * advancing makes no sense); turning it off does *not* automatically
 * resume — canvas/animationOverlay.js's "Done" button explicitly calls
 * `setFrozen(false)` right after, matching its existing behavior, while a
 * presenter who exits drawing some *other* way still ends up merely
 * paused rather than snapping back into a running presentation
 * unexpectedly. */
export function setDrawingActive(next) {
  if (!playing) return;
  const value = !!next;
  if (drawingActive === value) return;
  drawingActive = value;
  if (value) {
    frozen = true;
    clearTimer();
    clearAllExpireTimers();
  }
  notify();
}

export function isDrawingActive() {
  return drawingActive;
}

export function isAutoPlayAll() {
  return autoPlayAll;
}

export function isLoopEnabled() {
  return loop;
}

export function getAnimationPlaybackState() {
  return { playing, steps, revealedCount, frozen, drawingActive, autoPlayAll, loop, expiredStepIds };
}

/** `fn(state)` is called whenever playback starts/stops or the revealed
 * position/freeze/autoPlayAll/loop state changes. */
export function onAnimationChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
