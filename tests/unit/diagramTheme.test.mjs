import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiagramTheme, DIAGRAM_THEMES } from '../../js/core/diagramTheme.js';

function node(id, stroke, fill) {
  return { id, stroke, fill, text: id };
}

test('applyDiagramTheme maps distinct stroke colors to the theme palette, in first-seen order', () => {
  const nodes = [node('a', '#111111', '#eee'), node('b', '#222222', '#eee')];
  const out = applyDiagramTheme(nodes, 'ocean');
  const theme = DIAGRAM_THEMES.ocean;
  assert.equal(out[0].stroke, theme.colors[0]);
  assert.equal(out[1].stroke, theme.colors[1]);
});

test('applyDiagramTheme gives every node sharing an original stroke the same new color', () => {
  const nodes = [node('a', '#111111', '#eee'), node('b', '#111111', '#eee'), node('c', '#222222', '#eee')];
  const out = applyDiagramTheme(nodes, 'forest');
  assert.equal(out[0].stroke, out[1].stroke, 'a and b shared a stroke, so they still match after recoloring');
  assert.notEqual(out[0].stroke, out[2].stroke);
});

test('applyDiagramTheme preserves fill:"transparent" ("No background")', () => {
  const nodes = [node('a', '#111111', 'transparent')];
  const out = applyDiagramTheme(nodes, 'sunset');
  assert.equal(out[0].fill, 'transparent');
});

test('applyDiagramTheme derives a non-transparent fill via tint() of the new stroke', () => {
  const nodes = [node('a', '#111111', '#eeeeee')];
  const out = applyDiagramTheme(nodes, 'monochrome');
  assert.notEqual(out[0].fill, '#eeeeee');
  assert.match(out[0].fill, /^#[0-9a-f]{6}$/i);
});

test('applyDiagramTheme cycles through the palette when there are more distinct colors than swatches', () => {
  const theme = DIAGRAM_THEMES.pastel;
  const nodes = Array.from({ length: theme.colors.length + 2 }, (_, i) => node(`n${i}`, `#${i}${i}${i}${i}${i}${i}`, '#eee'));
  const out = applyDiagramTheme(nodes, 'pastel');
  assert.equal(out[0].stroke, out[theme.colors.length].stroke, 'the (n+1)th distinct color wraps back to the first palette entry');
});

test('applyDiagramTheme does not mutate the input nodes', () => {
  const original = node('a', '#111111', '#eeeeee');
  applyDiagramTheme([original], 'ocean');
  assert.equal(original.stroke, '#111111');
  assert.equal(original.fill, '#eeeeee');
});

test('applyDiagramTheme returns the input unchanged for an unknown theme key', () => {
  const nodes = [node('a', '#111111', '#eeeeee')];
  const out = applyDiagramTheme(nodes, 'not-a-real-theme');
  assert.equal(out, nodes);
});
