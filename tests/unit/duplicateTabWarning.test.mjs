import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDuplicateTabWarning } from '../../js/io/duplicateTabWarning.js';

function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('duplicateTabWarning: a lone tab never gets warned', async () => {
  const calls = [];
  const dispose = initDuplicateTabWarning((msg, kind) => calls.push([msg, kind]));
  await waitFor(50);
  assert.deepEqual(calls, []);
  dispose();
});

test('duplicateTabWarning: a second tab opening triggers a warning in both', async () => {
  const callsA = [];
  const callsB = [];
  const disposeA = initDuplicateTabWarning((msg, kind) => callsA.push([msg, kind]));
  await waitFor(20);
  const disposeB = initDuplicateTabWarning((msg, kind) => callsB.push([msg, kind]));
  await waitFor(50);
  assert.equal(callsA.length, 1, 'the first tab should be warned once it sees the second');
  assert.equal(callsB.length, 1, 'the second tab should be warned once it sees the first');
  assert.equal(callsA[0][1], 'error');
  assert.match(callsA[0][0], /already open in another browser tab/);
  disposeA();
  disposeB();
});
