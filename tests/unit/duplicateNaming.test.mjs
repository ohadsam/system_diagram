import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDuplicateName } from '../../js/core/duplicateNaming.js';

test('nextDuplicateName appends " 2" to a plain name with no existing collision', () => {
  assert.equal(nextDuplicateName('Auth Service', ['Auth Service']), 'Auth Service 2');
});

test('nextDuplicateName increments an already-numbered name', () => {
  assert.equal(nextDuplicateName('Auth Service 2', ['Auth Service', 'Auth Service 2']), 'Auth Service 3');
});

test('nextDuplicateName skips past names already in use', () => {
  const existing = ['Web Server', 'Web Server 2', 'Web Server 3'];
  assert.equal(nextDuplicateName('Web Server', existing), 'Web Server 4');
});

test('nextDuplicateName leaves an empty/falsy name untouched', () => {
  assert.equal(nextDuplicateName('', ['x']), '');
});

test('nextDuplicateName treats a name ending in digits that is not actually numbered-suffix style consistently', () => {
  // "Server 2000" reads as stem "Server" + number 2000 by this function's
  // own (deliberately simple) trailing-number convention — next is 2001.
  assert.equal(nextDuplicateName('Server 2000', ['Server 2000']), 'Server 2001');
});
