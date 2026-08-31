import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLifelines, distributeLifelineColumns, distributeMessages, spaceMessagesForLabels } from '../../js/core/sequenceDiagram.js';

const SIZE = { w: 140, h: 640 };

function lifeline(id, x, y = 0) {
  return { id, shape: 'lifeline', x, y, w: SIZE.w, h: SIZE.h };
}

function message(id, from, to, fromOffset, toOffset, fromSide = 'right', toSide = 'left') {
  return { id, from, to, fromSide, toSide, fromOffset, toOffset };
}

test('layoutLifelines places one rect per name, each with the given size', () => {
  const result = layoutLifelines(['Client', 'Server'], 0, 0, SIZE);
  assert.equal(result.length, 2);
  for (const r of result) {
    assert.equal(r.w, SIZE.w);
    assert.equal(r.h, SIZE.h);
  }
  assert.equal(result[0].text, 'Client');
  assert.equal(result[1].text, 'Server');
});

test('layoutLifelines spaces lifelines evenly left to right', () => {
  const result = layoutLifelines(['A', 'B', 'C'], 0, 0, SIZE);
  const gap1 = result[1].x - result[0].x;
  const gap2 = result[2].x - result[1].x;
  assert.equal(gap1, gap2);
  assert.ok(gap1 > SIZE.w, 'lifelines do not overlap');
});

test('layoutLifelines centers the whole row on the given point', () => {
  const result = layoutLifelines(['A', 'B'], 1000, 500, SIZE);
  const minX = Math.min(...result.map((r) => r.x));
  const maxX = Math.max(...result.map((r) => r.x + r.w));
  assert.ok(Math.abs((minX + maxX) / 2 - 1000) < 1e-9);
  for (const r of result) assert.equal(r.y, 500);
});

test('layoutLifelines handles a single participant (still centered, no crash)', () => {
  const result = layoutLifelines(['Solo'], 200, 300, SIZE);
  assert.equal(result.length, 1);
  assert.equal(result[0].x, 200 - SIZE.w / 2);
});

test('layoutLifelines handles a larger group (6 participants)', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  const result = layoutLifelines(names, 0, 0, SIZE);
  assert.equal(result.length, 6);
  const xs = result.map((r) => r.x);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), 'left to right order preserved');
});

test('layoutLifelines returns an empty array for no names', () => {
  assert.deepEqual(layoutLifelines([], 0, 0, SIZE), []);
});

test('distributeLifelineColumns re-spaces lifelines to a uniform gap, preserving left-to-right order and anchoring the leftmost one', () => {
  const nodes = [lifeline('c', 900, 10), lifeline('a', 0, 20), lifeline('b', 50, 30)];
  const updates = distributeLifelineColumns(nodes);
  assert.equal(updates.get('a'), 0, 'leftmost node keeps its own x as the anchor');
  const gap1 = updates.get('b') - updates.get('a');
  const gap2 = updates.get('c') - updates.get('b');
  assert.equal(gap1, gap2);
  assert.ok(gap1 > SIZE.w);
});

test('distributeLifelineColumns returns nothing for fewer than 2 lifelines', () => {
  assert.equal(distributeLifelineColumns([lifeline('solo', 0)]).size, 0);
  assert.equal(distributeLifelineColumns([]).size, 0);
});

test('distributeLifelineColumns ignores non-lifeline nodes', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 500), { id: 'rect', shape: 'rect', x: 250, y: 0, w: 160, h: 84 }];
  const updates = distributeLifelineColumns(nodes);
  assert.equal(updates.size, 2);
  assert.ok(!updates.has('rect'));
});

test('distributeMessages evenly spaces messages between the same pair of lifelines, preserving their current top-to-bottom order', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 300)];
  // Deliberately out of order and unevenly spaced (0.9 comes first in the
  // array but should still end up *last* since it's lowest on the canvas).
  const edges = [
    message('e-low', 'a', 'b', 0.9, 0.9),
    message('e-high', 'a', 'b', 0.1, 0.1),
    message('e-mid', 'a', 'b', 0.5, 0.5),
  ];
  const updates = distributeMessages(nodes, edges);
  assert.ok(updates.get('e-high').fromOffset < updates.get('e-mid').fromOffset);
  assert.ok(updates.get('e-mid').fromOffset < updates.get('e-low').fromOffset);
  // Non-self messages stay horizontal — both ends land on the same height.
  for (const id of ['e-low', 'e-high', 'e-mid']) {
    assert.equal(updates.get(id).fromOffset, updates.get(id).toOffset);
  }
});

test('distributeMessages gives a self-message two distinct, ordered offsets (start and end of its loop)', () => {
  const nodes = [lifeline('a', 0)];
  const edges = [message('self', 'a', 'a', 0.2, 0.8, 'right', 'right')];
  const updates = distributeMessages(nodes, edges);
  const { fromOffset, toOffset } = updates.get('self');
  assert.ok(fromOffset < toOffset);
});

test('distributeMessages ignores edges that are not lifeline-to-lifeline messages', () => {
  const nodes = [lifeline('a', 0), { id: 'rect', shape: 'rect', x: 300, y: 0, w: 160, h: 84 }];
  const edges = [message('e', 'a', 'rect', 0.5, 0.5)];
  assert.equal(distributeMessages(nodes, edges).size, 0);
});

test('distributeMessages is a no-op (empty map) when there are no messages', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 300)];
  assert.equal(distributeMessages(nodes, []).size, 0);
});

test('spaceMessagesForLabels returns an empty map when there are no lifeline nodes', () => {
  assert.equal(spaceMessagesForLabels([], []).size, 0);
});

test('spaceMessagesForLabels returns an empty map with fewer than 2 messages', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 300)];
  const edges = [{ ...message('e', 'a', 'b', 0.5, 0.5), label: 'hello' }];
  assert.equal(spaceMessagesForLabels(nodes, edges).size, 0);
});

test('spaceMessagesForLabels preserves top-to-bottom order and gives every message a fromOffset', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 300)];
  const edges = [
    { ...message('e-low', 'a', 'b', 0.9, 0.9), label: 'low message' },
    { ...message('e-high', 'a', 'b', 0.1, 0.1), label: 'high message' },
  ];
  const updates = spaceMessagesForLabels(nodes, edges);
  assert.ok(updates.get('e-high').fromOffset < updates.get('e-low').fromOffset);
});

test('spaceMessagesForLabels spaces messages with longer (wrapped) labels further apart than short ones', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 300)];
  const shortLabelEdges = [
    { ...message('e1', 'a', 'b', 0, 0), label: 'a' },
    { ...message('e2', 'a', 'b', 0, 0), label: 'b' },
    { ...message('e3', 'a', 'b', 0, 0), label: 'c' },
  ];
  const longLabelEdges = [
    { ...message('e1', 'a', 'b', 0, 0), label: 'a fairly long message label that will wrap across multiple lines' },
    { ...message('e2', 'a', 'b', 0, 0), label: 'another fairly long message label that will also wrap a lot' },
    { ...message('e3', 'a', 'b', 0, 0), label: 'c' },
  ];
  const shortUpdates = spaceMessagesForLabels(nodes, shortLabelEdges);
  const longUpdates = spaceMessagesForLabels(nodes, longLabelEdges);
  const shortGap = shortUpdates.get('e2').fromOffset - shortUpdates.get('e1').fromOffset;
  const longGap = longUpdates.get('e2').fromOffset - longUpdates.get('e1').fromOffset;
  assert.ok(longGap > shortGap);
});

test('spaceMessagesForLabels keeps offsets within the lifeline bounds even when total label height overflows', () => {
  const nodes = [lifeline('a', 0), lifeline('b', 300)];
  const edges = Array.from({ length: 10 }, (_, i) => ({
    ...message(`e${i}`, 'a', 'b', 0, 0),
    label: 'a fairly long message label that will wrap across multiple lines every time',
  }));
  const updates = spaceMessagesForLabels(nodes, edges);
  for (const { fromOffset } of updates.values()) {
    assert.ok(fromOffset >= 0 && fromOffset <= 1);
  }
});

test('spaceMessagesForLabels gives a self-message both a fromOffset and toOffset, ordered', () => {
  const nodes = [lifeline('a', 0)];
  const edges = [
    { ...message('self', 'a', 'a', 0.1, 0.2, 'right', 'right'), label: 'loop back to self with a longer label' },
    { ...message('other', 'a', 'a', 0.5, 0.5, 'right', 'right'), label: 'x' },
  ];
  const updates = spaceMessagesForLabels(nodes, edges);
  const self = updates.get('self');
  assert.ok(self.fromOffset < self.toOffset);
});
