// Generic single-step "ask an AI a question about this diagram, read the
// answer" modal — shared by every AI feature that doesn't need a
// preview/apply step afterward (unlike Generate Design or Edit with AI,
// which feed the reply back into the project as structured data). Used by
// "Explain this diff with AI" (diagramCompareModal.js) and "Ask AI to
// reduce this cost" (costBreakdownModal.js).
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';

/**
 * @param {object} opts
 * @param {string} opts.title modal title (with an emoji, matching this app's convention)
 * @param {string} opts.hint one-line explanation shown above the prompt
 * @param {string} opts.prompt the ready-made prompt text
 */
export function openAiAskModal({ title, hint, prompt }) {
  let answer = '';

  async function copyPromptToClipboard() {
    try {
      await navigator.clipboard.writeText(prompt);
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
    title,
    className: 'ai-ask-modal',
    render: (body) => {
      body.appendChild(el('p', { class: 'modal-hint', text: hint }));

      const promptArea = el('textarea', { class: 'ai-review-prompt', rows: 8, readOnly: true });
      promptArea.value = prompt;
      body.appendChild(promptArea);

      body.appendChild(buildAiProviderActions({
        openProvider,
        getPrompt: () => prompt,
        onDirectResult: (text) => { answer = text; answerArea.value = answer; },
      }));

      body.appendChild(el('h3', { class: 'modal-subheading', text: "AI's answer" }));
      const answerArea = el('textarea', {
        class: 'ai-review-response',
        rows: 6,
        placeholder: "Paste the AI's reply here…",
        onInput: (e) => { answer = e.target.value; },
      });
      answerArea.value = answer;
      body.appendChild(answerArea);
    },
  });
}
