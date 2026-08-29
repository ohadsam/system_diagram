// "Generate Design from Spec" — a 3-step wizard: (1) provide a spec,
// (2) get a schema-anchored prompt and hand it to an AI, (3) paste the
// AI's JSON reply back in to load it as a real diagram. Same "prepare &
// hand off, no API key" mechanism as modals/../panel/aiReviewPanel.js —
// see docs/SPEC.md 4.13 for the full reasoning.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { validateProject } from '../core/project.js';
import { buildGenerateDesignPrompt, extractProjectJSON, autoArrangeIfNeeded } from '../io/aiGenerateDesign.js';
import { findShareHashInText, loadProjectFromHash } from '../io/shareLink.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';
import { offerAutoWalkthroughAnimation } from './autoAnimationPrompt.js';
import { attachSpeechToTextarea } from '../utils/speechInput.js';

const STEP_TITLES = ['Your spec', 'Copy this prompt to your AI', "Paste the AI's result"];

export function openGenerateDesignModal() {
  let step = 1;
  let specText = '';
  let promptOverride = null;
  let responseText = '';
  let pasteError = '';

  function currentPrompt() {
    if (promptOverride !== null) return promptOverride;
    return buildGenerateDesignPrompt({ specText });
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
    title: 'Generate Design from Spec',
    className: 'generate-design-modal',
    render: (body, api) => {
      const renderStep = () => {
        clear(body);
        const indicator = el('p', { class: 'modal-step-indicator', text: `Step ${step} of 3 — ${STEP_TITLES[step - 1]}` });
        body.appendChild(indicator);

        if (step === 1) renderStep1();
        else if (step === 2) renderStep2();
        else renderStep3();

        function renderStep1() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste your product/requirements spec below, or load it from a file — either way, the next step turns it into a ready-to-use prompt." }));

          const fileInput = el('input', { type: 'file', accept: '.txt,.md,.markdown,text/plain', 'aria-label': 'Load spec from a file' });
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            specText = await file.text();
            promptOverride = null;
            renderStep();
          });
          body.appendChild(fileInput);

          const textarea = el('textarea', {
            class: 'ai-review-prompt generate-design-spec',
            rows: 10,
            placeholder: 'Paste or type your spec here…',
            onInput: (e) => { specText = e.target.value; },
          });
          textarea.value = specText;
          body.appendChild(attachSpeechToTextarea(textarea));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Next →',
            onClick: () => {
              if (!specText.trim()) { showToast('Add some spec text or load a file first.', 'error'); return; }
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
            onDirectResult: (text) => { responseText = text; pasteError = ''; step = 3; renderStep(); },
          }));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 1; renderStep(); } }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Next →', onClick: () => { step = 3; renderStep(); } }));
          body.appendChild(actions);
        }

        function renderStep3() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste the AI's whole reply below — the JSON code block plus any surrounding text is fine, it'll be picked out automatically. A CLI tool that built you a share link instead (see docs/AI_INTEGRATION.md) works here too — paste the link itself." }));
          const responseArea = el('textarea', {
            class: 'ai-review-response generate-design-response',
            rows: 12,
            placeholder: "Paste the AI's response here…",
            onInput: (e) => { responseText = e.target.value; pasteError = ''; },
          });
          responseArea.value = responseText;
          body.appendChild(responseArea);

          const errorEl = el('p', { class: 'generate-design-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 2; renderStep(); } }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Generate design',
            onClick: async () => {
              // A share link (docs/AI_INTEGRATION.md's "no copy/paste of raw
              // JSON at all" path) decodes straight to a project — checked
              // first since its hash could otherwise be mistaken for noise
              // around a JSON block by extractProjectJSON below.
              const shareHash = findShareHashInText(responseArea.value);
              let validated;
              if (shareHash) {
                const project = await loadProjectFromHash(shareHash);
                if (!project) { pasteError = "That looked like a share link but it couldn't be decoded — check you copied the whole link."; renderStep(); return; }
                validated = { ok: true, project };
              } else {
                const extracted = extractProjectJSON(responseArea.value);
                if (!extracted.ok) { pasteError = extracted.error; renderStep(); return; }
                validated = validateProject(extracted.data);
              }
              if (!validated.ok || !validated.project.nodes.length) {
                pasteError = "That didn't look like a valid design — no components were found. Check the AI's reply matches the requested JSON shape, or try again.";
                renderStep();
                return;
              }
              const project = autoArrangeIfNeeded(validated.project);

              const currentHasContent = store.getState().nodes.length > 0;
              if (currentHasContent) {
                const proceed = await confirmAction({
                  title: 'Replace the current canvas?',
                  message: 'This loads the generated design in place of what\'s on the canvas now. If you want to keep your current diagram, use "Save As" first — undo (Ctrl/Cmd+Z) can also bring it right back.',
                  confirmLabel: 'Replace',
                  danger: false,
                });
                if (!proceed) return;
              }
              store.loadProject(project);
              showToast(`Generated a design with ${project.nodes.length} component${project.nodes.length === 1 ? '' : 's'}.`, 'success', 2600);
              api.close();
              offerAutoWalkthroughAnimation();
            },
          }));
          body.appendChild(actions);
        }
      };

      renderStep();
    },
  });
}
