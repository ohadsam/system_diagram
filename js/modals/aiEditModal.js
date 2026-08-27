// "Edit with AI" — the incremental sibling of modals/generateDesignModal.js:
// instead of replacing the whole canvas, this asks an AI for a small patch
// against the diagram that's already there and previews it before applying.
// Same 3-step "prepare & hand off" wizard shape as Generate Design — see
// io/aiEditDesign.js's header comment for why there's no live API call.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { buildEditPrompt, extractPatchJSON, normalizePatch, summarizePatch } from '../io/aiEditDesign.js';
import { applyAiEditPatch } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';
import { attachSpeechToTextarea } from '../utils/speechInput.js';

const STEP_TITLES = ['Describe the change', 'Copy this prompt to your AI', "Paste the AI's result"];

export function openAiEditModal() {
  let step = 1;
  let instruction = '';
  let promptOverride = null;
  let responseText = '';
  let pasteError = '';
  let pendingPatch = null; // the normalized patch currently shown in the preview, or null before "Preview changes"

  function currentPrompt() {
    if (promptOverride !== null) return promptOverride;
    return buildEditPrompt({ project: store.getState(), instruction });
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
    title: 'Edit with AI',
    className: 'ai-edit-modal',
    render: (body, api) => {
      const renderStep = () => {
        clear(body);
        const indicator = el('p', { class: 'modal-step-indicator', text: `Step ${step} of 3 — ${STEP_TITLES[step - 1]}` });
        body.appendChild(indicator);

        if (step === 1) renderStep1();
        else if (step === 2) renderStep2();
        else renderStep3();

        function renderStep1() {
          body.appendChild(el('p', { class: 'modal-hint', text: 'Describe the change you want in plain language — e.g. "add a Redis cache between the API Gateway and the database" or "rename Order Service to Order API and make it a hexagon shape". The next step builds a prompt from this plus your current diagram.' }));

          const textarea = el('textarea', {
            class: 'ai-review-prompt ai-edit-instruction',
            rows: 5,
            placeholder: 'What would you like to change?',
            onInput: (e) => { instruction = e.target.value; },
          });
          textarea.value = instruction;
          body.appendChild(attachSpeechToTextarea(textarea));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Next →',
            onClick: () => {
              if (!instruction.trim()) { showToast('Describe the change you want first.', 'error'); return; }
              step = 2;
              renderStep();
            },
          }));
          body.appendChild(actions);
        }

        function renderStep2() {
          const promptArea = el('textarea', {
            class: 'ai-review-prompt',
            rows: 12,
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
            onDirectResult: (text) => { responseText = text; pasteError = ''; pendingPatch = null; step = 3; renderStep(); },
          }));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 1; renderStep(); } }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Next →', onClick: () => { step = 3; renderStep(); } }));
          body.appendChild(actions);
        }

        function renderStep3() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste the AI's whole reply below — the JSON code block plus any surrounding text is fine, it'll be picked out automatically." }));
          const responseArea = el('textarea', {
            class: 'ai-review-response ai-edit-response',
            rows: 10,
            placeholder: "Paste the AI's response here…",
            onInput: (e) => { responseText = e.target.value; pasteError = ''; pendingPatch = null; },
          });
          responseArea.value = responseText;
          body.appendChild(responseArea);

          const errorEl = el('p', { class: 'ai-edit-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          if (!pendingPatch) {
            const actions = el('div', { class: 'modal-actions' });
            actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 2; renderStep(); } }));
            actions.appendChild(el('button', {
              type: 'button', class: 'btn btn-primary', text: 'Preview changes',
              onClick: () => {
                const extracted = extractPatchJSON(responseArea.value);
                if (!extracted.ok) { pasteError = extracted.error; renderStep(); return; }
                const patch = normalizePatch(extracted.data);
                if (!patch) { pasteError = "That didn't look like a valid patch — check the AI's reply matches the requested JSON shape."; renderStep(); return; }
                pendingPatch = patch;
                renderStep();
              },
            }));
            body.appendChild(actions);
            return;
          }

          const summary = summarizePatch(pendingPatch, store.getState());
          if (summary.isEmpty) {
            body.appendChild(el('p', { class: 'diagram-lint-empty', text: "This patch doesn't change anything recognizable — go back and check the AI's reply, or try again with a clearer instruction." }));
          } else {
            const list = el('div', { class: 'ai-edit-preview-list' });
            for (const row of [...summary.toAdd, ...summary.toUpdate, ...summary.toRemove]) {
              list.appendChild(el('div', { class: `ai-edit-preview-row ai-edit-preview-${row.type}`, text: row.text }));
            }
            body.appendChild(list);
          }
          for (const warning of summary.warnings) {
            body.appendChild(el('p', { class: 'ai-edit-warning', text: `⚠️ ${warning}` }));
          }

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Edit response', onClick: () => { pendingPatch = null; renderStep(); } }));
          if (!summary.isEmpty) {
            actions.appendChild(el('button', {
              type: 'button', class: 'btn btn-primary', text: 'Apply changes',
              onClick: () => {
                applyAiEditPatch(pendingPatch);
                showToast('Applied — Ctrl/Cmd+Z to undo.', 'success', 2600);
                api.close();
              },
            }));
          }
          body.appendChild(actions);
        }
      };

      renderStep();
    },
  });
}
