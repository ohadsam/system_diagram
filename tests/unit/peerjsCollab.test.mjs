import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomRoomCode, describePeerError } from '../../js/collab/peerjsCollab.js';

test('randomRoomCode produces a 6-character code using only unambiguous uppercase letters/digits', () => {
  const ambiguous = /[0O1IL]/;
  for (let i = 0; i < 50; i++) {
    const code = randomRoomCode();
    assert.equal(code.length, 6);
    assert.equal(code, code.toUpperCase());
    assert.doesNotMatch(code, ambiguous);
  }
});

test('randomRoomCode varies between calls', () => {
  const codes = new Set(Array.from({ length: 20 }, () => randomRoomCode()));
  assert.ok(codes.size > 1, 'extremely unlikely to collide 20 times in a row if actually random');
});

test('describePeerError gives a clear, user-facing message for known PeerJS error types', () => {
  assert.match(describePeerError({ type: 'peer-unavailable' }), /room code isn't active/);
  assert.match(describePeerError({ type: 'unavailable-id' }), /already in use/);
  assert.match(describePeerError({ type: 'network' }), /internet connection/);
  assert.match(describePeerError({ type: 'server-error' }), /internet connection/);
});

test('describePeerError falls back gracefully for an unrecognized or missing error shape', () => {
  assert.match(describePeerError({ type: 'something-new' }), /Connection error/);
  assert.match(describePeerError({ message: 'boom' }), /boom/);
  assert.doesNotThrow(() => describePeerError(undefined));
  assert.doesNotThrow(() => describePeerError(null));
});
