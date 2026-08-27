// Shared "how do I get this prompt to an AI" UI, reused identically by the
// three AI-assisted flows — AI Design Review (panel/aiReviewPanel.js),
// Generate Design from Spec (modals/generateDesignModal.js), and Edit with
// AI (modals/aiEditModal.js) — which otherwise each rendered this by hand
// from the same io/aiReview.js#AI_PROVIDERS list.
//
// Always renders the existing hand-off grid (copy the prompt, open the
// provider's own website, paste it in yourself) for every provider in
// AI_PROVIDERS. When Direct mode is configured (Settings -> AI Providers,
// see io/aiProviderKeys.js) for a given provider, ALSO renders a
// "⚡ Send directly" button next to it — clicking it calls that provider's
// API right from here (io/aiDirectCall.js) and hands the reply text
// straight to `onDirectResult`, skipping the copy/open/paste dance
// entirely. When Local AI mode is active instead, ALSO renders a single
// "🧩 Send to Local AI" button that runs the chosen open model right in
// this browser (io/webllmEngine.js) — no key, no account, text-only (the
// diagram image, if any, is never sent to it). Every hand-off button
// never goes away regardless of which mode is configured, so a failed
// direct/local call (network/CORS/rate-limit/WebGPU-unsupported/anything)
// always has the working fallback sitting right next to it.
import { el } from './dom.js';
import { showToast } from './toast.js';
import { AI_PROVIDERS } from '../io/aiReview.js';
import { getConfiguredDirectProviders, HANDOFF_TO_DIRECT_ID, isLocalModeActive, getAiProviderSettings, LOCAL_MODEL_CHOICES } from '../io/aiProviderKeys.js';
import { sendPromptDirect } from '../io/aiDirectCall.js';
import { generateLocal } from '../io/webllmEngine.js';

/**
 * @param {object} opts
 * @param {(provider: {id:string,name:string,icon:string,url:string}) => void} opts.openProvider hand-off button handler (copies the prompt + opens the site)
 * @param {() => string} opts.getPrompt current prompt text, read at click time
 * @param {() => Promise<string|undefined>} [opts.getImageBase64] optional — only AI Design Review attaches an image
 * @param {(text: string) => void} opts.onDirectResult called with the reply text on a successful direct send
 */
export function buildAiProviderActions({ openProvider, getPrompt, getImageBase64, onDirectResult }) {
  const wrap = el('div', { class: 'ai-provider-actions' });
  const directProviders = getConfiguredDirectProviders();
  const directById = new Map(directProviders.filter((p) => p.kind === 'builtin').map((p) => [p.id, p]));

  const sendDirect = async (button, provider, label) => {
    button.disabled = true;
    button.textContent = 'Sending…';
    const imageBase64 = getImageBase64 ? await getImageBase64() : undefined;
    const result = await sendPromptDirect(provider, { prompt: getPrompt(), imageBase64 });
    button.disabled = false;
    button.textContent = label;
    if (!result.ok) { showToast(result.error, 'error', 4500); return; }
    onDirectResult(result.text);
    showToast(`Got a response from ${provider.name}.`, 'success', 2200);
  };

  const grid = el('div', { class: 'ai-provider-grid' });
  for (const provider of AI_PROVIDERS) {
    const row = el('div', { class: 'ai-provider-row' });
    row.appendChild(el('button', {
      type: 'button', class: 'btn ai-provider-btn', onClick: () => openProvider(provider),
    }, [
      el('span', { class: 'ai-provider-icon', text: provider.icon, 'aria-hidden': 'true' }),
      el('span', { text: provider.name }),
    ]));

    const direct = directById.get(HANDOFF_TO_DIRECT_ID[provider.id]);
    if (direct) {
      const label = '⚡ Send directly';
      const sendBtn = el('button', {
        type: 'button', class: 'btn btn-secondary ai-provider-direct-btn',
        title: `Send directly to ${direct.name} using your saved API key — no copy/paste needed`,
        text: label,
        onClick: () => sendDirect(sendBtn, direct, label),
      });
      row.appendChild(sendBtn);
    }
    grid.appendChild(row);
  }
  wrap.appendChild(grid);

  const customProviders = directProviders.filter((p) => p.kind === 'custom');
  if (customProviders.length) {
    const customWrap = el('div', { class: 'ai-provider-custom-list' });
    for (const provider of customProviders) {
      const label = `⚡ Send to ${provider.name}`;
      const sendBtn = el('button', {
        type: 'button', class: 'btn btn-secondary ai-provider-direct-btn',
        text: label,
        onClick: () => sendDirect(sendBtn, provider, label),
      });
      customWrap.appendChild(sendBtn);
    }
    wrap.appendChild(customWrap);
  }

  if (isLocalModeActive()) {
    const modelId = getAiProviderSettings().localModel;
    const modelChoice = LOCAL_MODEL_CHOICES.find((m) => m.id === modelId) || LOCAL_MODEL_CHOICES[0];
    const localWrap = el('div', { class: 'ai-local-actions' });
    const label = `🧩 Send to Local AI (${modelChoice.name.split(' — ')[0]})`;
    const progressEl = el('span', { class: 'ai-local-progress' });
    const sendBtn = el('button', {
      type: 'button', class: 'btn btn-secondary ai-provider-direct-btn',
      title: 'Runs an open model entirely in this browser via WebGPU — no key, no account, nothing leaves your device. Text only; the diagram image (if any) is not sent to it.',
      text: label,
      onClick: () => sendLocal(sendBtn, progressEl, modelChoice.id, label),
    });
    localWrap.appendChild(sendBtn);
    localWrap.appendChild(progressEl);
    wrap.appendChild(localWrap);
  }

  async function sendLocal(button, progressEl, modelId, label) {
    button.disabled = true;
    button.textContent = 'Working…';
    const result = await generateLocal({
      modelId,
      prompt: getPrompt(),
      onProgress: (report) => {
        progressEl.textContent = report?.text
          || (typeof report?.progress === 'number' ? `Loading model… ${Math.round(report.progress * 100)}%` : 'Loading model…');
      },
    });
    button.disabled = false;
    button.textContent = label;
    progressEl.textContent = '';
    if (!result.ok) { showToast(result.error, 'error', 5000); return; }
    onDirectResult(result.text);
    showToast('Got a response from the local model.', 'success', 2200);
  }

  return wrap;
}
