import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerTouchGestureCancel, clearTouchGestureCancel, cancelAnyActiveTouchGesture,
} from '../../js/canvas/touchGestureCoordinator.js';

test('cancelAnyActiveTouchGesture calls the registered callback exactly once, then clears it', () => {
  let calls = 0;
  registerTouchGestureCancel(() => { calls += 1; });
  cancelAnyActiveTouchGesture();
  assert.equal(calls, 1);
  // A second cancel with nothing registered is a harmless no-op.
  cancelAnyActiveTouchGesture();
  assert.equal(calls, 1);
});

test('clearTouchGestureCancel only clears the registration if it matches the given callback', () => {
  let calls = 0;
  const fnA = () => { calls += 1; };
  const fnB = () => { calls += 10; };
  registerTouchGestureCancel(fnA);
  // A stale/unrelated callback's own cleanup must not wipe out fnA's registration.
  clearTouchGestureCancel(fnB);
  cancelAnyActiveTouchGesture();
  assert.equal(calls, 1);
});

test('registering a new gesture replaces whatever was registered before', () => {
  let calls = [];
  registerTouchGestureCancel(() => calls.push('first'));
  registerTouchGestureCancel(() => calls.push('second'));
  cancelAnyActiveTouchGesture();
  assert.deepEqual(calls, ['second']);
});
