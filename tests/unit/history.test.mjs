import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../../js/core/history.js';

test('History: fresh instance cannot undo/redo', () => {
  const h = new History();
  h.init({ value: 1 });
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), false);
});

test('History: commit then undo restores previous snapshot', () => {
  const h = new History();
  h.init({ value: 1 });
  h.commit({ value: 2 });
  assert.equal(h.canUndo(), true);
  const prev = h.undo();
  assert.equal(prev.value, 1);
  assert.equal(h.canRedo(), true);
});

test('History: redo restores the undone snapshot', () => {
  const h = new History();
  h.init({ value: 1 });
  h.commit({ value: 2 });
  h.undo();
  const next = h.redo();
  assert.equal(next.value, 2);
  assert.equal(h.canRedo(), false);
});

test('History: a new commit clears the redo stack', () => {
  const h = new History();
  h.init({ value: 1 });
  h.commit({ value: 2 });
  h.undo();
  h.commit({ value: 3 });
  assert.equal(h.canRedo(), false);
});

test('History: snapshots are deep clones, not references', () => {
  const h = new History();
  const state = { nested: { value: 1 } };
  h.init(state);
  state.nested.value = 999;
  h.commit({ nested: { value: 2 } });
  const prev = h.undo();
  assert.equal(prev.nested.value, 1, 'mutating the original object after init must not affect the stored snapshot');
});

test('History: respects the undo stack size limit', () => {
  const h = new History(3);
  h.init({ value: 0 });
  for (let i = 1; i <= 5; i += 1) h.commit({ value: i });
  assert.equal(h.undoStack.length, 3);
});

test('History: getTimeline lists past, current, and future in chronological order', () => {
  const h = new History();
  h.init({ value: 0 });
  h.commit({ value: 1 });
  h.commit({ value: 2 });
  h.undo();
  const { entries, currentIndex } = h.getTimeline();
  assert.deepEqual(entries.map((e) => e.value), [0, 1, 2]);
  assert.equal(currentIndex, 1, 'current is "1" after one undo from "2"');
});

test('History: jumpTo moves directly to a past index without stepping through each undo', () => {
  const h = new History();
  h.init({ value: 0 });
  h.commit({ value: 1 });
  h.commit({ value: 2 });
  h.commit({ value: 3 });
  const snap = h.jumpTo(0);
  assert.equal(snap.value, 0);
  assert.equal(h.getTimeline().currentIndex, 0);
  assert.equal(h.canRedo(), true);
});

test('History: jumpTo moves directly to a future index (like a multi-step redo)', () => {
  const h = new History();
  h.init({ value: 0 });
  h.commit({ value: 1 });
  h.commit({ value: 2 });
  h.undo();
  h.undo();
  const snap = h.jumpTo(2);
  assert.equal(snap.value, 2);
  assert.equal(h.getTimeline().currentIndex, 2);
  assert.equal(h.canRedo(), false);
});

test('History: jumpTo to the current index or an out-of-range index is a no-op', () => {
  const h = new History();
  h.init({ value: 0 });
  h.commit({ value: 1 });
  assert.equal(h.jumpTo(1), null);
  assert.equal(h.jumpTo(-1), null);
  assert.equal(h.jumpTo(99), null);
});
