import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startInterview, endInterview, getInterviewSession, getRemainingMs, formatRemaining, onInterviewChange } from '../../js/core/interviewMode.js';
import { INTERVIEW_PROMPTS, getInterviewPromptById } from '../../js/core/interviewPrompts.js';
import { buildGradingPrompt } from '../../js/io/interviewGrading.js';

test('every interview prompt has a title, difficulty, and non-empty prompt text', () => {
  assert.ok(INTERVIEW_PROMPTS.length >= 5);
  for (const p of INTERVIEW_PROMPTS) {
    assert.ok(p.id && p.title && p.prompt.length > 20, `prompt ${p.id} looks incomplete`);
    assert.ok(['Easy', 'Medium', 'Hard'].includes(p.difficulty));
  }
});

test('getInterviewPromptById resolves a real id and returns null for an unknown one', () => {
  assert.equal(getInterviewPromptById('url-shortener').title, 'Design a URL Shortener');
  assert.equal(getInterviewPromptById('nope'), null);
});

test('startInterview/endInterview/getInterviewSession round-trip, and getRemainingMs counts down', () => {
  endInterview();
  assert.equal(getInterviewSession(), null);
  const now = 1000000;
  startInterview({ title: 'Test Question', prompt: 'Do the thing' }, 30);
  const session = getInterviewSession();
  assert.equal(session.promptTitle, 'Test Question');
  assert.equal(session.durationMs, 30 * 60000);
  assert.equal(getRemainingMs(session.startedAt), 30 * 60000);
  assert.equal(getRemainingMs(session.startedAt + 60000), 29 * 60000);
  // Never goes negative once time is up.
  assert.equal(getRemainingMs(session.startedAt + 999 * 60000), 0);
  endInterview();
});

test('an untimed session (no duration) has no remaining-time countdown', () => {
  startInterview({ title: 'Untimed', prompt: 'x' }, null);
  assert.equal(getRemainingMs(), null);
  endInterview();
});

test('getRemainingMs is null with no active session at all', () => {
  endInterview();
  assert.equal(getRemainingMs(), null);
});

test('onInterviewChange fires immediately-ish on start/end with the current session', () => {
  const seen = [];
  const unsubscribe = onInterviewChange((s) => seen.push(s));
  startInterview({ title: 'A', prompt: 'x' }, 10);
  endInterview();
  unsubscribe();
  assert.equal(seen.length, 2);
  assert.equal(seen[0].promptTitle, 'A');
  assert.equal(seen[1], null);
});

test('formatRemaining renders minutes:seconds, zero-padded', () => {
  assert.equal(formatRemaining(65000), '1:05');
  assert.equal(formatRemaining(9000), '0:09');
  assert.equal(formatRemaining(0), '0:00');
});

test('buildGradingPrompt includes the question, its text, and the diagram description', () => {
  const text = buildGradingPrompt({ promptTitle: 'Design a URL Shortener', promptText: 'Shorten URLs.', diagramDescription: '3 components: API, DB, Cache.' });
  assert.match(text, /Design a URL Shortener/);
  assert.match(text, /Shorten URLs\./);
  assert.match(text, /3 components: API, DB, Cache\./);
  assert.match(text, /grade/i);
});

test('buildGradingPrompt handles an empty diagram gracefully', () => {
  const text = buildGradingPrompt({ promptTitle: 'X', promptText: 'Y', diagramDescription: '' });
  assert.match(text, /empty/i);
});
