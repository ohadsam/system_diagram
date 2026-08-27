// Configurable AI settings for this app's two opt-in alternatives to its
// default "prepare a prompt, hand it off to the provider's own website,
// paste the reply back" flow (io/aiReview.js's header comment explains why
// that's the default: this is a 100% static, backend-free app):
//   - 'direct': a saved API key calls a remote provider straight from the
//     browser — see io/aiDirectCall.js for exactly which providers
//     genuinely support that and why.
//   - 'local': a small open model (Llama/Qwen/...) runs entirely inside
//     the browser via WebGPU, no key, no account, no server at all — see
//     io/webllmEngine.js. This is the one mode with no credential to leak,
//     since there isn't one.
//
// Keys/settings live in whichever storage backend the user has chosen
// (io/storage.js — localStorage by default), exactly like every other app
// setting, and are deliberately NEVER read by io/projects.js/io/fullBackup.js
// — they're a browser/app setting, not project data, same category as
// io/uiPrefs.js. Nothing here encrypts the keys (a static page has no
// secret to encrypt them *with* that wouldn't itself be sitting right next
// to them in the same browser storage — see the security note surfaced in
// modals/defaultSettingsModal.js's "🤖 AI Providers" section), so switching
// back to hand-off mode deliberately wipes every stored credential rather
// than just hiding them. Switching to/from 'local' never wipes anything —
// there's no credential involved either way.
import { readJSON, writeJSON } from './storage.js';
import { nextId } from '../core/id.js';

const KEY = 'aiProviderKeys';
const listeners = new Set();

export const AI_SEND_MODES = ['handoff', 'direct', 'local'];

// Curated, verified-working model IDs for io/webllmEngine.js's in-browser
// inference (Local AI mode) — every one confirmed present in the exact
// vendored @mlc-ai/web-llm build's own model catalog (see vendor/VENDOR.md)
// rather than guessed, since a wrong ID fails a multi-GB download partway
// through instead of failing fast. All three are flagged
// `low_resource_required: true` in that catalog, so none of them assume a
// beefy discrete GPU. `sizeLabel` is that catalog's `vram_required_MB`
// rounded — an approximation of the download size, not an exact figure.
// The first entry is also DEFAULTS.localModel below — keep whichever one
// is actually labeled "(recommended)" in first place, since the settings
// dropdown's default selection and its own display label should never
// disagree about which choice is the recommended one.
export const LOCAL_MODEL_CHOICES = [
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B — balanced (recommended)', sizeLabel: '~2.3 GB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 1.5B — fastest, lightest', sizeLabel: '~1.6 GB' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 3B — strongest reasoning', sizeLabel: '~2.5 GB' },
];

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

const AUTO_SUGGEST_MIN_CHANGES = 1;
const AUTO_SUGGEST_MAX_CHANGES = 50;

const DEFAULTS = {
  mode: 'handoff',
  providers: {}, // { [providerId]: { apiKey, model } }
  customProviders: [], // { id, name, baseUrl, apiKey, model }
  localModel: LOCAL_MODEL_CHOICES[0].id,
  // io/autoSuggestWatcher.js: runs the "💡 Suggestions" flow in the
  // background (no panel needed to be open) after this many distinct
  // diagram edits pile up — deliberately change-count-based, not a timer,
  // per how this was actually requested: someone idle for an hour without
  // touching the diagram shouldn't get an unprompted API call, but someone
  // who just added/edited a handful of components probably wants the
  // check to happen. Off by default since it's an unattended trigger that
  // can incur real cost in Direct API mode.
  autoSuggest: { enabled: false, everyNChanges: 5 },
};

export function getAiProviderSettings() {
  const stored = readJSON(KEY, {});
  return {
    ...DEFAULTS,
    ...stored,
    mode: AI_SEND_MODES.includes(stored.mode) ? stored.mode : DEFAULTS.mode,
    providers: { ...(stored.providers || {}) },
    customProviders: Array.isArray(stored.customProviders) ? stored.customProviders : [],
    localModel: LOCAL_MODEL_CHOICES.some((m) => m.id === stored.localModel) ? stored.localModel : DEFAULTS.localModel,
    autoSuggest: sanitizeAutoSuggest(stored.autoSuggest),
  };
}

function sanitizeAutoSuggest(value) {
  const enabled = typeof value?.enabled === 'boolean' ? value.enabled : DEFAULTS.autoSuggest.enabled;
  const raw = Number(value?.everyNChanges);
  const everyNChanges = Number.isFinite(raw)
    ? Math.min(AUTO_SUGGEST_MAX_CHANGES, Math.max(AUTO_SUGGEST_MIN_CHANGES, Math.round(raw)))
    : DEFAULTS.autoSuggest.everyNChanges;
  return { enabled, everyNChanges };
}

/** Settings' "Auto-suggest" toggle + "every N changes" field. Only ever
 * meaningful alongside Direct API mode or Local AI mode (see
 * isAutomaticSendConfigured() below) — but stored/settable
 * regardless of current mode, same as `localModel`, so flipping it on
 * ahead of configuring a provider isn't lost. */
export function setAutoSuggestConfig(patch) {
  const current = getAiProviderSettings();
  return save({ ...current, autoSuggest: sanitizeAutoSuggest({ ...current.autoSuggest, ...patch }) });
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
 * around", not just "stop using them for now" — but keeps the local-model
 * choice, since that's not a credential and there's no reason to forget it.
 * Switching to 'direct' or 'local' never clears anything, since there's
 * nothing to clear on the way in either way. */
export function setAiSendMode(mode) {
  const current = getAiProviderSettings();
  if (!AI_SEND_MODES.includes(mode) || mode === current.mode) return current;
  if (mode === 'handoff') return save({ ...DEFAULTS, mode: 'handoff', localModel: current.localModel });
  return save({ ...current, mode });
}

/** The Settings model `<select>` for Local AI mode — doesn't require
 * being in 'local' mode to change, same as a provider key field staying
 * editable while in 'handoff' mode. */
export function setLocalModel(modelId) {
  const current = getAiProviderSettings();
  if (!LOCAL_MODEL_CHOICES.some((m) => m.id === modelId)) return current;
  return save({ ...current, localModel: modelId });
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

export function isLocalModeActive() {
  return getAiProviderSettings().mode === 'local';
}

/** Whether *some* automatic (no-copy-paste) send path is currently usable
 * — Local AI mode, or Direct API mode with at least one provider actually
 * configured. Shared by every feature that only makes sense as an
 * automatic round trip: panel/aiReviewPanel.js's "💡 Suggestions" mode,
 * io/autoSuggestWatcher.js's background trigger, modals/defaultSettingsModal.js's
 * "🔁 Auto-suggest" warning, and modals/quickStartModal.js's setup nudge —
 * previously four separate copies of the same one-line boolean. */
export function isAutomaticSendConfigured() {
  return isLocalModeActive() || (isDirectModeActive() && getConfiguredDirectProviders().length > 0);
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
