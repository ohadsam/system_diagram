import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_PRESETS, STYLE_PRESET_IDS, getStylePresetFields } from '../../js/core/stylePresets.js';
import { BORDER_STYLES } from '../../js/core/project.js';

const VALID_NODE_FIELDS = new Set(['fill', 'stroke', 'strokeWidth', 'borderStyle', 'dropShadow', 'opacity']);

test('every preset only sets known, valid node-schema fields', () => {
  for (const id of STYLE_PRESET_IDS) {
    const fields = getStylePresetFields(id);
    assert.ok(fields, `${id} should resolve`);
    for (const key of Object.keys(fields)) {
      assert.ok(VALID_NODE_FIELDS.has(key), `${id}.${key} is not a recognized node style field`);
    }
    assert.ok(BORDER_STYLES.includes(fields.borderStyle), `${id}.borderStyle must be a real BORDER_STYLES value`);
    assert.equal(typeof fields.dropShadow, 'boolean');
    assert.ok(fields.opacity >= 0 && fields.opacity <= 100, `${id}.opacity must be in [0,100]`);
  }
});

test('getStylePresetFields strips the display label out of the returned fields', () => {
  for (const id of STYLE_PRESET_IDS) {
    const fields = getStylePresetFields(id);
    assert.equal(fields.label, undefined);
    assert.ok(STYLE_PRESETS[id].label, `${id} should still have its own label for the UI button`);
  }
});

test('getStylePresetFields returns null for an unknown id', () => {
  assert.equal(getStylePresetFields('not-a-real-preset'), null);
});
