import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSequenceDiagramPattern } from '../../js/sidebar/patternPreview.js';
import { ALL_COMPONENTS } from '../../js/data/index.js';

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
