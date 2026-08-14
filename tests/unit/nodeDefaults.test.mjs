// io/nodeDefaults.js sits on top of io/storage.js, which degrades
// gracefully with no `window` (see storage.test.mjs) — these tests double
// as that resilience check plus the actual defaults-merging logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNodeDefaults, buildCreationOverrides, DEFAULT_NODE_DEFAULTS } from '../../js/io/nodeDefaults.js';

test('getNodeDefaults returns the built-in defaults when storage is unavailable', () => {
  assert.deepEqual(getNodeDefaults(), DEFAULT_NODE_DEFAULTS);
});

test('buildCreationOverrides maps defaults to node overrides, transparent fill only when requested', () => {
  const overrides = buildCreationOverrides({ transparentFill: false, showIcon: true, textPosition: 'top', subComponentsDisplay: 'full' });
  assert.equal(overrides.iconVisible, true);
  assert.equal(overrides.textPosition, 'top');
  assert.equal(overrides.subComponentsDisplay, 'full');
  assert.equal('fill' in overrides, false, 'fill should not be overridden when transparentFill is off');
});

test('buildCreationOverrides sets fill to transparent when requested', () => {
  const overrides = buildCreationOverrides({ transparentFill: true, showIcon: false, textPosition: 'below', subComponentsDisplay: 'chips' });
  assert.equal(overrides.fill, 'transparent');
  assert.equal(overrides.iconVisible, false);
});
