import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKioskMode, setKioskMode, toggleKioskMode, onKioskModeChange } from '../../js/core/kioskMode.js';

test('kioskMode: starts off', () => {
  assert.equal(isKioskMode(), false);
});

test('kioskMode: setKioskMode/toggleKioskMode flip the flag', () => {
  setKioskMode(true);
  assert.equal(isKioskMode(), true);
  toggleKioskMode();
  assert.equal(isKioskMode(), false);
  setKioskMode(false); // already off — should stay off, not throw
  assert.equal(isKioskMode(), false);
});

test('kioskMode: onKioskModeChange only fires on an actual change, with the new value', () => {
  const seen = [];
  const unsubscribe = onKioskModeChange((active) => seen.push(active));
  setKioskMode(true);
  setKioskMode(true); // no-op — same value, must not notify again
  setKioskMode(false);
  assert.deepEqual(seen, [true, false]);
  unsubscribe();
  setKioskMode(true);
  assert.deepEqual(seen, [true, false], 'unsubscribed listener must not fire again');
  setKioskMode(false);
});
