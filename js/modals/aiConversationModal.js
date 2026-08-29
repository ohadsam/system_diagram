// "🗨️ AI Conversation" — an ongoing, reopenable back-and-forth about the
// current diagram, unlike modals/aiEditModal.js's one-shot patch wizard.
// Same 3-step "prepare & hand off, no API key" shape per round (see
// io/aiEditDesign.js's header comment for why), but the transcript persists
// across rounds (io/aiConversationStore.js) and every round's prompt embeds
// the *whole* prior transcript (core/aiConversation.js#buildConversationPrompt)
// so a stateless AI — a browser chat tab, or an AI CLI tool invoked fresh
// each time — stays "aware" of everything already discussed. See
// docs/AI_INTEGRATION.md's "Continuing the Conversation" section for the
// same protocol written for an external AI/CLI tool reading cold.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { createTurn, buildConversationPrompt, extractConversationReply } from '../core/aiConversation.js';
import { getConversationTurns, appendConversationTurn, clearConversation } from '../io/aiConversationStore.js';
import { summarizePatch } from '../io/aiEditDesign.js';
import { applyAiEditPatch } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';
import { attachSpeechToTextarea } from '../utils/speechInput.js';

const STEP_TITLES = ['Your message', 'Copy this prompt to your AI', "Paste the AI's reply"];

export function openAiConversationModal() {
  let turns = getConversationTurns();
  let step = 1;
  let draftMessage = '';
  let promptOverride = null;
  let responseText = '';
  let pasteError = '';
  let pendingReply = null; // { message, patch } once step 3's paste has been parsed, before it's added

  function currentPrompt() {
    if (promptOverride !== null) return promptOverride;
    return buildConversationPrompt({ turns, newMessage: draftMessage, project: store.getState() });
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
    title: '🗨️ AI Conversation',
    className: 'ai-conversation-modal',
    render: (body, api) => {
      const renderAll = () => {
        clear(body);
        body.appendChild(buildTranscript(turns, clearAll));

        const indicator = el('p', { class: 'modal-step-indicator', text: `Step ${step} of 3 — ${STEP_TITLES[step - 1]}` });
        body.appendChild(indicator);

        if (step === 1) renderStep1();
        else if (step === 2) renderStep2();
        else renderStep3();

        function renderStep1() {
          body.appendChild(el('p', {
            class: 'modal-hint',
            text: turns.length
              ? 'Continue the conversation — your message is sent along with everything discussed so far and the diagram\'s current state.'
              : "Start a conversation about this diagram — ask a question, request a change, or both. Every message you send from here on carries the full conversation with it, so your AI never needs re-briefing.",
          }));

          const textarea = el('textarea', {
            class: 'ai-review-prompt ai-conversation-draft',
            rows: 5,
            placeholder: 'What would you like to ask or change?',
            onInput: (e) => { draftMessage = e.target.value; },
          });
          textarea.value = draftMessage;
          body.appendChild(attachSpeechToTextarea(textarea));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Close', onClick: () => api.close() }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Next →',
            onClick: () => {
              if (!draftMessage.trim()) { showToast('Type a message first.', 'error'); return; }
              turns = appendConversationTurn(createTurn('user', draftMessage));
              promptOverride = null;
              step = 2;
              renderAll();
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
            onClick: () => { promptOverride = null; renderAll(); },
          }));
          body.appendChild(promptActions);

          body.appendChild(el('h3', { class: 'modal-subheading', text: 'Open your AI (copies the prompt and opens a new tab) — or send it directly' }));
          body.appendChild(buildAiProviderActions({
            openProvider,
            getPrompt: currentPrompt,
            onDirectResult: (text) => { responseText = text; pasteError = ''; pendingReply = null; step = 3; renderAll(); },
          }));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 1; renderAll(); } }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Next →', onClick: () => { step = 3; renderAll(); } }));
          body.appendChild(actions);
        }

        function renderStep3() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste the AI's whole reply below — its message, plus a JSON code block if it proposed a diagram change, is picked out automatically." }));
          const responseArea = el('textarea', {
            class: 'ai-review-response ai-conversation-response',
            rows: 10,
            placeholder: "Paste the AI's reply here…",
            onInput: (e) => { responseText = e.target.value; pasteError = ''; pendingReply = null; },
          });
          responseArea.value = responseText;
          body.appendChild(responseArea);

          const errorEl = el('p', { class: 'ai-edit-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          if (!pendingReply) {
            const actions = el('div', { class: 'modal-actions' });
            actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 2; renderAll(); } }));
            actions.appendChild(el('button', {
              type: 'button', class: 'btn btn-primary', text: 'Continue',
              onClick: () => {
                if (!responseArea.value.trim()) { pasteError = "Paste the AI's reply first."; renderAll(); return; }
                pendingReply = extractConversationReply(responseArea.value);
                renderAll();
              },
            }));
            body.appendChild(actions);
            return;
          }

          body.appendChild(el('div', { class: 'ai-conversation-preview-message', text: pendingReply.message }));

          let summary = null;
          if (pendingReply.patch) {
            summary = summarizePatch(pendingReply.patch, store.getState());
            if (!summary.isEmpty) {
              body.appendChild(el('h3', { class: 'modal-subheading', text: 'Proposed diagram update' }));
              const list = el('div', { class: 'ai-edit-preview-list' });
              for (const row of [...summary.toAdd, ...summary.toUpdate, ...summary.toRemove]) {
                list.appendChild(el('div', { class: `ai-edit-preview-row ai-edit-preview-${row.type}`, text: row.text }));
              }
              body.appendChild(list);
              for (const warning of summary.warnings) {
                body.appendChild(el('p', { class: 'ai-edit-warning', text: `⚠️ ${warning}` }));
              }
            }
          }

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Edit reply', onClick: () => { pendingReply = null; renderAll(); } }));
          if (summary && !summary.isEmpty) {
            actions.appendChild(el('button', {
              type: 'button', class: 'btn', text: 'Add without applying',
              onClick: () => finishTurn(false),
            }));
            actions.appendChild(el('button', {
              type: 'button', class: 'btn btn-primary', text: 'Apply update & continue',
              onClick: () => finishTurn(true),
            }));
          } else {
            actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Add to conversation', onClick: () => finishTurn(false) }));
          }
          body.appendChild(actions);

          function finishTurn(apply) {
            if (apply) {
              applyAiEditPatch(pendingReply.patch);
              showToast('Applied — Ctrl/Cmd+Z to undo.', 'success', 2600);
            }
            turns = appendConversationTurn(createTurn('ai', pendingReply.message, { patchApplied: apply }));
            draftMessage = '';
            responseText = '';
            pendingReply = null;
            step = 1;
            renderAll();
          }
        }
      };

      function clearAll() {
        confirmAction({
          title: 'Clear this conversation?',
          message: 'Removes the whole transcript shown above — it does not affect your diagram. This can\'t be undone.',
          confirmLabel: 'Clear',
          danger: true,
        }).then((proceed) => {
          if (!proceed) return;
          clearConversation();
          turns = [];
          step = 1;
          draftMessage = '';
          promptOverride = null;
          responseText = '';
          pasteError = '';
          pendingReply = null;
          renderAll();
        });
      }

      renderAll();
    },
  });
}

function buildTranscript(turns, onClear) {
  const wrap = el('div', { class: 'ai-conversation-transcript' });
  if (!turns.length) {
    wrap.appendChild(el('p', { class: 'ai-conversation-empty', text: 'No messages yet — start below.' }));
    return wrap;
  }
  const list = el('div', { class: 'ai-conversation-turns' });
  for (const turn of turns) {
    const bubble = el('div', { class: `ai-conversation-turn ai-conversation-turn-${turn.role}` });
    bubble.appendChild(el('span', { class: 'ai-conversation-turn-who', text: turn.role === 'ai' ? 'AI' : 'You' }));
    bubble.appendChild(el('span', { class: 'ai-conversation-turn-message', text: turn.message }));
    if (turn.patchApplied) bubble.appendChild(el('span', { class: 'ai-conversation-turn-badge', text: '✓ diagram updated' }));
    list.appendChild(bubble);
  }
  wrap.appendChild(list);
  wrap.appendChild(el('button', { type: 'button', class: 'btn-link ai-conversation-clear', text: '🗑️ Clear conversation', onClick: onClear }));
  return wrap;
}
