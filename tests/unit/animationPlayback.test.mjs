import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startPlayback, stopPlayback, nextStep, prevStep, jumpToStep, setFrozen, goToStart,
  setDrawingActive, isDrawingActive,
  setAutoPlayAll, isAutoPlayAll, setLoop, isLoopEnabled,
  isAnimationPlaying, isAnimationFrozen, getAnimationPlaybackState, onAnimationChange,
} from '../../js/core/animationPlayback.js';

/** A step whose own `hideAfterMs` auto-hides it a fixed time after it's
 * revealed — independent of revealMode/delayMs, which only govern
 * *advancing to the next step* (see core/project.js#createAnimationStep). */
function hideAfterStep(hideAfterMs, revealMode = 'click', delayMs = 1000) {
  return { id: `s${Math.random()}`, targets: [{ targetType: 'node', targetId: `n${Math.random()}` }], revealMode, delayMs, hideAfterMs };
}

// The module holds its state at module scope (like core/kioskMode.js), so
// every test explicitly stops playback first to start from a clean slate —
// there's no other reset hook, same convention as this repo's other
// singleton-module tests.
beforeEach(() => {
  stopPlayback();
});

// The playback state machine only ever reads a step's own revealMode/
// delayMs — it's deliberately agnostic to `targets` (single or grouped),
// same reasoning core/project.js#createAnimationStep documents — so these
// fixtures carry a `targets` array for realism but it's never asserted on
// here.
function clickStep(delayMs = 1000) {
  return { id: `s${Math.random()}`, targets: [{ targetType: 'node', targetId: `n${Math.random()}` }], revealMode: 'click', delayMs };
}

function autoStep(delayMs) {
  return { id: `s${Math.random()}`, targets: [{ targetType: 'node', targetId: `n${Math.random()}` }], revealMode: 'auto', delayMs };
}

test('isAnimationPlaying is false before any playback starts', () => {
  assert.equal(isAnimationPlaying(), false);
});

test('startPlayback begins at revealedCount 0 with nothing yet revealed', () => {
  startPlayback([clickStep(), clickStep()]);
  assert.equal(isAnimationPlaying(), true);
  const state = getAnimationPlaybackState();
  assert.equal(state.revealedCount, 0);
  assert.equal(state.steps.length, 2);
});

test('nextStep reveals one step at a time and stops at the end', () => {
  startPlayback([clickStep(), clickStep()]);
  nextStep();
  assert.equal(getAnimationPlaybackState().revealedCount, 1);
  nextStep();
  assert.equal(getAnimationPlaybackState().revealedCount, 2);
  nextStep(); // already fully revealed — no-op
  assert.equal(getAnimationPlaybackState().revealedCount, 2);
});

test('prevStep un-reveals one step at a time and stops at the start', () => {
  startPlayback([clickStep(), clickStep()]);
  nextStep();
  nextStep();
  prevStep();
  assert.equal(getAnimationPlaybackState().revealedCount, 1);
  prevStep();
  assert.equal(getAnimationPlaybackState().revealedCount, 0);
  prevStep(); // already at the start — no-op
  assert.equal(getAnimationPlaybackState().revealedCount, 0);
});

test('nextStep/prevStep are no-ops while not playing', () => {
  nextStep();
  prevStep();
  assert.equal(isAnimationPlaying(), false);
});

test('stopPlayback resets playing/steps/revealedCount/frozen/autoPlayAll/loop', () => {
  startPlayback([clickStep()]);
  nextStep();
  setFrozen(true);
  setAutoPlayAll(true);
  setLoop(true);
  stopPlayback();
  const state = getAnimationPlaybackState();
  assert.equal(state.playing, false);
  assert.deepEqual(state.steps, []);
  assert.equal(state.revealedCount, 0);
  assert.equal(state.frozen, false);
  assert.equal(state.autoPlayAll, false);
  assert.equal(state.loop, false);
});

test('startPlayback also resets a stale autoPlayAll/loop from a previous session', () => {
  startPlayback([clickStep()]);
  setAutoPlayAll(true);
  setLoop(true);
  stopPlayback();
  startPlayback([clickStep()]);
  assert.equal(isAutoPlayAll(), false);
  assert.equal(isLoopEnabled(), false);
});

test('jumpToStep moves straight to a given position, forward or backward', () => {
  startPlayback([clickStep(), clickStep(), clickStep()]);
  jumpToStep(2);
  assert.equal(getAnimationPlaybackState().revealedCount, 2);
  jumpToStep(0);
  assert.equal(getAnimationPlaybackState().revealedCount, 0);
});

test('jumpToStep clamps out-of-range targets and is a no-op while not playing', () => {
  startPlayback([clickStep(), clickStep()]);
  jumpToStep(99);
  assert.equal(getAnimationPlaybackState().revealedCount, 2);
  jumpToStep(-5);
  assert.equal(getAnimationPlaybackState().revealedCount, 0);
  stopPlayback();
  jumpToStep(1);
  assert.equal(getAnimationPlaybackState().revealedCount, 0);
});

test('setAutoPlayAll forces a "click" step to auto-advance using its own delay', (t, done) => {
  startPlayback([clickStep(20), clickStep()]);
  setAutoPlayAll(true);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 1, 'the click step advanced on its own once autoplay was enabled');
    done();
  }, 60);
});

test('setLoop restarts from the beginning after a short pause once the end is reached', (t, done) => {
  // A single "click" step (rather than "auto") so that once it loops back
  // to revealedCount 0, nothing schedules a further auto-advance on its
  // own — isolating the assertion to just the loop-restart behavior itself.
  startPlayback([clickStep()]);
  nextStep(); // now at the end (revealedCount === steps.length)
  setLoop(true);
  assert.equal(getAnimationPlaybackState().revealedCount, 1, 'still at the end immediately after enabling loop');
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 0, 'looped back to the start after the short restart pause');
    done();
  }, 1400);
});

test('without loop enabled, reaching the end just stops — no restart', (t, done) => {
  startPlayback([clickStep()]);
  nextStep();
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 1, 'stays at the end without loop');
    done();
  }, 1400);
});

test('an "auto" step reveals itself on its own after its delay', (t, done) => {
  startPlayback([autoStep(20)]);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 1);
    done();
  }, 60);
});

test('a "click" step never advances on its own, however long it waits', (t, done) => {
  startPlayback([clickStep(20)]);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 0);
    done();
  }, 60);
});

test('setFrozen(true) pauses a pending auto-advance; going back to false resumes it', (t, done) => {
  startPlayback([autoStep(30)]);
  setFrozen(true);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 0, 'frozen — the timer must not have fired');
    setFrozen(false);
    setTimeout(() => {
      assert.equal(getAnimationPlaybackState().revealedCount, 1, 'unfrozen — the (restarted) timer eventually fires');
      done();
    }, 60);
  }, 60);
});

test('going back after an auto step never re-arms its timer on its own', (t, done) => {
  startPlayback([autoStep(20), clickStep()]);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().revealedCount, 1);
    prevStep();
    assert.equal(getAnimationPlaybackState().revealedCount, 0);
    setTimeout(() => {
      assert.equal(getAnimationPlaybackState().revealedCount, 0, 'stepping back must not silently jump forward again on its own');
      done();
    }, 60);
  }, 40);
});

test('setFrozen is a no-op while not playing', () => {
  setFrozen(true);
  assert.equal(isAnimationFrozen(), false);
});

test('onAnimationChange fires with the latest state on every change, and unsubscribe stops further calls', () => {
  const seen = [];
  const unsubscribe = onAnimationChange((state) => seen.push(state.revealedCount));
  startPlayback([clickStep(), clickStep()]);
  nextStep();
  unsubscribe();
  nextStep();
  assert.deepEqual(seen, [0, 1]);
  assert.equal(getAnimationPlaybackState().revealedCount, 2, 'the underlying state still advances after unsubscribing, only notifications stop');
});

test('a step with hideAfterMs is not expired the instant it reveals', () => {
  const step = hideAfterStep(20);
  startPlayback([step]);
  nextStep();
  assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false);
});

test('a step with hideAfterMs auto-expires once its own timer elapses', (t, done) => {
  const step = hideAfterStep(20);
  startPlayback([step]);
  nextStep();
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), true);
    done();
  }, 60);
});

test('a step with hideAfterMs unset (0) never expires', (t, done) => {
  const step = hideAfterStep(0);
  startPlayback([step]);
  nextStep();
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false);
    done();
  }, 60);
});

test('stepping back before an expired step un-expires it, and stepping forward again gets a fresh countdown', (t, done) => {
  const step = hideAfterStep(20);
  startPlayback([step, clickStep()]);
  nextStep(); // reveal the hideAfter step
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), true, 'expired after its own timer');
    prevStep(); // un-reveal it
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false, 'un-expired the moment it is no longer revealed');
    nextStep(); // reveal it again — should start a brand-new full countdown
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false, 'not immediately expired on a fresh reveal');
    setTimeout(() => {
      assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), true, 'expires again after the fresh countdown elapses');
      done();
    }, 30);
  }, 30);
});

test('jumpToStep forward arms hideAfterMs for every newly-revealed step, and jumping back un-expires steps no longer revealed', (t, done) => {
  const a = hideAfterStep(20);
  const b = hideAfterStep(20);
  startPlayback([a, b]);
  jumpToStep(2); // reveal both at once
  setTimeout(() => {
    const state = getAnimationPlaybackState();
    assert.equal(state.expiredStepIds.has(a.id), true);
    assert.equal(state.expiredStepIds.has(b.id), true);
    jumpToStep(0); // un-reveal both
    const stateAfter = getAnimationPlaybackState();
    assert.equal(stateAfter.expiredStepIds.has(a.id), false, 'jumping back un-expires a step no longer revealed');
    assert.equal(stateAfter.expiredStepIds.has(b.id), false);
    done();
  }, 60);
});

test('setFrozen pauses a pending hideAfterMs countdown; resuming re-arms its full duration', (t, done) => {
  const step = hideAfterStep(40);
  startPlayback([step]);
  nextStep();
  setFrozen(true);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false, 'frozen — the hide timer must not have fired');
    setFrozen(false);
    setTimeout(() => {
      assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false, 'resumed with a fresh full countdown, not the already-elapsed remainder');
      setTimeout(() => {
        assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), true, 'the fresh post-resume countdown eventually elapses');
        done();
      }, 30);
    }, 10);
  }, 60);
});

test('stopPlayback and a fresh startPlayback both clear any stale expiredStepIds', (t, done) => {
  const step = hideAfterStep(20);
  startPlayback([step]);
  nextStep();
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), true);
    stopPlayback();
    assert.equal(getAnimationPlaybackState().expiredStepIds.size, 0);
    startPlayback([hideAfterStep(0)]);
    assert.equal(getAnimationPlaybackState().expiredStepIds.size, 0);
    done();
  }, 60);
});

test('looping back to the start clears expiredStepIds so a hideAfterMs step shows again next time around', (t, done) => {
  const step = hideAfterStep(20);
  startPlayback([step]);
  nextStep(); // now at the end
  setLoop(true);
  setTimeout(() => {
    assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), true, 'expired during the first pass');
    setTimeout(() => {
      assert.equal(getAnimationPlaybackState().revealedCount, 0, 'looped back to the start');
      assert.equal(getAnimationPlaybackState().expiredStepIds.has(step.id), false, 'expiry reset for the new pass');
      done();
    }, 1400);
  }, 60);
});

test('goToStart jumps straight back to revealedCount 0 from anywhere', () => {
  startPlayback([clickStep(), clickStep(), clickStep()]);
  nextStep();
  nextStep();
  assert.equal(getAnimationPlaybackState().revealedCount, 2);
  goToStart();
  assert.equal(getAnimationPlaybackState().revealedCount, 0);
});

test('setDrawingActive(true) also freezes; isDrawingActive/isAnimationFrozen both reflect it', () => {
  startPlayback([clickStep()]);
  assert.equal(isDrawingActive(), false);
  setDrawingActive(true);
  assert.equal(isDrawingActive(), true);
  assert.equal(isAnimationFrozen(), true, 'drawing implies frozen');
});

test('a plain setFrozen(true) does NOT turn on drawingActive — pausing and drawing are independent', () => {
  startPlayback([clickStep()]);
  setFrozen(true);
  assert.equal(isAnimationFrozen(), true);
  assert.equal(isDrawingActive(), false, 'a plain pause is not "drawing"');
});

test('resuming (setFrozen(false)) always exits drawing too, even if it was never explicitly turned off', () => {
  startPlayback([clickStep()]);
  setDrawingActive(true);
  setFrozen(false);
  assert.equal(isAnimationFrozen(), false);
  assert.equal(isDrawingActive(), false, 'there is no "still drawing but not frozen" state');
});

test('setDrawingActive is a no-op while not playing', () => {
  setDrawingActive(true);
  assert.equal(isDrawingActive(), false);
});

test('stopPlayback and a fresh startPlayback both reset drawingActive', () => {
  startPlayback([clickStep()]);
  setDrawingActive(true);
  stopPlayback();
  assert.equal(isDrawingActive(), false);
  startPlayback([clickStep()]);
  assert.equal(isDrawingActive(), false);
});
