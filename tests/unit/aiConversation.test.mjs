import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurn, buildConversationPrompt, extractConversationReply } from '../../js/core/aiConversation.js';

const project = {
  name: 'Test',
  nodes: [
    { id: 'n1', text: 'Client' },
    { id: 'n2', text: 'Server' },
  ],
  edges: [{ id: 'e1', from: 'n1', to: 'n2', label: 'call' }],
};

test('createTurn shapes a turn with role/message/patchApplied/timestamp', () => {
  const turn = createTurn('user', '  add a cache  ');
  assert.equal(turn.role, 'user');
  assert.equal(turn.message, 'add a cache'); // trimmed
  assert.equal(turn.patchApplied, false);
  assert.ok(turn.id);
  assert.ok(turn.timestamp);
});

test('createTurn records patchApplied when passed', () => {
  const turn = createTurn('ai', 'done', { patchApplied: true });
  assert.equal(turn.patchApplied, true);
});

test('buildConversationPrompt embeds the current diagram and the new message even with no prior turns', () => {
  const prompt = buildConversationPrompt({ turns: [], newMessage: 'add a cache', project });
  assert.ok(prompt.includes('"Client"'));
  assert.ok(prompt.includes('"Server"'));
  assert.ok(prompt.includes('add a cache'));
  assert.ok(!prompt.includes('CONVERSATION SO FAR')); // nothing to show yet
});

test('buildConversationPrompt replays prior turns so a stateless AI has full context', () => {
  const turns = [
    createTurn('user', 'add a cache'),
    createTurn('ai', 'Sure, added a Redis cache.', { patchApplied: true }),
  ];
  const prompt = buildConversationPrompt({ turns, newMessage: 'now add a queue too', project });
  assert.ok(prompt.includes('CONVERSATION SO FAR'));
  assert.ok(prompt.includes('add a cache'));
  assert.ok(prompt.includes('Sure, added a Redis cache.'));
  assert.ok(prompt.includes('diagram update from this reply was applied'));
  assert.ok(prompt.includes('now add a queue too'));
});

test('buildConversationPrompt only replays the most recent turns once the transcript is very long', () => {
  const turns = [];
  for (let i = 0; i < 30; i++) turns.push(createTurn('user', `message number ${i}`));
  const prompt = buildConversationPrompt({ turns, newMessage: 'latest', project });
  assert.ok(!prompt.includes('message number 0')); // too old, trimmed
  assert.ok(prompt.includes('message number 29')); // most recent, kept
});

test('buildConversationPrompt falls back to a default note when no message is given', () => {
  const prompt = buildConversationPrompt({ turns: [], newMessage: '', project });
  assert.ok(prompt.includes('no message given'));
});

test('extractConversationReply separates the message from a fenced JSON patch', () => {
  const reply = "Sure, I'll add a cache for you.\n```json\n{\"addNodes\": [{\"id\": \"new1\", \"text\": \"Redis\"}]}\n```\nLet me know if you need anything else.";
  const { message, patch } = extractConversationReply(reply);
  assert.ok(message.includes("Sure, I'll add a cache for you."));
  assert.ok(message.includes('Let me know if you need anything else.'));
  assert.ok(!message.includes('addNodes'));
  assert.ok(patch);
  assert.equal(patch.addNodes[0].id, 'new1');
});

test('extractConversationReply returns the whole text as the message when there is no JSON block', () => {
  const { message, patch } = extractConversationReply('Just answering your question, no diagram change needed.');
  assert.equal(message, 'Just answering your question, no diagram change needed.');
  assert.equal(patch, null);
});

test('extractConversationReply falls back to a placeholder message for a reply that is pure JSON', () => {
  const reply = '```json\n{"addNodes": [{"id": "new1"}]}\n```';
  const { message, patch } = extractConversationReply(reply);
  assert.ok(message.length > 0);
  assert.ok(patch);
});

test('extractConversationReply handles an unparseable fenced block gracefully (message survives, patch is null)', () => {
  const reply = 'Here you go:\n```json\nnot actually valid json\n```';
  const { message, patch } = extractConversationReply(reply);
  assert.ok(message.includes('Here you go:'));
  assert.equal(patch, null);
});

test('extractConversationReply returns an empty message and null patch for empty input', () => {
  assert.deepEqual(extractConversationReply(''), { message: '', patch: null });
  assert.deepEqual(extractConversationReply(null), { message: '', patch: null });
});
