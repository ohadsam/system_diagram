// Direct (no-hand-off) calls to an AI provider's own API from right here in
// the browser, using a key saved in Settings -> AI Providers (see
// io/aiProviderKeys.js). This is only ever an *option* alongside this
// app's default "prepare a prompt, open the provider's website, paste the
// reply back yourself" flow (io/aiReview.js) — every AI-assisted feature
// keeps that hand-off path fully working regardless of whether Direct mode
// is configured, since a direct call can fail for reasons entirely outside
// this app's control (see below).
//
// Whether a direct call from a plain static page can even reach a given
// provider depends entirely on that provider's own CORS policy for
// cross-origin browser requests. Verified against the real endpoints while
// building this feature (2026-08, via a raw preflight + request against
// each provider's live API, checking the actual Access-Control-Allow-Origin
// response header):
//   - Anthropic (api.anthropic.com) genuinely supports it, but only with
//     the `anthropic-dangerous-direct-browser-access: true` header on the
//     request — without it the server sends no
//     Access-Control-Allow-Origin at all and the browser blocks the
//     response before this code ever runs. This is Anthropic's documented,
//     intentional opt-in for exactly this "browser app with a
//     user-supplied key" use case (their TypeScript SDK's own
//     `dangerouslyAllowBrowser` flag sets this same header under the hood).
//   - Google Gemini (generativelanguage.googleapis.com) also genuinely
//     supports it out of the box — its preflight response already includes
//     `Access-Control-Allow-Origin: *`, no special header needed.
//   - OpenAI (api.openai.com) could not be confirmed either way from this
//     exact environment (an unrelated outbound network policy blocked the
//     verification request before it reached OpenAI's servers at all), but
//     multiple independent developer reports through 2025-2026 describe it
//     rejecting browser-origin requests with no CORS headers at all.
//     Included anyway — the failure mode here is just a clear, caught
//     error suggesting hand-off mode instead; if OpenAI ever does enable
//     browser CORS, this starts working with no code change.
//   - A "Custom (OpenAI-compatible)" provider is whatever URL the user
//     points it at — most self-hosted/alternative providers (Azure OpenAI,
//     OpenRouter, Ollama, LM Studio, Groq, Together, ...) speak the same
//     chat-completions request/response shape, so that's the assumed
//     contract. Whether *that* server allows browser CORS is between the
//     user and whoever operates it.
//
// Request/response shaping is kept as pure functions (build*/parse*) with
// no `fetch` call inside them, so they're unit-testable without a network —
// same "pure core, thin IO shell" split as the rest of this app's io/*.js.

const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

export function buildAnthropicRequest({ apiKey, model, prompt, imageBase64 }) {
  const content = [];
  if (imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } });
  content.push({ type: 'text', text: prompt });
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: { model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content }] },
  };
}

export function parseAnthropicResponse(json) {
  const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return text || null;
}

export function buildOpenAiRequest({ apiKey, model, prompt, imageBase64 }) {
  const content = imageBase64
    ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }]
    : prompt;
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: { model, messages: [{ role: 'user', content }] },
  };
}

export function parseOpenAiResponse(json) {
  return json.choices?.[0]?.message?.content || null;
}

export function buildGeminiRequest({ apiKey, model, prompt, imageBase64 }) {
  const parts = [];
  if (imageBase64) parts.push({ inline_data: { mime_type: 'image/png', data: imageBase64 } });
  parts.push({ text: prompt });
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    headers: { 'content-type': 'application/json' },
    body: { contents: [{ parts }] },
  };
}

export function parseGeminiResponse(json) {
  const parts = json.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');
  return text || null;
}

/** Assumed OpenAI-compatible chat-completions shape — see this file's
 * header comment for why that's the chosen contract for a user-defined
 * "custom" provider. `baseUrl` must be the full completions endpoint (not
 * just a host), since providers differ on the exact path. */
export function buildCustomRequest({ baseUrl, apiKey, model, prompt, imageBase64 }) {
  const { headers, body } = buildOpenAiRequest({ apiKey, model, prompt, imageBase64 });
  return { url: baseUrl, headers, body };
}

const ADAPTERS = {
  anthropic: { build: buildAnthropicRequest, parse: parseAnthropicResponse },
  openai: { build: buildOpenAiRequest, parse: parseOpenAiResponse },
  gemini: { build: buildGeminiRequest, parse: parseGeminiResponse },
};

/** Turns a raw fetch failure/HTTP error into one short, user-facing
 * sentence — the caller shows this in a toast and leaves the existing
 * hand-off UI right there as a fallback. A `TypeError` from `fetch` itself
 * (as opposed to a resolved-but-non-ok response) is the browser's generic,
 * detail-free signal for "the request never completed" — almost always
 * either a CORS rejection or being offline, and there is no way from
 * JavaScript to tell those two apart. */
function describeError(err, status) {
  if (status === 401 || status === 403) return 'That API key was rejected — check it and try again.';
  if (status === 429) return 'Rate limited by the provider — wait a moment and try again.';
  if (status) return `The provider returned an error (HTTP ${status}).`;
  return "Couldn't reach the provider directly from the browser — this usually means it blocked the cross-origin request (CORS) or you're offline. Try Copy/Paste mode for this one instead.";
}

/**
 * @param {{kind:'builtin'|'custom', id:string, apiKey:string, model:string, baseUrl?:string}} provider
 * @param {{prompt:string, imageBase64?:string}} input
 * @returns {Promise<{ok:true, text:string}|{ok:false, error:string}>}
 */
export async function sendPromptDirect(provider, { prompt, imageBase64 } = {}) {
  const adapter = provider.kind === 'custom' ? { build: buildCustomRequest, parse: parseOpenAiResponse } : ADAPTERS[provider.id];
  if (!adapter) return { ok: false, error: `Unknown provider "${provider.id}".` };

  const { url, headers, body } = adapter.build({ ...provider, prompt, imageBase64 });
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    return { ok: false, error: describeError(null, null) };
  }

  let json = null;
  try { json = await response.json(); } catch { /* non-JSON error body — fall through to status-based message */ }

  if (!response.ok) {
    const providerMessage = json?.error?.message || json?.error || null;
    return { ok: false, error: providerMessage ? `${describeError(null, response.status)} (${providerMessage})` : describeError(null, response.status) };
  }

  const text = json ? adapter.parse(json) : null;
  if (!text) return { ok: false, error: 'The provider responded, but with no readable text — try again.' };
  return { ok: true, text };
}
