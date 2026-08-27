import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSignal, decodeSignal } from '../../js/collab/collabProtocol.js';

test('encodeSignal/decodeSignal round-trips an arbitrary object, including unicode text', () => {
  const original = { type: 'offer', description: { type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n' }, note: 'שלום עולם 🎉' };
  const code = encodeSignal(original);
  assert.equal(typeof code, 'string');
  const result = decodeSignal(code);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, original);
});

test('decodeSignal fails cleanly (never throws) on garbage, empty, or truncated input', () => {
  assert.equal(decodeSignal('').ok, false);
  assert.equal(decodeSignal('   ').ok, false);
  assert.equal(decodeSignal('not base64 at all!!').ok, false);
  assert.equal(decodeSignal(encodeSignal({ a: 1 }).slice(0, -4)).ok, false);
  assert.doesNotThrow(() => decodeSignal(undefined));
});

test('decodeSignal rejects a code that decodes to a non-object (e.g. a bare number or string)', () => {
  const code = Buffer.from('42').toString('base64');
  assert.equal(decodeSignal(code).ok, false);
});
