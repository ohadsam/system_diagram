// canvas/suggestions.js's main export (showSuggestionsFor) touches the DOM
// and gets e2e coverage instead (see storage.test.mjs's header comment for
// the general rule) — but getUnattachedLayerSuggestions is a pure filter
// with no DOM/store dependency of its own, so it's unit-testable directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUnattachedLayerSuggestions } from '../../js/canvas/suggestions.js';

test('getUnattachedLayerSuggestions returns [] for a node with no defId (a bare custom shape)', () => {
  assert.deepEqual(getUnattachedLayerSuggestions({ defId: null, subComponents: [] }), []);
});

test('getUnattachedLayerSuggestions returns [] for a component with no curated relatedLayers', () => {
  assert.deepEqual(getUnattachedLayerSuggestions({ defId: 'db-postgres', subComponents: [] }), []);
});

test('getUnattachedLayerSuggestions returns every curated relatedLayers entry when none are attached yet', () => {
  const result = getUnattachedLayerSuggestions({ defId: 'be-express', subComponents: [] });
  assert.deepEqual(result.map((r) => r.name).sort(), ['Controller', 'Middleware'].sort());
});

test('getUnattachedLayerSuggestions drops a suggestion whose name matches an already-attached sub-component', () => {
  const result = getUnattachedLayerSuggestions({ defId: 'be-express', subComponents: [{ id: 'sc1', name: 'Controller', icon: '🎮' }] });
  assert.deepEqual(result.map((r) => r.name), ['Middleware']);
});

test('getUnattachedLayerSuggestions returns [] once every curated suggestion is already attached', () => {
  const result = getUnattachedLayerSuggestions({
    defId: 'be-express',
    subComponents: [{ id: 'sc1', name: 'Controller', icon: '🎮' }, { id: 'sc2', name: 'Middleware', icon: '🍔' }],
  });
  assert.deepEqual(result, []);
});

test('getUnattachedLayerSuggestions handles a missing subComponents array without throwing', () => {
  assert.doesNotThrow(() => getUnattachedLayerSuggestions({ defId: 'be-express' }));
});
