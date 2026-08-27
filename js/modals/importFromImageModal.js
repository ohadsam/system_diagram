// "Import Diagram from Image" — the reverse of "Generate Design from
// Spec" (modals/generateDesignModal.js): a 3-step wizard that turns an
// uploaded architecture diagram image (screenshot, exported image,
// whiteboard photo, hand-drawn sketch) into a real editable diagram,
// instead of turning spec text into one. Same "prepare & hand off, no API
// key required" mechanism otherwise — see io/aiGenerateDesign.js's
// buildImportFromImagePrompt header comment.
//
// Vision needs an actual multimodal request: Local AI mode is text-only
// (utils/aiProviderActions.js never attaches an image to it), so this only
// works automatically via Direct API mode with a vision-capable provider,
// or by hand-off (open the provider, separately copy/attach the image
// yourself — only one clipboard slot exists, so the prompt and image can't
// both ride the same "copy" action, exactly like panel/aiReviewPanel.js's
// separate "Get the diagram image" step).
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { validateProject } from '../core/project.js';
import { buildImportFromImagePrompt, extractProjectJSON, autoArrangeIfNeeded } from '../io/aiGenerateDesign.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';
import { downloadBlob } from '../utils/download.js';
import { offerAutoWalkthroughAnimation } from './autoAnimationPrompt.js';

const STEP_TITLES = ['Attach an image', 'Copy this prompt to your AI', "Paste the AI's result"];

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function openImportFromImageModal() {
  let step = 1;
  let imageFile = null;
  let imageBase64 = null;
  let imageObjectUrl = null;
  let promptOverride = null;
  let responseText = '';
  let pasteError = '';

  function currentPrompt() {
    if (promptOverride !== null) return promptOverride;
    return buildImportFromImagePrompt();
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
    if (copied) showToast(`Prompt copied — opened ${provider.name}. Attach the image below, paste the prompt, and send.`, 'success', 3600);
  }

  async function copyImageToClipboard() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      showToast("This browser can't copy images — attach the file directly instead.", 'error');
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ [imageFile.type]: imageFile })]);
      showToast('Image copied — paste it into your AI chat.', 'success');
    } catch {
      showToast('Copy failed — attach the file directly instead.', 'error');
    }
  }

  openModal({
    title: 'Import Diagram from Image',
    className: 'generate-design-modal',
    onClose: () => { if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl); },
    render: (body, api) => {
      const renderStep = () => {
        clear(body);
        const indicator = el('p', { class: 'modal-step-indicator', text: `Step ${step} of 3 — ${STEP_TITLES[step - 1]}` });
        body.appendChild(indicator);

        if (step === 1) renderStep1();
        else if (step === 2) renderStep2();
        else renderStep3();

        function renderStep1() {
          body.appendChild(el('p', { class: 'modal-hint', text: 'Attach an image of an architecture diagram — a screenshot, an exported image, a photo of a whiteboard, or a hand-drawn sketch — and the next step turns it into a ready-to-use prompt for a vision-capable AI.' }));

          const fileInput = el('input', { type: 'file', accept: 'image/*', 'aria-label': 'Attach a diagram image' });
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            imageFile = file;
            imageBase64 = await readFileAsBase64(file);
            if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
            imageObjectUrl = URL.createObjectURL(file);
            renderStep();
          });
          body.appendChild(fileInput);

          if (imageObjectUrl) {
            body.appendChild(el('img', { src: imageObjectUrl, class: 'import-image-preview', alt: 'Attached diagram preview' }));
          }

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Next →', disabled: !imageFile,
            onClick: () => { step = 2; renderStep(); },
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

          body.appendChild(el('h3', { class: 'modal-subheading', text: 'Get the attached image' }));
          const imageActions = el('div', { class: 'field-row' });
          imageActions.appendChild(el('button', { type: 'button', class: 'btn btn-secondary', text: '⬇️ Download image', onClick: () => downloadBlob(imageFile, imageFile.name) }));
          imageActions.appendChild(el('button', { type: 'button', class: 'btn btn-secondary', text: '📋 Copy image', onClick: copyImageToClipboard }));
          body.appendChild(imageActions);
          body.appendChild(el('p', { class: 'modal-hint', text: 'Works best with a vision-capable model (Claude, Gemini, ChatGPT). Local AI mode never sends the image — it\'s text-only.' }));

          body.appendChild(el('h3', { class: 'modal-subheading', text: 'Open your AI (copies the prompt and opens a new tab) — or send it directly' }));
          body.appendChild(buildAiProviderActions({
            openProvider,
            getPrompt: currentPrompt,
            getImageBase64: () => imageBase64,
            onDirectResult: (text) => { responseText = text; pasteError = ''; step = 3; renderStep(); },
          }));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 1; renderStep(); } }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Next →', onClick: () => { step = 3; renderStep(); } }));
          body.appendChild(actions);
        }

        function renderStep3() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste the AI's whole reply below — the JSON code block plus any surrounding text is fine, it'll be picked out automatically." }));
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
            type: 'button', class: 'btn btn-primary', text: 'Import diagram',
            onClick: async () => {
              const extracted = extractProjectJSON(responseArea.value);
              if (!extracted.ok) { pasteError = extracted.error; renderStep(); return; }
              const validated = validateProject(extracted.data);
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
                  message: 'This loads the imported design in place of what\'s on the canvas now. If you want to keep your current diagram, use "Save As" first — undo (Ctrl/Cmd+Z) can also bring it right back.',
                  confirmLabel: 'Replace',
                  danger: false,
                });
                if (!proceed) return;
              }
              store.loadProject(project);
              showToast(`Imported a design with ${project.nodes.length} component${project.nodes.length === 1 ? '' : 's'}.`, 'success', 2600);
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
