// io/webllmEngine.js — the actual model load + dynamic import() of the
// vendored WebLLM engine isn't exercised here (that needs a real browser
// with WebGPU and a multi-GB download, covered instead by a stubbed e2e
// test — see tests/e2e/ai-provider-direct.spec.js). What's unit-testable
// without a browser is the WebGPU feature-detection and the up-front
// "unsupported" short-circuit both public functions take before ever
// touching the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWebGpuSupported, generateLocal, preloadLocalModel } from '../../js/io/webllmEngine.js';

test('isWebGpuSupported is false with no navigator (plain Node)', () => {
  assert.equal(isWebGpuSupported(), false);
});

test('isWebGpuSupported reflects navigator.gpu when present', () => {
  // Node's global `navigator` is a getter-only accessor (configurable, but
  // no setter) — plain assignment throws in strict-mode ESM, so swap the
  // whole property descriptor instead and restore the original after.
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { value: { gpu: {} }, configurable: true });
    assert.equal(isWebGpuSupported(), true);
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    assert.equal(isWebGpuSupported(), false);
  } finally {
    Object.defineProperty(globalThis, 'navigator', originalDescriptor);
  }
});

test('generateLocal short-circuits with a clear error when WebGPU is unsupported, never touching the network', async () => {
  const result = await generateLocal({ modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', prompt: 'hi' });
  assert.equal(result.ok, false);
  assert.match(result.error, /WebGPU/);
});

test('preloadLocalModel short-circuits the same way', async () => {
  const result = await preloadLocalModel('Llama-3.2-3B-Instruct-q4f16_1-MLC', () => {});
  assert.equal(result.ok, false);
  assert.match(result.error, /WebGPU/);
});
