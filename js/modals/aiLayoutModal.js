// "AI Beautify Layout" — the AI-judgement sibling of Tools -> Auto-arrange.
// A 2-step wizard (prompt -> paste result), same honest "prepare & hand
// off, no API key" mechanism as every other AI feature (see
// io/aiLayoutSuggest.js's header comment).
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { buildLayoutBeautifyPrompt, extractLayoutJSON, sanitizeLayoutPatch } from '../io/aiLayoutSuggest.js';
import { applyLayoutRepositions } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';

const STEP_TITLES = ['Copy this prompt to your AI', "Paste the AI's result"];

export function openAiLayoutModal() {
  const project = store.getState();
  if (project.nodes.length < 2) {
    showToast('Add at least 2 components first — there\'s nothing to rearrange yet.', 'error');
    return;
  }

  let step = 1;
  let promptOverride = null;
  let responseText = '';
  let pasteError = '';

  function currentPrompt() {
    if (promptOverride !== null) return promptOverride;
    return buildLayoutBeautifyPrompt({ project: store.getState() });
  }

  async function copyPromptToClipboard() {
    try {
      await navigator.clipboard.writeText(currentPrompt());
      return true;
    } catch {
      showToast('Could not copy automatically — select the prompt text and copy it manually.', 'error');
      return false;
    }
  }

  async function openProvider(provider) {
    const copied = await copyPromptToClipboard();
    window.open(provider.url, '_blank', 'noopener');
    if (copied) showToast(`Prompt copied — opened ${provider.name}. Paste it in and send.`, 'success', 3000);
  }

  openModal({
    title: '🪄 AI Beautify Layout',
    className: 'ai-layout-modal',
    render: (body, api) => {
      const renderStep = () => {
        clear(body);
        body.appendChild(el('p', { class: 'modal-step-indicator', text: `Step ${step} of 2 — ${STEP_TITLES[step - 1]}` }));

        if (step === 1) renderStep1();
        else renderStep2();

        function renderStep1() {
          body.appendChild(el('p', { class: 'modal-hint', text: 'Asks an AI to suggest a nicer arrangement of the components already on your canvas — better readability and grouping, following the natural direction of your connections. Unlike Auto-arrange (a fixed algorithm), this uses the AI\'s own judgement. Only positions change — nothing is added, removed, resized, or renamed.' }));

          const promptArea = el('textarea', {
            class: 'ai-review-prompt',
            rows: 10,
            onInput: (e) => { promptOverride = e.target.value; },
          });
          promptArea.value = currentPrompt();
          body.appendChild(promptArea);

          const promptActions = el('div', { class: 'field-row' });
          promptActions.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '📋 Copy prompt',
            onClick: async () => { if (await copyPromptToClipboard()) showToast('Prompt copied to clipboard.', 'success', 1600); },
          }));
          promptActions.appendChild(el('button', {
            type: 'button', class: 'btn-link', text: 'Reset to auto-generated',
            onClick: () => { promptOverride = null; renderStep(); },
          }));
          body.appendChild(promptActions);

          body.appendChild(el('h3', { class: 'modal-subheading', text: 'Open your AI (copies the prompt and opens a new tab) — or send it directly' }));
          body.appendChild(buildAiProviderActions({
            openProvider,
            getPrompt: currentPrompt,
            onDirectResult: (text) => { responseText = text; pasteError = ''; step = 2; renderStep(); },
          }));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Next →', onClick: () => { step = 2; renderStep(); } }));
          body.appendChild(actions);
        }

        function renderStep2() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste the AI's whole reply below — the JSON code block plus any surrounding text is fine, it'll be picked out automatically." }));
          const responseArea = el('textarea', {
            class: 'ai-review-response',
            rows: 10,
            placeholder: "Paste the AI's response here…",
            onInput: (e) => { responseText = e.target.value; pasteError = ''; },
          });
          responseArea.value = responseText;
          body.appendChild(responseArea);

          const errorEl = el('p', { class: 'ai-edit-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 1; renderStep(); } }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Apply new layout',
            onClick: () => {
              const extracted = extractLayoutJSON(responseArea.value);
              if (!extracted.ok) { pasteError = extracted.error; renderStep(); return; }
              const repositions = sanitizeLayoutPatch(extracted.data, store.getState());
              if (!repositions.length) { pasteError = "That didn't look like a valid layout — check the AI's reply matches the requested JSON shape."; renderStep(); return; }
              applyLayoutRepositions(repositions);
              showToast(`Repositioned ${repositions.length} component${repositions.length === 1 ? '' : 's'} — Ctrl/Cmd+Z to undo.`, 'success', 2600);
              api.close();
            },
          }));
          body.appendChild(actions);
        }
      };

      renderStep();
    },
  });
}
