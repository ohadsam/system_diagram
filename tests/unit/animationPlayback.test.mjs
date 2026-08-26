import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startPlayback, stopPlayback, nextStep, prevStep, setFrozen,
  isAnimationPlaying, isAnimationFrozen, getAnimationPlaybackState, onAnimationChange,
} from '../../js/core/animationPlayback.js';

// The module holds its state at module scope (like core/kioskMode.js), so
// every test explicitly stops playback first to start from a clean slate —
// there's no other reset hook, same convention as this repo's other
// singleton-module tests.
beforeEach(() => {
  stopPlayback();
});

function clickStep(delayMs = 1000) {
  return { id: `s${Math.random()}`, targetType: 'node', targetId: `n${Math.random()}`, revealMode: 'click', delayMs };
}

function autoStep(delayMs) {
  return { id: `s${Math.random()}`, targetType: 'node', targetId: `n${Math.random()}`, revealMode: 'auto', delayMs };
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

test('stopPlayback resets playing/steps/revealedCount/frozen', () => {
  startPlayback([clickStep()]);
  nextStep();
  setFrozen(true);
  stopPlayback();
  const state = getAnimationPlaybackState();
  assert.equal(state.playing, false);
  assert.deepEqual(state.steps, []);
  assert.equal(state.revealedCount, 0);
  assert.equal(state.frozen, false);
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
