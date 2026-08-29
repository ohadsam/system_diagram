import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { getConversationTurns, appendConversationTurn, clearConversation } from '../../js/io/aiConversationStore.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('getConversationTurns returns an empty array when nothing is saved', () => {
  assert.deepEqual(getConversationTurns(), []);
});

test('appendConversationTurn persists turns in order and returns the updated list', () => {
  const first = appendConversationTurn({ id: 't1', role: 'user', message: 'hi' });
  assert.deepEqual(first, [{ id: 't1', role: 'user', message: 'hi' }]);

  const second = appendConversationTurn({ id: 't2', role: 'ai', message: 'hello' });
  assert.equal(second.length, 2);
  assert.equal(second[0].id, 't1');
  assert.equal(second[1].id, 't2');
  assert.deepEqual(getConversationTurns(), second);
});

test('clearConversation empties the transcript', () => {
  appendConversationTurn({ id: 't1', role: 'user', message: 'hi' });
  clearConversation();
  assert.deepEqual(getConversationTurns(), []);
});
