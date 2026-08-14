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
