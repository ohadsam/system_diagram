import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROVIDERS, buildReviewPrompt, buildExplainPrompt } from '../../js/io/aiReview.js';

test('AI_PROVIDERS lists the well-known providers with a name/url/icon each', () => {
  assert.ok(AI_PROVIDERS.length >= 4);
  for (const provider of AI_PROVIDERS) {
    assert.equal(typeof provider.id, 'string');
    assert.equal(typeof provider.name, 'string');
    assert.ok(provider.url.startsWith('https://'), `${provider.name} url should be https`);
  }
  const names = AI_PROVIDERS.map((p) => p.name);
  for (const expected of ['Claude', 'ChatGPT', 'Gemini', 'Copilot']) {
    assert.ok(names.includes(expected), `expected ${expected} to be in AI_PROVIDERS`);
  }
});

test('buildReviewPrompt includes the project name, counts, and component names', () => {
  const prompt = buildReviewPrompt({
    projectName: 'My Architecture',
    nodeCount: 3,
    edgeCount: 2,
    componentNames: ['EC2', 'RDS', 'S3'],
  });
  assert.match(prompt, /My Architecture/);
  assert.match(prompt, /3 components? and 2 connectors?/);
  assert.match(prompt, /EC2, RDS, S3/);
  assert.doesNotMatch(prompt, /SPEC START/, 'no spec block when no spec text is given');
});

test('buildReviewPrompt uses correct singular/plural wording for one component/connector', () => {
  const prompt = buildReviewPrompt({ projectName: 'X', nodeCount: 1, edgeCount: 1, componentNames: ['EC2'] });
  assert.match(prompt, /1 component and 1 connector\./);
});

test('buildReviewPrompt folds in an attached spec, truncated to a sane length', () => {
  const prompt = buildReviewPrompt({
    projectName: 'X', nodeCount: 1, edgeCount: 0, componentNames: [], specText: 'Must support 10k concurrent users.',
  });
  assert.match(prompt, /SPEC START/);
  assert.match(prompt, /SPEC END/);
  assert.match(prompt, /10k concurrent users/);

  const hugeSpec = 'a'.repeat(50000);
  const truncated = buildReviewPrompt({ projectName: 'X', nodeCount: 0, edgeCount: 0, specText: hugeSpec });
  assert.ok(truncated.length < hugeSpec.length, 'an oversized spec should be truncated, not embedded whole');
});

test('buildReviewPrompt never throws on missing/empty fields', () => {
  assert.doesNotThrow(() => buildReviewPrompt({}));
  assert.doesNotThrow(() => buildReviewPrompt({ projectName: '', nodeCount: 0, edgeCount: 0 }));
});

test('buildReviewPrompt asks sequence-diagram-specific questions (call order, missing responses) when hasSequenceDiagram is set', () => {
  const prompt = buildReviewPrompt({
    projectName: 'Login Flow', nodeCount: 3, edgeCount: 4, componentNames: ['Client', 'Auth Service', 'Users DB'], hasSequenceDiagram: true,
  });
  assert.match(prompt, /sequence\/communication-flow diagram/);
  assert.match(prompt, /call order/);
  assert.match(prompt, /out of order/);
  assert.doesNotMatch(prompt, /scalability, reliability, security, cost/, 'the generic system-design checklist should not also appear');
});

test('buildReviewPrompt defaults to the regular system-design review when hasSequenceDiagram is omitted', () => {
  const prompt = buildReviewPrompt({ projectName: 'X', nodeCount: 2, edgeCount: 1 });
  assert.match(prompt, /system design \/ architecture diagram/);
  assert.doesNotMatch(prompt, /sequence\/communication-flow diagram/);
});

test('buildExplainPrompt asks for a plain-language walkthrough, not a critique', () => {
  const prompt = buildExplainPrompt({
    projectName: 'My Architecture', nodeCount: 3, edgeCount: 2, componentNames: ['EC2', 'RDS', 'S3'],
  });
  assert.match(prompt, /My Architecture/);
  assert.match(prompt, /3 components? and 2 connectors?/);
  assert.match(prompt, /EC2, RDS, S3/);
  assert.match(prompt, /explain/i);
  assert.doesNotMatch(prompt, /risks, gaps or anti-patterns/, 'should not ask for the review checklist');
});

test('buildExplainPrompt asks sequence-diagram-specific walkthrough questions when hasSequenceDiagram is set', () => {
  const prompt = buildExplainPrompt({
    projectName: 'Login Flow', nodeCount: 3, edgeCount: 4, componentNames: ['Client', 'Auth Service', 'Users DB'], hasSequenceDiagram: true,
  });
  assert.match(prompt, /sequence\/communication-flow diagram/);
  assert.match(prompt, /numbered messages/);
});

test('buildExplainPrompt folds in an attached spec and never throws on missing/empty fields', () => {
  const prompt = buildExplainPrompt({ projectName: 'X', nodeCount: 1, edgeCount: 0, specText: 'Must support 10k concurrent users.' });
  assert.match(prompt, /SPEC START/);
  assert.match(prompt, /10k concurrent users/);
  assert.doesNotThrow(() => buildExplainPrompt({}));
});
