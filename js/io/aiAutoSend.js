// Shared "call whichever automatic AI mode is configured right now"
// dispatcher — Local AI mode, or the first configured Direct API provider.
// Extracted out of io/autoSuggest.js once a second caller (panel/aiChatPanel.js,
// the in-app live chat) needed the exact same three-way branch. This is
// deliberately for callers with no UI to pick a specific provider from
// (a background check, a chat message) — utils/aiProviderActions.js's
// button row is still the right place for a feature that shows every
// hand-off option side by side and lets the user choose.
import { isLocalModeActive, isDirectModeActive, getAiProviderSettings, getConfiguredDirectProviders } from './aiProviderKeys.js';
import { generateLocal } from './webllmEngine.js';
import { sendPromptDirect } from './aiDirectCall.js';

/**
 * @param {{prompt: string, imageBase64?: string, onProgress?: (report: object) => void}} opts
 * @returns {Promise<{ok:true, text:string}|{ok:false, error:string}>}
 */
export async function sendPromptAutomatic({ prompt, imageBase64, onProgress } = {}) {
  if (isLocalModeActive()) {
    return generateLocal({ modelId: getAiProviderSettings().localModel, prompt, onProgress });
  }
  if (isDirectModeActive()) {
    const providers = getConfiguredDirectProviders();
    if (!providers.length) return { ok: false, error: 'No configured Direct API provider.' };
    return sendPromptDirect(providers[0], { prompt, imageBase64 });
  }
  return { ok: false, error: 'Automatic sending is not configured.' };
}
