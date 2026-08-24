import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleNodes } from '../../js/core/scaleDiagram.js';

function node(id, x, y, w, h, fontSize) {
  return { id, x, y, w, h, fontSize, text: 'n' };
}

test('scaleNodes multiplies w/h and fontSize by the factor', () => {
  const nodes = [node('a', 0, 0, 100, 50, 13)];
  const [out] = scaleNodes(nodes, 2, { x: 0, y: 0 });
  assert.equal(out.w, 200);
  assert.equal(out.h, 100);
  assert.equal(out.fontSize, 26);
});

test('scaleNodes keeps the origin point fixed and scales positions around it', () => {
  const nodes = [node('a', 100, 100, 100, 100, 13)];
  const origin = { x: 100, y: 100 };
  const [out] = scaleNodes(nodes, 2, origin);
  assert.equal(out.x, 100, 'a node sitting exactly at the origin does not move');

  const [out2] = scaleNodes([node('b', 200, 100, 100, 100, 13)], 2, origin);
  assert.equal(out2.x, 300, '100px to the right of the origin becomes 200px to the right at 2x');
});

test('scaleNodes never drops fontSize below the readability floor', () => {
  const [out] = scaleNodes([node('a', 0, 0, 100, 50, 8)], 0.1, { x: 0, y: 0 });
  assert.ok(out.fontSize >= 6);
});

test('scaleNodes does not mutate the input nodes', () => {
  const original = node('a', 0, 0, 100, 50, 13);
  scaleNodes([original], 2, { x: 0, y: 0 });
  assert.equal(original.w, 100);
});

test('scaleNodes at factor 1 is a no-op on every scaled field', () => {
  const original = node('a', 10, 20, 100, 50, 13);
  const [out] = scaleNodes([original], 1, { x: 0, y: 0 });
  assert.equal(out.x, 10);
  assert.equal(out.y, 20);
  assert.equal(out.w, 100);
  assert.equal(out.h, 50);
  assert.equal(out.fontSize, 13);
});
