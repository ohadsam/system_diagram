// The happy paths (an actual Direct API fetch, or a Local AI/WebGPU engine
// call) aren't unit-testable in plain Node — same reasoning as
// tests/unit/autoSuggest.test.mjs and io/aiDirectCall.js's own tests. This
// covers the one pure thing here: failing cleanly with a clear reason when
// no automatic send mode is configured, without ever touching the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { sendPromptAutomatic } from '../../js/io/aiAutoSend.js';

function withStorage(fn) {
  const clear = installMemoryLocalStorage();
  try {
    return fn();
  } finally {
    clear();
    delete globalThis.window;
  }
}

test('sendPromptAutomatic fails cleanly when neither Direct API mode nor Local AI mode is configured', () => withStorage(async () => {
  const result = await sendPromptAutomatic({ prompt: 'hello' });
  assert.equal(result.ok, false);
  assert.match(result.error, /not configured/);
}));
