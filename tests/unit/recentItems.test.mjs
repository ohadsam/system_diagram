import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import {
  RECENT_SCOPES, getRecentItemLimits, saveRecentItemLimits, onRecentItemLimitsChange,
  getRecentItemIds, recordItemUsed, onRecentItemsChange, clearRecentItems,
} from '../../js/io/recentItems.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getRecentItemLimits returns every scope\'s default when nothing was ever saved', () => {
  const limits = getRecentItemLimits();
  for (const scope of RECENT_SCOPES) assert.equal(limits[scope.id], scope.defaultLimit);
});

test('getRecentItemIds is empty for a scope with nothing recorded', () => {
  assert.deepEqual(getRecentItemIds('commands'), []);
});

test('recordItemUsed adds to the front and moves an existing id back to the front instead of duplicating', () => {
  recordItemUsed('commands', 'undo');
  recordItemUsed('commands', 'redo');
  recordItemUsed('commands', 'undo');
  assert.deepEqual(getRecentItemIds('commands'), ['undo', 'redo']);
});

test('recordItemUsed ignores a falsy id', () => {
  recordItemUsed('commands', '');
  recordItemUsed('commands', null);
  assert.deepEqual(getRecentItemIds('commands'), []);
});

test('recordItemUsed caps a scope\'s list at its own current limit', () => {
  for (let i = 0; i < 10; i++) recordItemUsed('commands', `cmd-${i}`); // default limit for 'commands' is 5
  const ids = getRecentItemIds('commands');
  assert.equal(ids.length, 5);
  assert.deepEqual(ids, ['cmd-9', 'cmd-8', 'cmd-7', 'cmd-6', 'cmd-5']);
});

test('saveRecentItemLimits clamps to the scope\'s [min, max] range', () => {
  const saved = saveRecentItemLimits({ commands: 1000, 'help-menu': 0 });
  assert.equal(saved.commands, 20); // commands max
  assert.equal(saved['help-menu'], 3); // help-menu min
});

test('saveRecentItemLimits trims an already-longer stored list down to a newly-lowered limit', () => {
  for (let i = 0; i < 5; i++) recordItemUsed('commands', `cmd-${i}`);
  assert.equal(getRecentItemIds('commands').length, 5);
  saveRecentItemLimits({ commands: 3 }); // 'commands' scope's min is 3
  assert.deepEqual(getRecentItemIds('commands'), ['cmd-4', 'cmd-3', 'cmd-2']);
});

test('a lowered limit is respected by later recordItemUsed calls too', () => {
  saveRecentItemLimits({ commands: 3 }); // 'commands' scope's min is 3
  recordItemUsed('commands', 'a');
  recordItemUsed('commands', 'b');
  recordItemUsed('commands', 'c');
  recordItemUsed('commands', 'd');
  assert.deepEqual(getRecentItemIds('commands'), ['d', 'c', 'b']);
});

test('onRecentItemLimitsChange notifies listeners with the new limits map', () => {
  let received = null;
  const unsubscribe = onRecentItemLimitsChange((limits) => { received = limits; });
  saveRecentItemLimits({ commands: 7 });
  assert.equal(received.commands, 7);
  unsubscribe();
  saveRecentItemLimits({ commands: 8 });
  assert.equal(received.commands, 7); // unsubscribed — stale value, not updated
});

test('onRecentItemsChange notifies only listeners of the same scope', () => {
  let commandCalls = 0;
  let componentCalls = 0;
  onRecentItemsChange('commands', () => { commandCalls++; });
  onRecentItemsChange('components', () => { componentCalls++; });
  recordItemUsed('commands', 'undo');
  assert.equal(commandCalls, 1);
  assert.equal(componentCalls, 0);
});

test('clearRecentItems empties a scope\'s list without affecting others', () => {
  recordItemUsed('commands', 'undo');
  recordItemUsed('components', 'shape-server');
  clearRecentItems('commands');
  assert.deepEqual(getRecentItemIds('commands'), []);
  assert.deepEqual(getRecentItemIds('components'), ['shape-server']);
});

test('scopes are independent — recording in one never appears in another', () => {
  recordItemUsed('create-menu', 'sequence-diagram');
  assert.deepEqual(getRecentItemIds('tools-menu'), []);
});
