import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShrinkThumbnail } from '../../js/canvas/shrinkThumbnail.js';

const node = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });

test('empty members returns empty boxes/lines', () => {
  assert.deepEqual(computeShrinkThumbnail([], [], 100, 100), { boxes: [], lines: [] });
  assert.deepEqual(computeShrinkThumbnail(null, [], 100, 100), { boxes: [], lines: [] });
});

test('a zero/negative target size returns empty output rather than dividing by zero', () => {
  const members = [node('a', 0, 0, 100, 100)];
  assert.deepEqual(computeShrinkThumbnail(members, [], 0, 50), { boxes: [], lines: [] });
  assert.deepEqual(computeShrinkThumbnail(members, [], 50, -1), { boxes: [], lines: [] });
});

test('a single member is scaled down to fit within the target box, centered', () => {
  const members = [node('a', 0, 0, 100, 100, { icon: '🖥️', fill: '#ABCDEF' })];
  const { boxes } = computeShrinkThumbnail(members, [], 84, 60);
  assert.equal(boxes.length, 1);
  const box = boxes[0];
  assert.equal(box.id, 'a');
  assert.equal(box.icon, '🖥️');
  assert.equal(box.fill, '#ABCDEF');
  // 100x100 span fit into an 84x60 box (minus padding) is height-bound.
  assert.ok(box.w <= 84);
  assert.ok(box.h <= 60);
  assert.equal(box.w, box.h); // original was square, so the scaled box stays square
});

test('two members preserve their relative layout at a shared scale', () => {
  const members = [
    node('a', 0, 0, 100, 100),
    node('b', 200, 0, 100, 100), // twice as far right as "a" is wide
  ];
  const { boxes } = computeShrinkThumbnail(members, [], 200, 100);
  const a = boxes.find((b) => b.id === 'a');
  const b = boxes.find((b) => b.id === 'b');
  // Same scale applied to both — the gap between them stays proportional to their own width.
  const gap = b.x - (a.x + a.w);
  assert.ok(Math.abs(gap - a.w) < 0.01);
});

test('a degenerate (zero-span) group of stacked identical-position members does not blow up', () => {
  const members = [node('a', 5, 5, 10, 10), node('b', 5, 5, 10, 10)];
  const { boxes } = computeShrinkThumbnail(members, [], 84, 60);
  assert.equal(boxes.length, 2);
  for (const box of boxes) {
    assert.ok(Number.isFinite(box.x) && Number.isFinite(box.y));
    assert.ok(box.w >= 2 && box.h >= 2);
  }
});

test('an edge between two known members produces a line between their centers', () => {
  const members = [node('a', 0, 0, 100, 100), node('b', 200, 0, 100, 100)];
  const { boxes, lines } = computeShrinkThumbnail(members, [{ from: 'a', to: 'b' }], 200, 100);
  assert.equal(lines.length, 1);
  const a = boxes.find((b) => b.id === 'a');
  const b = boxes.find((b) => b.id === 'b');
  assert.equal(lines[0].x1, a.x + a.w / 2);
  assert.equal(lines[0].y1, a.y + a.h / 2);
  assert.equal(lines[0].x2, b.x + b.w / 2);
  assert.equal(lines[0].y2, b.y + b.h / 2);
});

test('an edge referencing an unknown member id is silently dropped', () => {
  const members = [node('a', 0, 0, 100, 100)];
  const { lines } = computeShrinkThumbnail(members, [{ from: 'a', to: 'ghost' }], 100, 100);
  assert.equal(lines.length, 0);
});

test('a member using an uploaded icon image renders no text icon glyph', () => {
  const members = [node('a', 0, 0, 100, 100, { icon: '🖥️', iconImage: 'data:image/png;base64,xyz' })];
  const { boxes } = computeShrinkThumbnail(members, [], 84, 60);
  assert.equal(boxes[0].icon, '');
});

test('a member missing fill falls back to white', () => {
  const members = [node('a', 0, 0, 100, 100)];
  const { boxes } = computeShrinkThumbnail(members, [], 84, 60);
  assert.equal(boxes[0].fill, '#FFFFFF');
});
