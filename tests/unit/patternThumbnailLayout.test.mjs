import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePatternThumbnailLayout } from '../../js/core/patternThumbnailLayout.js';

test('an empty/missing pattern produces an empty layout without throwing', () => {
  assert.deepEqual(computePatternThumbnailLayout(undefined), { width: 0, height: 0, boxes: [], edges: [] });
  assert.deepEqual(computePatternThumbnailLayout({ nodes: [] }), { width: 0, height: 0, boxes: [], edges: [] });
});

test('a single node produces one box sized/positioned with the standard margin', () => {
  const layout = computePatternThumbnailLayout({ nodes: [{ key: 'a', defId: 'x', dx: 0, dy: 0 }] });
  assert.equal(layout.boxes.length, 1);
  assert.equal(layout.boxes[0].x, 10);
  assert.equal(layout.boxes[0].y, 10);
  assert.equal(layout.width, 46 + 20);
  assert.equal(layout.height, 30 + 20);
});

test('every box keeps a positive x/y regardless of negative dx/dy offsets', () => {
  const layout = computePatternThumbnailLayout({
    nodes: [
      { key: 'a', defId: 'x', dx: -100, dy: -50 },
      { key: 'b', defId: 'y', dx: 100, dy: 50 },
    ],
  });
  for (const box of layout.boxes) {
    assert.ok(box.x >= 0);
    assert.ok(box.y >= 0);
  }
});

test('edges resolve from/to box centers by key, and skip a dangling reference', () => {
  const layout = computePatternThumbnailLayout({
    nodes: [
      { key: 'a', defId: 'x', dx: 0, dy: 0 },
      { key: 'b', defId: 'y', dx: 100, dy: 0 },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'nonexistent' },
    ],
  });
  assert.equal(layout.edges.length, 1);
  const [a, b] = layout.boxes;
  assert.equal(layout.edges[0].x1, a.cx);
  assert.equal(layout.edges[0].x2, b.cx);
});

test('missing edges array does not throw', () => {
  assert.doesNotThrow(() => computePatternThumbnailLayout({ nodes: [{ key: 'a', defId: 'x', dx: 0, dy: 0 }] }));
});
