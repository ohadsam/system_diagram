// Pure build*/parse* request/response shaping from io/aiDirectCall.js — see
// that file's header comment for why these have no `fetch` inside them.
// sendPromptDirect itself is also covered here with a stubbed global fetch,
// since Node provides a real `fetch` global to override.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnthropicRequest, parseAnthropicResponse,
  buildOpenAiRequest, parseOpenAiResponse,
  buildGeminiRequest, parseGeminiResponse,
  buildCustomRequest, sendPromptDirect,
} from '../../js/io/aiDirectCall.js';

test('buildAnthropicRequest sets the browser-access opt-in header and x-api-key auth', () => {
  const req = buildAnthropicRequest({ apiKey: 'sk-ant', model: 'claude-opus-5', prompt: 'hi' });
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.headers['x-api-key'], 'sk-ant');
  assert.equal(req.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(req.body.model, 'claude-opus-5');
  assert.deepEqual(req.body.messages[0].content, [{ type: 'text', text: 'hi' }]);
});

test('buildAnthropicRequest prepends an image content block when given one', () => {
  const req = buildAnthropicRequest({ apiKey: 'k', model: 'm', prompt: 'hi', imageBase64: 'AAAA' });
  assert.equal(req.body.messages[0].content[0].type, 'image');
  assert.equal(req.body.messages[0].content[0].source.data, 'AAAA');
  assert.equal(req.body.messages[0].content[1].type, 'text');
});

test('parseAnthropicResponse joins text blocks and returns null when there is nothing usable', () => {
  assert.equal(parseAnthropicResponse({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'a\nb');
  assert.equal(parseAnthropicResponse({ content: [] }), null);
  assert.equal(parseAnthropicResponse({}), null);
});

test('buildOpenAiRequest uses Bearer auth and plain string content with no image', () => {
  const req = buildOpenAiRequest({ apiKey: 'sk-oai', model: 'gpt-4o', prompt: 'hi' });
  assert.equal(req.headers.authorization, 'Bearer sk-oai');
  assert.equal(req.body.messages[0].content, 'hi');
});

test('buildOpenAiRequest builds a multimodal content array with an image', () => {
  const req = buildOpenAiRequest({ apiKey: 'k', model: 'm', prompt: 'hi', imageBase64: 'AAAA' });
  assert.ok(Array.isArray(req.body.messages[0].content));
  assert.equal(req.body.messages[0].content[0].text, 'hi');
  assert.equal(req.body.messages[0].content[1].image_url.url, 'data:image/png;base64,AAAA');
});

test('parseOpenAiResponse reads choices[0].message.content, or null', () => {
  assert.equal(parseOpenAiResponse({ choices: [{ message: { content: 'hello' } }] }), 'hello');
  assert.equal(parseOpenAiResponse({ choices: [] }), null);
  assert.equal(parseOpenAiResponse({}), null);
});

test('buildGeminiRequest puts the key in the URL query string, not a header', () => {
  const req = buildGeminiRequest({ apiKey: 'g-key', model: 'gemini-2.0-flash', prompt: 'hi' });
  assert.ok(req.url.includes('models/gemini-2.0-flash:generateContent'));
  assert.ok(req.url.includes('key=g-key'));
  assert.deepEqual(req.body.contents[0].parts, [{ text: 'hi' }]);
});

test('buildGeminiRequest puts an image as an inline_data part before the text', () => {
  const req = buildGeminiRequest({ apiKey: 'k', model: 'm', prompt: 'hi', imageBase64: 'AAAA' });
  assert.equal(req.body.contents[0].parts[0].inline_data.data, 'AAAA');
  assert.equal(req.body.contents[0].parts[1].text, 'hi');
});

test('parseGeminiResponse joins candidate parts and returns null when empty', () => {
  assert.equal(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }), 'ab');
  assert.equal(parseGeminiResponse({ candidates: [] }), null);
});

test('buildCustomRequest reuses the OpenAI request shape but sends it to the given baseUrl', () => {
  const req = buildCustomRequest({ baseUrl: 'https://example.com/v1/chat/completions', apiKey: 'k', model: 'm', prompt: 'hi' });
  assert.equal(req.url, 'https://example.com/v1/chat/completions');
  assert.equal(req.headers.authorization, 'Bearer k');
  assert.equal(req.body.messages[0].content, 'hi');
});

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve(fn()).finally(() => { globalThis.fetch = original; });
}

test('sendPromptDirect returns ok:true with the parsed text on a successful call', () => withFetch(
  async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'reply' }] }) }),
  async () => {
    const result = await sendPromptDirect({ kind: 'builtin', id: 'anthropic', apiKey: 'k', model: 'm' }, { prompt: 'hi' });
    assert.deepEqual(result, { ok: true, text: 'reply' });
  },
));

test('sendPromptDirect reports a rejected-key message on a 401', () => withFetch(
  async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid api key' } }) }),
  async () => {
    const result = await sendPromptDirect({ kind: 'builtin', id: 'anthropic', apiKey: 'bad', model: 'm' }, { prompt: 'hi' });
    assert.equal(result.ok, false);
    assert.match(result.error, /rejected/);
    assert.match(result.error, /invalid api key/);
  },
));

test('sendPromptDirect reports a generic CORS/offline message when fetch itself throws', () => withFetch(
  async () => { throw new TypeError('Failed to fetch'); },
  async () => {
    const result = await sendPromptDirect({ kind: 'builtin', id: 'gemini', apiKey: 'k', model: 'm' }, { prompt: 'hi' });
    assert.equal(result.ok, false);
    assert.match(result.error, /CORS/);
  },
));

test('sendPromptDirect reports no-readable-text when the response has nothing to parse', () => withFetch(
  async () => ({ ok: true, json: async () => ({}) }),
  async () => {
    const result = await sendPromptDirect({ kind: 'builtin', id: 'openai', apiKey: 'k', model: 'm' }, { prompt: 'hi' });
    assert.equal(result.ok, false);
    assert.match(result.error, /no readable text/);
  },
));

test('sendPromptDirect rejects an unknown provider id up front', () => withFetch(
  async () => { throw new Error('should not be called'); },
  async () => {
    const result = await sendPromptDirect({ kind: 'builtin', id: 'bogus', apiKey: 'k', model: 'm' }, { prompt: 'hi' });
    assert.equal(result.ok, false);
    assert.match(result.error, /Unknown provider/);
  },
));

test('sendPromptDirect routes a custom-kind provider through buildCustomRequest/parseOpenAiResponse', () => withFetch(
  async (url) => {
    assert.equal(url, 'https://example.com/v1/chat/completions');
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'custom reply' } }] }) };
  },
  async () => {
    const result = await sendPromptDirect(
      { kind: 'custom', id: 'x', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1/chat/completions' },
      { prompt: 'hi' },
    );
    assert.deepEqual(result, { ok: true, text: 'custom reply' });
  },
));
