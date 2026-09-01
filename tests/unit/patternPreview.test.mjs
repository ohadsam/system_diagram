import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSequenceDiagramPattern, shouldShowPreview } from '../../js/sidebar/patternPreview.js';
import { ALL_COMPONENTS, getComponentById } from '../../js/data/index.js';

test('isSequenceDiagramPattern is true only for an all-lifeline pattern def', () => {
  assert.equal(isSequenceDiagramPattern({ kind: 'pattern', pattern: { nodes: [{ defId: 'shape-lifeline' }, { defId: 'shape-lifeline' }] } }), true);
  assert.equal(isSequenceDiagramPattern({ kind: 'pattern', pattern: { nodes: [{ defId: 'shape-lifeline' }, { defId: 'db-postgresql' }] } }), false);
  assert.equal(isSequenceDiagramPattern({ kind: 'component' }), false);
  assert.equal(isSequenceDiagramPattern({ kind: 'pattern', pattern: { nodes: [] } }), false);
  assert.equal(isSequenceDiagramPattern(null), false);
});

test('every real sequence-diagram template in the library passes isSequenceDiagramPattern, and no other pattern does', () => {
  const seqTemplates = ALL_COMPONENTS.filter((c) => c.categoryId === 'sequence-templates' && c.kind === 'pattern');
  assert.ok(seqTemplates.length >= 20, `expected at least 20 sequence-diagram templates, got ${seqTemplates.length}`);
  for (const t of seqTemplates) assert.equal(isSequenceDiagramPattern(t), true, `"${t.id}" should be recognized as a sequence-diagram pattern`);

  const otherPatterns = ALL_COMPONENTS.filter((c) => c.kind === 'pattern' && c.categoryId !== 'sequence-templates');
  assert.ok(otherPatterns.length > 0);
  for (const p of otherPatterns) assert.equal(isSequenceDiagramPattern(p), false, `"${p.id}" (not a sequence template) should not be recognized as one`);
});

test('shouldShowPreview is true for sequence-diagram templates, for long design-pattern/devops descriptions, and false for a short one-liner', () => {
  const seqTemplate = ALL_COMPONENTS.find((c) => c.categoryId === 'sequence-templates' && c.kind === 'pattern');
  assert.equal(shouldShowPreview(seqTemplate), true);

  const singleton = getComponentById('layer-singleton');
  assert.ok(singleton.description.length >= 80, 'layer-singleton should have a rich, multi-sentence description');
  assert.equal(shouldShowPreview(singleton), true);

  const blueGreen = getComponentById('layer-blue-green-deployment');
  assert.ok(blueGreen.description.length >= 80, 'layer-blue-green-deployment should have a rich, multi-sentence description');
  assert.equal(shouldShowPreview(blueGreen), true);

  assert.equal(shouldShowPreview({ kind: 'layer', description: 'Encapsulates business operations.' }), false);
  assert.equal(shouldShowPreview({ kind: 'component', description: '' }), false);
  assert.equal(shouldShowPreview(null), false);
});

test('every GoF/DevOps "design pattern" layer has a rich description long enough for the hover popup', () => {
  const patternLayers = ALL_COMPONENTS.filter((c) => c.kind === 'layer' && c.tags?.includes('gof'));
  assert.ok(patternLayers.length >= 20, `expected at least 20 GoF-tagged layers, got ${patternLayers.length}`);
  const devopsLayers = ALL_COMPONENTS.filter((c) => c.kind === 'layer' && c.tags?.includes('devops'));
  assert.ok(devopsLayers.length >= 8, `expected at least 8 devops-tagged layers, got ${devopsLayers.length}`);
  for (const layer of [...patternLayers, ...devopsLayers]) {
    assert.ok(shouldShowPreview(layer), `"${layer.id}" should have a rich enough description to trigger the hover popup`);
  }
});
