// "🤖 AI Chat" — a fast, in-app live chat with whichever automatic AI mode
// is configured (Direct API or Local AI — see io/aiProviderKeys.js), for
// anyone who's already set one of those up and wants instant back-and-forth
// instead of modals/aiConversationModal.js's copy/paste hand-off wizard.
// This panel is genuinely useless without an automatic mode configured
// (there's no "open a website" fallback for a *live* chat — that's what
// AI Conversation already is), so it renders a setup nudge instead when
// io/aiProviderKeys.js#isAutomaticSendConfigured() is false.
//
// Shares the exact same transcript (io/aiConversationStore.js) and prompt
// format (core/aiConversation.js) as AI Conversation, deliberately — both
// are "a conversation about this diagram", just two different UIs on top
// of the same context, so switching between hand-off and live chat mid
// conversation carries every prior turn along rather than starting over.
// A reply's optional diagram-change patch (same format as Edit with AI)
// is previewed and applied inline, right under the message that proposed
// it, instead of a separate wizard step — this panel is meant to stay open
// and fast, not walk through steps.
//
// Positioning: unlike every other side panel in this app (which are always
// docked to one side), this one can also pin to the bottom or float as a
// draggable card — io/uiPrefs.js#aiChatDockMode/aiChatFloatingPos — since a
// chat someone keeps open while working benefits from living wherever
// doesn't get in the way of the diagram they're actually looking at.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { createTurn, buildConversationPrompt, extractConversationReply } from '../core/aiConversation.js';
import { getConversationTurns, appendConversationTurn, clearConversation, markPatchApplied } from '../io/aiConversationStore.js';
import { summarizePatch } from '../io/aiEditDesign.js';
import { applyAiEditPatch } from '../canvas/canvas.js';
import { sendPromptAutomatic } from '../io/aiAutoSend.js';
import { isAutomaticSendConfigured } from '../io/aiProviderKeys.js';
import { getUiPrefs, saveUiPrefs } from '../io/uiPrefs.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from '../modals/confirmModal.js';
import { attachSpeechToTextarea } from '../utils/speechInput.js';
import { openDefaultSettingsModal } from '../modals/defaultSettingsModal.js';
import { openAiConversationModal } from '../modals/aiConversationModal.js';

let rootEl = null;
let isOpen = false;
let draftMessage = '';
let sending = false;
let sendError = '';
let pendingPatch = null; // { turnId, patch } — the latest AI turn's un-applied patch, if any

export function initAiChatPanel(root) {
  rootEl = root;
  rootEl.classList.add('ai-chat-panel');
}

export function toggleAiChatPanel() {
  if (isOpen) close();
  else open();
}

function open() {
  isOpen = true;
  rootEl.classList.add('open');
  applyDockPosition();
  render();
}

export function close() {
  isOpen = false;
  rootEl.classList.remove('open');
}

function applyDockPosition() {
  const { aiChatDockMode, aiChatFloatingPos, aiChatWidth, aiChatBottomHeight, aiChatFloatingHeight } = getUiPrefs();
  rootEl.classList.remove('dock-right', 'dock-bottom', 'dock-floating');
  rootEl.classList.add(`dock-${aiChatDockMode}`);
  rootEl.style.left = '';
  rootEl.style.top = '';
  if (aiChatDockMode === 'floating' && aiChatFloatingPos) {
    rootEl.style.left = `${aiChatFloatingPos.x}px`;
    rootEl.style.top = `${aiChatFloatingPos.y}px`;
  }
  setOrClearVar('--ai-chat-panel-width', aiChatWidth);
  setOrClearVar('--ai-chat-panel-bottom-height', aiChatBottomHeight);
  setOrClearVar('--ai-chat-panel-floating-height', aiChatFloatingHeight);
}

function setOrClearVar(name, px) {
  if (px) rootEl.style.setProperty(name, `${px}px`);
  else rootEl.style.removeProperty(name);
}

function setDockMode(mode) {
  saveUiPrefs({ aiChatDockMode: mode });
  applyDockPosition();
  render();
}

function render() {
  clear(rootEl);
  if (!isAutomaticSendConfigured()) {
    renderSetupNudge();
  } else {
    renderChat();
  }
  rootEl.appendChild(buildResizeHandle());
}

// One resize handle per dock mode, each dragging a different CSS var (see
// css/variables.css) so a manually-picked size survives across reopening
// the panel and switching dock modes independently — 'right' only ever
// needs a width, 'bottom' only a height, 'floating' needs both from one
// corner grip. Present in every render (including the setup nudge), since
// there's no reason resizing should require AI mode to be configured first.
function buildResizeHandle() {
  const mode = getUiPrefs().aiChatDockMode;
  if (mode === 'bottom') return makeHandle('ai-chat-resize-h', beginBottomHeightResize, 'Drag to resize height');
  if (mode === 'floating') return makeHandle('ai-chat-resize-corner', beginFloatingResize, 'Drag to resize');
  return makeHandle('ai-chat-resize-w', beginWidthResize, 'Drag to resize width');
}

function makeHandle(className, onPointerDown, title) {
  const handle = el('div', { class: `ai-chat-resize-handle ${className}`, title });
  handle.addEventListener('pointerdown', onPointerDown);
  return handle;
}

function beginWidthResize(e) {
  e.preventDefault();
  const handle = e.currentTarget;
  const startX = e.clientX;
  const startWidth = rootEl.getBoundingClientRect().width;
  const maxWidth = Math.min(window.innerWidth - 80, 720);
  handle.setPointerCapture(e.pointerId);
  const onMove = (ev) => {
    const next = Math.min(maxWidth, Math.max(260, startWidth - (ev.clientX - startX)));
    rootEl.style.setProperty('--ai-chat-panel-width', `${next}px`);
  };
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove);
    saveUiPrefs({ aiChatWidth: parseFloat(rootEl.style.getPropertyValue('--ai-chat-panel-width')) || startWidth });
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp, { once: true });
}

function beginBottomHeightResize(e) {
  e.preventDefault();
  const handle = e.currentTarget;
  const startY = e.clientY;
  const startHeight = rootEl.getBoundingClientRect().height;
  const maxHeight = Math.min(window.innerHeight - 120, 700);
  handle.setPointerCapture(e.pointerId);
  const onMove = (ev) => {
    const next = Math.min(maxHeight, Math.max(160, startHeight - (ev.clientY - startY)));
    rootEl.style.setProperty('--ai-chat-panel-bottom-height', `${next}px`);
  };
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove);
    saveUiPrefs({ aiChatBottomHeight: parseFloat(rootEl.style.getPropertyValue('--ai-chat-panel-bottom-height')) || startHeight });
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp, { once: true });
}

function beginFloatingResize(e) {
  e.preventDefault();
  const handle = e.currentTarget;
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = rootEl.getBoundingClientRect();
  const startWidth = rect.width;
  const startHeight = rect.height;
  const maxWidth = Math.min(window.innerWidth - 40, 720);
  const maxHeight = Math.min(window.innerHeight - 40, 800);
  handle.setPointerCapture(e.pointerId);
  const onMove = (ev) => {
    const nextWidth = Math.min(maxWidth, Math.max(260, startWidth + (ev.clientX - startX)));
    const nextHeight = Math.min(maxHeight, Math.max(200, startHeight + (ev.clientY - startY)));
    rootEl.style.setProperty('--ai-chat-panel-width', `${nextWidth}px`);
    rootEl.style.setProperty('--ai-chat-panel-floating-height', `${nextHeight}px`);
  };
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove);
    saveUiPrefs({
      aiChatWidth: parseFloat(rootEl.style.getPropertyValue('--ai-chat-panel-width')) || startWidth,
      aiChatFloatingHeight: parseFloat(rootEl.style.getPropertyValue('--ai-chat-panel-floating-height')) || startHeight,
    });
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp, { once: true });
}

function buildHeader() {
  const header = el('div', { class: 'ai-chat-header' });
  header.appendChild(el('h3', { class: 'ai-chat-title', text: '🤖 AI Chat' }));

  const mode = getUiPrefs().aiChatDockMode;
  const dockControls = el('div', { class: 'ai-chat-dock-controls' });
  dockControls.appendChild(el('button', {
    type: 'button', class: `btn btn-icon ai-chat-dock-btn${mode === 'right' ? ' active' : ''}`,
    title: 'Dock to the right', 'aria-label': 'Dock to the right', text: '📌',
    onClick: () => setDockMode('right'),
  }));
  dockControls.appendChild(el('button', {
    type: 'button', class: `btn btn-icon ai-chat-dock-btn${mode === 'bottom' ? ' active' : ''}`,
    title: 'Dock to the bottom', 'aria-label': 'Dock to the bottom', text: '⬇️',
    onClick: () => setDockMode('bottom'),
  }));
  dockControls.appendChild(el('button', {
    type: 'button', class: `btn btn-icon ai-chat-dock-btn${mode === 'floating' ? ' active' : ''}`,
    title: 'Float — drag this header to move it anywhere on screen', 'aria-label': 'Float freely', text: '🗗',
    onClick: () => setDockMode('floating'),
  }));
  header.appendChild(dockControls);

  header.appendChild(el('button', {
    type: 'button', class: 'ai-chat-close', 'aria-label': 'Close AI Chat', title: 'Close', text: '✕', onClick: close,
  }));

  if (mode === 'floating') attachDrag(header);
  return header;
}

function attachDrag(header) {
  header.classList.add('ai-chat-draggable');
  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const rect = rootEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    header.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(0, window.innerHeight - 40);
      const x = Math.min(maxX, Math.max(0, startLeft + (ev.clientX - startX)));
      const y = Math.min(maxY, Math.max(0, startTop + (ev.clientY - startY)));
      rootEl.style.left = `${x}px`;
      rootEl.style.top = `${y}px`;
    };
    const onUp = () => {
      header.removeEventListener('pointermove', onMove);
      const finalRect = rootEl.getBoundingClientRect();
      saveUiPrefs({ aiChatFloatingPos: { x: finalRect.left, y: finalRect.top } });
    };
    header.addEventListener('pointermove', onMove);
    header.addEventListener('pointerup', onUp, { once: true });
  });
}

function renderSetupNudge() {
  rootEl.appendChild(buildHeader());
  const body = el('div', { class: 'ai-chat-body ai-chat-setup' });
  body.appendChild(el('p', { class: 'modal-hint', text: 'This live chat needs Direct API mode or Local AI mode configured first, so it can send and receive automatically — no copy/paste.' }));
  body.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: '⚙️ Set up AI now',
    onClick: () => { close(); openDefaultSettingsModal({ scrollToAiProviders: true }); },
  }));
  const alt = el('p', { class: 'ai-chat-setup-alt' });
  alt.appendChild(el('span', { text: 'Prefer copy/paste with any AI instead? ' }));
  alt.appendChild(el('button', { type: 'button', class: 'btn-link', text: '🗨️ Open AI Conversation', onClick: () => { close(); openAiConversationModal(); } }));
  body.appendChild(alt);
  rootEl.appendChild(body);
}

function renderChat() {
  rootEl.appendChild(buildHeader());

  const body = el('div', { class: 'ai-chat-body' });
  body.appendChild(buildTranscript());
  if (sendError) body.appendChild(el('p', { class: 'ai-edit-error', text: sendError }));
  rootEl.appendChild(body);

  rootEl.appendChild(buildInputRow());

  const scroller = rootEl.querySelector('.ai-conversation-turns');
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

function buildTranscript() {
  const turns = getConversationTurns();
  const wrap = el('div', { class: 'ai-conversation-transcript ai-chat-transcript' });
  if (!turns.length && !sending) {
    wrap.appendChild(el('p', { class: 'ai-conversation-empty', text: 'No messages yet — ask a question or request a change below.' }));
    return wrap;
  }

  const list = el('div', { class: 'ai-conversation-turns' });
  for (const turn of turns) {
    list.appendChild(buildTurnBubble(turn));
    if (pendingPatch && pendingPatch.turnId === turn.id) {
      const card = buildPendingPatchCard(turn);
      if (card) list.appendChild(card);
    }
  }
  if (sending) {
    const thinking = el('div', { class: 'ai-conversation-turn ai-conversation-turn-ai ai-chat-thinking' });
    thinking.appendChild(el('span', { class: 'ai-conversation-turn-who', text: 'AI' }));
    thinking.appendChild(el('span', { class: 'ai-conversation-turn-message', text: 'Thinking…' }));
    list.appendChild(thinking);
  }
  wrap.appendChild(list);

  if (turns.length) {
    wrap.appendChild(el('button', { type: 'button', class: 'btn-link ai-conversation-clear', text: '🗑️ Clear conversation', onClick: onClearClick }));
  }
  return wrap;
}

function buildTurnBubble(turn) {
  const bubble = el('div', { class: `ai-conversation-turn ai-conversation-turn-${turn.role}` });
  bubble.appendChild(el('span', { class: 'ai-conversation-turn-who', text: turn.role === 'ai' ? 'AI' : 'You' }));
  bubble.appendChild(el('span', { class: 'ai-conversation-turn-message', text: turn.message }));
  if (turn.patchApplied) bubble.appendChild(el('span', { class: 'ai-conversation-turn-badge', text: '✓ diagram updated' }));
  return bubble;
}

function buildPendingPatchCard(turn) {
  const summary = summarizePatch(pendingPatch.patch, store.getState());
  if (summary.isEmpty) return null;

  const card = el('div', { class: 'ai-chat-patch-card' });
  const list = el('div', { class: 'ai-edit-preview-list' });
  for (const row of [...summary.toAdd, ...summary.toUpdate, ...summary.toRemove]) {
    list.appendChild(el('div', { class: `ai-edit-preview-row ai-edit-preview-${row.type}`, text: row.text }));
  }
  card.appendChild(list);
  for (const warning of summary.warnings) card.appendChild(el('p', { class: 'ai-edit-warning', text: `⚠️ ${warning}` }));

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Dismiss', onClick: () => { pendingPatch = null; render(); } }));
  actions.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: '✓ Apply update',
    onClick: () => {
      applyAiEditPatch(pendingPatch.patch);
      markPatchApplied(turn.id);
      pendingPatch = null;
      showToast('Applied — Ctrl/Cmd+Z to undo.', 'success', 2600);
      render();
    },
  }));
  card.appendChild(actions);
  return card;
}

function onClearClick() {
  confirmAction({
    title: 'Clear this conversation?',
    message: "Removes the whole transcript shown above — it does not affect your diagram. This can't be undone.",
    confirmLabel: 'Clear',
    danger: true,
  }).then((proceed) => {
    if (!proceed) return;
    clearConversation();
    pendingPatch = null;
    sendError = '';
    render();
  });
}

function buildInputRow() {
  const row = el('div', { class: 'ai-chat-input-row' });
  const textarea = el('textarea', {
    class: 'ai-chat-input',
    rows: 2,
    placeholder: 'Ask a question or request a change…',
    disabled: sending,
    onInput: (e) => { draftMessage = e.target.value; },
    onKeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
  });
  textarea.value = draftMessage;
  row.appendChild(attachSpeechToTextarea(textarea));
  row.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary ai-chat-send-btn', text: sending ? '…' : 'Send', disabled: sending,
    onClick: send,
  }));
  return row;
}

async function send() {
  const text = draftMessage.trim();
  if (!text || sending) return;

  const turnsBefore = getConversationTurns();
  const prompt = buildConversationPrompt({ turns: turnsBefore, newMessage: text, project: store.getState() });
  appendConversationTurn(createTurn('user', text));
  draftMessage = '';
  sending = true;
  sendError = '';
  render();

  const result = await sendPromptAutomatic({ prompt });
  sending = false;

  if (!result.ok) {
    sendError = result.error;
    render();
    return;
  }

  const { message, patch } = extractConversationReply(result.text);
  const turns = appendConversationTurn(createTurn('ai', message));
  if (patch) pendingPatch = { turnId: turns[turns.length - 1].id, patch };
  render();
}
