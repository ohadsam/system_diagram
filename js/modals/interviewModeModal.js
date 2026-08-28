// "🎓 Interview Mode" — practice a system design interview question against
// a timer, then get AI feedback on the diagram you built. Reuses the same
// AI hand-off/direct/local infrastructure as every other AI feature here
// (utils/aiProviderActions.js via modals/aiAskModal.js) for grading — no
// separate grading pipeline, no fake automatic score. The timer/challenge
// itself is core/interviewMode.js's in-memory session state (not part of
// the project JSON — see that file's header comment for why), so toolbar.js
// can show a live countdown badge even while this modal is closed and
// you're working on the canvas.
import { openModal } from './modal.js';
import { openAiAskModal } from './aiAskModal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { INTERVIEW_PROMPTS } from '../core/interviewPrompts.js';
import { startInterview, endInterview, getInterviewSession, getRemainingMs, formatRemaining } from '../core/interviewMode.js';
import { buildDiagramDescription } from '../core/diagramDescription.js';
import { buildGradingPrompt } from '../io/interviewGrading.js';
import { resolveComponentDef } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';

const DURATION_CHOICES = [15, 30, 45, 60];

function plainTextDescription() {
  const state = store.getState();
  const description = buildDiagramDescription(state.nodes, state.edges, (defId) => resolveComponentDef(defId));
  const lines = [description.summary];
  if (description.categoryLines.length) lines.push('', 'By category:', ...description.categoryLines.map((l) => `- ${l}`));
  if (description.connectionLines.length) lines.push('', 'Connections:', ...description.connectionLines.map((l) => `- ${l}`));
  if (description.isolatedLines.length) lines.push('', 'Not connected to anything:', ...description.isolatedLines.map((l) => `- ${l}`));
  return lines.join('\n');
}

function openGradingAsk(session) {
  const prompt = buildGradingPrompt({
    promptTitle: session.promptTitle,
    promptText: session.promptText,
    diagramDescription: plainTextDescription(),
  });
  openAiAskModal({
    title: '🎓 Interview Feedback',
    hint: `Grading against: "${session.promptTitle}"`,
    prompt,
  });
}

function renderActiveSession(body, api, session) {
  body.appendChild(el('h3', { text: session.promptTitle }));
  body.appendChild(el('p', { class: 'modal-hint', text: session.promptText }));

  const timerEl = el('div', { class: 'interview-timer' });
  const updateTimer = () => {
    const remaining = getRemainingMs();
    timerEl.textContent = remaining === null ? 'No time limit' : `⏱️ ${formatRemaining(remaining)} remaining`;
    timerEl.classList.toggle('interview-timer-up', remaining === 0);
  };
  updateTimer();
  const intervalId = setInterval(updateTimer, 1000);
  // openModal's own 'close' listener (js/modals/modal.js) fires on every
  // close path (✕, backdrop, Escape) — hooking the same event here is the
  // only way to guarantee this interval is cleared no matter how the user
  // closes the modal, not just via the buttons below.
  api.dialog.addEventListener('close', () => clearInterval(intervalId), { once: true });
  body.appendChild(timerEl);

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', {
    type: 'button', class: 'btn', text: '🎓 Submit for Grading',
    onClick: () => { openGradingAsk(session); api.close(); },
  }));
  actions.appendChild(el('button', {
    type: 'button', class: 'btn btn-secondary', text: '🛑 End Practice',
    onClick: () => { endInterview(); showToast('Interview practice ended.', 'info', 1800); api.close(); },
  }));
  body.appendChild(actions);
}

function renderPicker(body, api) {
  body.appendChild(el('p', { class: 'modal-hint', text: 'Pick a question, work the design on the canvas against the clock, then submit it for AI feedback — same hand-off/direct/local AI setup as everywhere else in this app.' }));

  let durationMinutes = 30;
  const durationRow = el('div', { class: 'interview-duration-row' });
  durationRow.appendChild(el('span', { text: 'Time limit:' }));
  for (const minutes of DURATION_CHOICES) {
    const btn = el('button', {
      type: 'button',
      class: `btn btn-sm interview-duration-btn${minutes === durationMinutes ? ' is-active' : ''}`,
      text: `${minutes}m`,
      onClick: () => {
        durationMinutes = minutes;
        durationRow.querySelectorAll('.interview-duration-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        noLimitBtn.classList.remove('is-active');
      },
    });
    durationRow.appendChild(btn);
  }
  const noLimitBtn = el('button', {
    type: 'button', class: 'btn btn-sm interview-duration-btn', text: 'No limit',
    onClick: () => {
      durationMinutes = null;
      durationRow.querySelectorAll('.interview-duration-btn').forEach((b) => b.classList.remove('is-active'));
      noLimitBtn.classList.add('is-active');
    },
  });
  durationRow.appendChild(noLimitBtn);
  body.appendChild(durationRow);

  const list = el('div', { class: 'interview-prompt-list' });
  for (const prompt of INTERVIEW_PROMPTS) {
    const row = el('div', { class: 'interview-prompt-row' });
    row.appendChild(el('div', { class: 'interview-prompt-info' }, [
      el('div', { class: 'interview-prompt-title' }, [
        el('span', { text: prompt.title }),
        el('span', { class: `interview-difficulty-badge interview-difficulty-${prompt.difficulty.toLowerCase()}`, text: prompt.difficulty }),
      ]),
      el('div', { class: 'interview-prompt-desc', text: prompt.prompt }),
    ]));
    row.appendChild(el('button', {
      type: 'button', class: 'btn btn-secondary btn-sm', text: '▶️ Start',
      onClick: () => {
        startInterview(prompt, durationMinutes);
        showToast(`Interview started: "${prompt.title}"${durationMinutes ? ` — ${durationMinutes} minutes` : ' — no time limit'}.`, 'success', 3000);
        api.close();
      },
    }));
    list.appendChild(row);
  }
  body.appendChild(list);
}

export function openInterviewModeModal() {
  openModal({
    title: '🎓 Interview Mode',
    className: 'interview-mode-modal',
    render: (body, api) => {
      clear(body);
      const session = getInterviewSession();
      if (session) renderActiveSession(body, api, session);
      else renderPicker(body, api);
    },
  });
}
