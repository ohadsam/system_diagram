import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMentions } from '../../js/core/mentions.js';

test('plain text with no mentions returns one non-mention segment', () => {
  assert.deepEqual(splitMentions('just a normal note'), [{ mention: false, text: 'just a normal note' }]);
});

test('a single leading mention', () => {
  assert.deepEqual(splitMentions('@alice can you check this?'), [
    { mention: true, text: '@alice' },
    { mention: false, text: ' can you check this?' },
  ]);
});

test('a mention in the middle', () => {
  assert.deepEqual(splitMentions('ping @bob about this'), [
    { mention: false, text: 'ping ' },
    { mention: true, text: '@bob' },
    { mention: false, text: ' about this' },
  ]);
});

test('multiple mentions', () => {
  const segments = splitMentions('@alice and @bob-jones should look');
  assert.deepEqual(segments.filter((s) => s.mention).map((s) => s.text), ['@alice', '@bob-jones']);
});

test('segments concatenate back to the original text', () => {
  const original = 'hey @alice, loop in @bob_2 please';
  const rebuilt = splitMentions(original).map((s) => s.text).join('');
  assert.equal(rebuilt, original);
});

test('empty/missing text does not throw and returns no segments', () => {
  assert.deepEqual(splitMentions(''), []);
  assert.deepEqual(splitMentions(undefined), []);
});

test('a bare "@" with nothing after it is not treated as a mention', () => {
  assert.deepEqual(splitMentions('email me @ noon'), [{ mention: false, text: 'email me @ noon' }]);
});
