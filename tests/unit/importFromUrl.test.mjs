import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProjectFromUrl } from '../../js/io/importFromUrl.js';

function mockFetchOnce(responses) {
  const calls = [...responses];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const next = calls.shift();
    if (!next) throw new Error(`Unexpected extra fetch call to ${url}`);
    return next;
  };
  return () => { globalThis.fetch = original; };
}

function okJson(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}

test('fetchProjectFromUrl rejects a non-http(s) input before ever calling fetch', async () => {
  const restore = mockFetchOnce([]);
  const result = await fetchProjectFromUrl('not-a-url');
  restore();
  assert.equal(result.ok, false);
  assert.match(result.error, /http/i);
});

test('fetchProjectFromUrl fetches a plain raw JSON URL and validates it', async () => {
  const restore = mockFetchOnce([okJson({ nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [] })]);
  const result = await fetchProjectFromUrl('https://example.com/diagram.json');
  restore();
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes.length, 1);
});

test('fetchProjectFromUrl surfaces a non-ok HTTP status as a clear error', async () => {
  const restore = mockFetchOnce([{ ok: false, status: 404, text: async () => '', json: async () => ({}) }]);
  const result = await fetchProjectFromUrl('https://example.com/missing.json');
  restore();
  assert.equal(result.ok, false);
  assert.match(result.error, /404/);
});

test('fetchProjectFromUrl reports invalid JSON clearly', async () => {
  const restore = mockFetchOnce([{ ok: true, status: 200, text: async () => 'not json', json: async () => { throw new Error('n/a'); } }]);
  const result = await fetchProjectFromUrl('https://example.com/bad.json');
  restore();
  assert.equal(result.ok, false);
  assert.match(result.error, /JSON/);
});

test('fetchProjectFromUrl rejects JSON that is not a diagram this app understands', async () => {
  const restore = mockFetchOnce([okJson({ hello: 'world' })]);
  const result = await fetchProjectFromUrl('https://example.com/notadiagram.json');
  restore();
  assert.equal(result.ok, false);
  assert.match(result.error, /diagram/i);
});

test('fetchProjectFromUrl resolves a gist.github.com URL via the GitHub gists API', async () => {
  const gistApiResponse = {
    ok: true, status: 200,
    json: async () => ({ files: { 'diagram.json': { filename: 'diagram.json', content: JSON.stringify({ nodes: [], edges: [] }), truncated: false } } }),
    text: async () => '',
  };
  const restore = mockFetchOnce([gistApiResponse]);
  const result = await fetchProjectFromUrl('https://gist.github.com/someuser/abc123def456');
  restore();
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.nodes, []);
});

test('fetchProjectFromUrl follows raw_url for a truncated gist file', async () => {
  const gistApiResponse = {
    ok: true, status: 200,
    json: async () => ({ files: { 'diagram.json': { filename: 'diagram.json', content: '', truncated: true, raw_url: 'https://gist.githubusercontent.com/raw/abc/diagram.json' } } }),
    text: async () => '',
  };
  const rawResponse = okJson({ nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [] });
  const restore = mockFetchOnce([gistApiResponse, rawResponse]);
  const result = await fetchProjectFromUrl('https://gist.github.com/someuser/abc123def456');
  restore();
  assert.equal(result.ok, true);
  assert.equal(result.project.nodes.length, 1);
});

test('fetchProjectFromUrl surfaces a network/CORS failure (TypeError from fetch) as a clear message', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const result = await fetchProjectFromUrl('https://example.com/blocked.json');
  globalThis.fetch = original;
  assert.equal(result.ok, false);
  assert.match(result.error, /cors/i);
});
