import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startPlayback, stopPlayback, nextStep, prevStep, jumpToStep, setFrozen,
  setAutoPlayAll, isAutoPlayAll, setLoop, isLoopEnabled,
  isAnimationPlaying, isAnimationFrozen, getAnimationPlaybackState, onAnimationChange,
} from '../../js/core/animationPlayback.js';

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
