// runAutomaticSuggestions' happy paths (an actual Direct API fetch, or a
// Local AI/WebGPU engine call) aren't unit-testable in plain Node — same
// reasoning as tests/unit/webllmEngine.test.mjs and io/aiDirectCall.js's
// own tests, which only exercise up to the network/engine boundary. This
// covers the one thing that's genuinely pure here: failing cleanly with a
// clear reason when no automatic send mode is configured at all, without
// ever touching the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { runAutomaticSuggestions } from '../../js/io/autoSuggest.js';

function withStorage(fn) {
  const clear = installMemoryLocalStorage();
  try {
    return fn();
  } finally {
    clear();
    delete globalThis.window;
  }
}

test('runAutomaticSuggestions fails cleanly when neither Direct API mode nor Local AI mode is configured', () => withStorage(async () => {
  const result = await runAutomaticSuggestions();
  assert.equal(result.ok, false);
  assert.match(result.error, /not configured/);
}));
