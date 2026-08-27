// io/aiProviderKeys.js sits on top of io/storage.js — see testSupport.mjs's
// header comment for why a real read/write cycle needs the in-memory
// localStorage stand-in rather than plain Node (which storage.js treats as
// "storage unavailable" and silently no-ops).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import {
  AI_SEND_MODES, DIRECT_CAPABLE_PROVIDERS, HANDOFF_TO_DIRECT_ID, LOCAL_MODEL_CHOICES,
  getAiProviderSettings, setAiSendMode, setProviderCredentials,
  addCustomProvider, updateCustomProvider, removeCustomProvider,
  clearAllAiProviderKeys, isDirectModeActive, getConfiguredDirectProviders,
  isLocalModeActive, setLocalModel,
} from '../../js/io/aiProviderKeys.js';

function withStorage(fn) {
  const clear = installMemoryLocalStorage();
  try {
    return fn();
  } finally {
    clear();
    delete globalThis.window;
  }
}

test('getAiProviderSettings defaults to handoff mode with nothing configured', () => withStorage(() => {
  const settings = getAiProviderSettings();
  assert.equal(settings.mode, 'handoff');
  assert.deepEqual(settings.providers, {});
  assert.deepEqual(settings.customProviders, []);
}));

test('setProviderCredentials saves a built-in provider key, trimmed', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: '  sk-test-123  ', model: '  claude-opus-5  ' });
  const settings = getAiProviderSettings();
  assert.deepEqual(settings.providers.anthropic, { apiKey: 'sk-test-123', model: 'claude-opus-5' });
}));

test('setProviderCredentials with a blank key removes any existing entry', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  setProviderCredentials('anthropic', { apiKey: '   ' });
  assert.equal('anthropic' in getAiProviderSettings().providers, false);
}));

test('setAiSendMode to direct keeps existing keys', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  setAiSendMode('direct');
  const settings = getAiProviderSettings();
  assert.equal(settings.mode, 'direct');
  assert.equal(settings.providers.anthropic.apiKey, 'sk-test-123');
}));

test('setAiSendMode to handoff wipes every saved key and custom provider', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  addCustomProvider({ name: 'My LLM', baseUrl: 'https://example.com/v1/chat', apiKey: 'k' });
  setAiSendMode('direct');
  setAiSendMode('handoff');
  const settings = getAiProviderSettings();
  assert.equal(settings.mode, 'handoff');
  assert.deepEqual(settings.providers, {});
  assert.deepEqual(settings.customProviders, []);
}));

test('setAiSendMode ignores an unknown mode', () => withStorage(() => {
  setAiSendMode('bogus');
  assert.equal(getAiProviderSettings().mode, 'handoff');
}));

test('addCustomProvider/updateCustomProvider/removeCustomProvider round-trip', () => withStorage(() => {
  const settings = addCustomProvider({ name: 'Local LLM', baseUrl: 'https://example.com/v1/chat', apiKey: 'k1', model: 'm1' });
  assert.equal(settings.customProviders.length, 1);
  const id = settings.customProviders[0].id;

  const afterUpdate = updateCustomProvider(id, { model: 'm2' });
  assert.equal(afterUpdate.customProviders[0].model, 'm2');
  assert.equal(afterUpdate.customProviders[0].name, 'Local LLM');

  const afterRemove = removeCustomProvider(id);
  assert.equal(afterRemove.customProviders.length, 0);
}));

test('addCustomProvider defaults an empty name to "Custom provider"', () => withStorage(() => {
  const settings = addCustomProvider({});
  assert.equal(settings.customProviders[0].name, 'Custom provider');
}));

test('clearAllAiProviderKeys wipes credentials but leaves the mode untouched', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  addCustomProvider({ name: 'X', baseUrl: 'https://example.com', apiKey: 'k' });
  setAiSendMode('direct');
  clearAllAiProviderKeys();
  const settings = getAiProviderSettings();
  assert.equal(settings.mode, 'direct');
  assert.deepEqual(settings.providers, {});
  assert.deepEqual(settings.customProviders, []);
}));

test('isDirectModeActive reflects the current mode', () => withStorage(() => {
  assert.equal(isDirectModeActive(), false);
  setAiSendMode('direct');
  assert.equal(isDirectModeActive(), true);
}));

test('getConfiguredDirectProviders returns [] whenever mode is handoff, even with saved keys', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  assert.deepEqual(getConfiguredDirectProviders(), []);
}));

test('getConfiguredDirectProviders lists configured built-ins (falling back to defaultModel) and customs', () => withStorage(() => {
  setAiSendMode('direct');
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' }); // no model set
  setProviderCredentials('gemini', { apiKey: 'g-key', model: 'gemini-custom' });
  addCustomProvider({ name: 'Local LLM', baseUrl: 'https://example.com/v1/chat', apiKey: 'k1', model: 'm1' });
  addCustomProvider({ name: 'No key yet' }); // no apiKey/baseUrl -> excluded

  const configured = getConfiguredDirectProviders();
  const anthropic = configured.find((p) => p.id === 'anthropic');
  assert.equal(anthropic.kind, 'builtin');
  assert.equal(anthropic.model, DIRECT_CAPABLE_PROVIDERS.find((p) => p.id === 'anthropic').defaultModel);

  const gemini = configured.find((p) => p.id === 'gemini');
  assert.equal(gemini.model, 'gemini-custom');

  const customs = configured.filter((p) => p.kind === 'custom');
  assert.equal(customs.length, 1);
  assert.equal(customs[0].name, 'Local LLM');
}));

test('AI_SEND_MODES and HANDOFF_TO_DIRECT_ID stay in sync with the built-in providers', () => {
  assert.deepEqual(AI_SEND_MODES, ['handoff', 'direct', 'local']);
  for (const directId of Object.values(HANDOFF_TO_DIRECT_ID)) {
    assert.ok(DIRECT_CAPABLE_PROVIDERS.some((p) => p.id === directId), `${directId} should be a DIRECT_CAPABLE_PROVIDERS entry`);
  }
});

test('getAiProviderSettings defaults localModel to the first LOCAL_MODEL_CHOICES entry', () => withStorage(() => {
  assert.equal(getAiProviderSettings().localModel, LOCAL_MODEL_CHOICES[0].id);
}));

test('setLocalModel saves a valid choice and ignores an unknown model id', () => withStorage(() => {
  const secondChoice = LOCAL_MODEL_CHOICES[1].id;
  setLocalModel(secondChoice);
  assert.equal(getAiProviderSettings().localModel, secondChoice);

  setLocalModel('not-a-real-model');
  assert.equal(getAiProviderSettings().localModel, secondChoice, 'an invalid id should be ignored, not overwrite the saved choice');
}));

test('a stored localModel not in LOCAL_MODEL_CHOICES (e.g. after a library upgrade) falls back to the default', () => withStorage(() => {
  setLocalModel(LOCAL_MODEL_CHOICES[1].id);
  // Simulate a future re-curation removing that id from the choices list by writing it directly.
  const raw = JSON.parse(globalThis.window.localStorage.getItem('sdb:v1:aiProviderKeys'));
  raw.localModel = 'a-model-id-that-no-longer-exists';
  globalThis.window.localStorage.setItem('sdb:v1:aiProviderKeys', JSON.stringify(raw));
  assert.equal(getAiProviderSettings().localModel, LOCAL_MODEL_CHOICES[0].id);
}));

test('isLocalModeActive reflects the current mode', () => withStorage(() => {
  assert.equal(isLocalModeActive(), false);
  setAiSendMode('local');
  assert.equal(isLocalModeActive(), true);
  assert.equal(isDirectModeActive(), false);
}));

test('switching to local mode never touches provider keys, and switching away from local to handoff still wipes them if present', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  setAiSendMode('local');
  assert.equal(getAiProviderSettings().providers.anthropic.apiKey, 'sk-test-123', 'switching to local should not touch saved keys');

  setAiSendMode('handoff');
  const settings = getAiProviderSettings();
  assert.deepEqual(settings.providers, {}, 'switching away to handoff should still wipe keys regardless of which mode it came from');
}));

test('switching to handoff preserves the chosen local model instead of resetting it', () => withStorage(() => {
  const secondChoice = LOCAL_MODEL_CHOICES[1].id;
  setLocalModel(secondChoice);
  setAiSendMode('local');
  setAiSendMode('handoff');
  assert.equal(getAiProviderSettings().localModel, secondChoice, 'the model choice is not a credential and should survive the mode-switch wipe');
}));

test('getConfiguredDirectProviders returns [] while in local mode too, not just handoff', () => withStorage(() => {
  setProviderCredentials('anthropic', { apiKey: 'sk-test-123' });
  setAiSendMode('local');
  assert.deepEqual(getConfiguredDirectProviders(), []);
}));

test('LOCAL_MODEL_CHOICES entries look like real WebLLM MLC model IDs', () => {
  for (const choice of LOCAL_MODEL_CHOICES) {
    assert.match(choice.id, /-MLC$/, `${choice.id} should end in -MLC per WebLLM's naming convention`);
    assert.ok(choice.name, `${choice.id} needs a display name`);
    assert.match(choice.sizeLabel, /GB/, `${choice.id} needs an approximate size label`);
  }
});
