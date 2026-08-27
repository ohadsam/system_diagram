// Configurable AI provider credentials for "Direct API" mode — an opt-in
// alternative to this app's default "prepare a prompt, hand it off to the
// provider's own website, paste the reply back" flow (io/aiReview.js's
// header comment explains why that's the default: this is a 100% static,
// backend-free app, and most LLM providers don't support direct
// browser-to-API calls anyway — see io/aiDirectCall.js for exactly which
// ones genuinely do).
//
// Keys live in whichever storage backend the user has chosen
// (io/storage.js — localStorage by default), exactly like every other app
// setting, and are deliberately NEVER read by io/projects.js/io/fullBackup.js
// — they're a browser/app setting, not project data, same category as
// io/uiPrefs.js. Nothing here encrypts the keys (a static page has no
// secret to encrypt them *with* that wouldn't itself be sitting right next
// to them in the same browser storage — see the security note surfaced in
// modals/defaultSettingsModal.js's "🤖 AI Providers" section), so switching
// back to hand-off mode deliberately wipes every stored credential rather
// than just hiding them.
import { readJSON, writeJSON } from './storage.js';
import { nextId } from '../core/id.js';

const KEY = 'aiProviderKeys';
const listeners = new Set();

export const AI_SEND_MODES = ['handoff', 'direct'];

// Providers with a real, verified direct-browser-call path — see
// io/aiDirectCall.js's header comment for what was actually checked and
// how. GitHub Copilot is deliberately absent: it has no public per-key REST
// completions API for third-party apps, so there is nothing a "direct"
// mode could call — it stays hand-off-only everywhere in the UI.
export const DIRECT_CAPABLE_PROVIDERS = [
  { id: 'anthropic', name: 'Claude (Anthropic)', defaultModel: 'claude-opus-5' },
  { id: 'openai', name: 'ChatGPT (OpenAI)', defaultModel: 'gpt-4o' },
  { id: 'gemini', name: 'Gemini (Google)', defaultModel: 'gemini-2.0-flash' },
];

// io/aiReview.js's AI_PROVIDERS (the hand-off "open this website" list) use
// their own ids (`claude`, `chatgpt`, `gemini`, `copilot`) picked to match
// the provider's own branding, not this module's ids — this is the one
// place that maps between the two, so a hand-off provider button can look
// up whether it also has a Direct-mode credential configured. `copilot`
// has no entry, matching its absence from DIRECT_CAPABLE_PROVIDERS above.
export const HANDOFF_TO_DIRECT_ID = { claude: 'anthropic', chatgpt: 'openai', gemini: 'gemini' };

const DEFAULTS = {
  mode: 'handoff',
  providers: {}, // { [providerId]: { apiKey, model } }
  customProviders: [], // { id, name, baseUrl, apiKey, model }
};

export function getAiProviderSettings() {
  const stored = readJSON(KEY, {});
  return {
    ...DEFAULTS,
    ...stored,
    mode: AI_SEND_MODES.includes(stored.mode) ? stored.mode : DEFAULTS.mode,
    providers: { ...(stored.providers || {}) },
    customProviders: Array.isArray(stored.customProviders) ? stored.customProviders : [],
  };
}

function save(next) {
  writeJSON(KEY, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function onAiProviderSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Switching to 'handoff' always wipes every stored key/custom provider —
 * the whole point of the mode switch is "stop keeping API credentials
 * around", not just "stop using them for now". Switching to 'direct' never
 * clears anything, since there's nothing to clear on the way in. */
export function setAiSendMode(mode) {
  const current = getAiProviderSettings();
  if (!AI_SEND_MODES.includes(mode) || mode === current.mode) return current;
  if (mode === 'handoff') return save({ ...DEFAULTS, mode: 'handoff' });
  return save({ ...current, mode });
}

export function setProviderCredentials(providerId, { apiKey, model } = {}) {
  const current = getAiProviderSettings();
  const providers = { ...current.providers };
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) delete providers[providerId];
  else providers[providerId] = { apiKey: trimmedKey, model: (model || '').trim() };
  return save({ ...current, providers });
}

export function addCustomProvider({ name, baseUrl, apiKey, model } = {}) {
  const current = getAiProviderSettings();
  const entry = {
    id: nextId('ai-provider'),
    name: (name || '').trim() || 'Custom provider',
    baseUrl: (baseUrl || '').trim(),
    apiKey: (apiKey || '').trim(),
    model: (model || '').trim(),
  };
  return save({ ...current, customProviders: [...current.customProviders, entry] });
}

export function updateCustomProvider(id, patch) {
  const current = getAiProviderSettings();
  const customProviders = current.customProviders.map((p) => (p.id === id ? { ...p, ...patch } : p));
  return save({ ...current, customProviders });
}

export function removeCustomProvider(id) {
  const current = getAiProviderSettings();
  return save({ ...current, customProviders: current.customProviders.filter((p) => p.id !== id) });
}

/** The Settings "🗑️ Clear API Keys" button — wipes every stored credential
 * (built-in providers and custom ones) without touching the mode itself,
 * so someone in Direct mode who just wants a clean slate before re-entering
 * a key isn't also bounced back to hand-off mode. */
export function clearAllAiProviderKeys() {
  const current = getAiProviderSettings();
  return save({ ...current, providers: {}, customProviders: [] });
}

export function isDirectModeActive() {
  return getAiProviderSettings().mode === 'direct';
}

/** Every provider actually usable for a direct call right now: Direct mode
 * is on AND it has a saved API key (built-in), or a saved key + base URL
 * (custom). Returns [] whenever mode is 'handoff', so callers don't need
 * to separately check the mode. */
export function getConfiguredDirectProviders() {
  const settings = getAiProviderSettings();
  if (settings.mode !== 'direct') return [];
  const builtins = DIRECT_CAPABLE_PROVIDERS
    .filter((p) => settings.providers[p.id]?.apiKey)
    .map((p) => ({
      kind: 'builtin',
      id: p.id,
      name: p.name,
      apiKey: settings.providers[p.id].apiKey,
      model: settings.providers[p.id].model || p.defaultModel,
    }));
  const customs = settings.customProviders
    .filter((p) => p.apiKey && p.baseUrl)
    .map((p) => ({ kind: 'custom', id: p.id, name: p.name, apiKey: p.apiKey, model: p.model, baseUrl: p.baseUrl }));
  return [...builtins, ...customs];
}
