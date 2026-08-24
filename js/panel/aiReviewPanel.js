// Right slide-in "AI Design Review" panel — see docs/SPEC.md 4.12 for the
// full explanation of why this is a "prepare & hand off" flow rather than
// a live API integration (no mainstream LLM offers key-free API access,
// and scraping Google's embedded AI search results is neither feasible
// from a static page nor allowed). Nothing here is persisted across a
// reload — it's a working scratch pad for one review session.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { nextId } from '../core/id.js';
import { AI_PROVIDERS, buildReviewPrompt } from '../io/aiReview.js';
import { exportPNG, captureDiagramCanvas } from '../io/exportImage.js';
import { showToast } from '../utils/toast.js';

let rootEl = null;
let isOpen = false;
let specFileName = '';
let specText = '';
let promptOverride = null;
let savedReviews = [];
let lastProjectId = null;

export function initAiReviewPanel(root) {
  rootEl = root;
  rootEl.classList.add('ai-review-panel');
  lastProjectId = store.getState().id;

  // Only react when the *active project itself* changes (New/Load/Duplicate/
  // restore), not on every node/edge edit — a scratch pad prepared for one
  // project shouldn't silently carry over to a different one, but we also
  // don't want to fight the user's typing or re-render on every drag frame.
  store.subscribe('change', () => {
    const id = store.getState().id;
    if (id === lastProjectId) return;
    lastProjectId = id;
    specFileName = '';
    specText = '';
    promptOverride = null;
    savedReviews = [];
    if (isOpen) render();
  });
}

export function toggleAiReviewPanel() {
  if (isOpen) close();
  else open();
}

function open() {
  isOpen = true;
  rootEl.classList.add('open');
  render();
}

export function close() {
  isOpen = false;
  rootEl.classList.remove('open');
}

function currentPrompt() {
  if (promptOverride !== null) return promptOverride;
  const state = store.getState();
  const componentNames = [...new Set(state.nodes.map((n) => n.text).filter(Boolean))];
  return buildReviewPrompt({
    projectName: state.name,
    nodeCount: state.nodes.length,
    edgeCount: state.edges.length,
    componentNames,
    specText,
    hasSequenceDiagram: state.nodes.some((n) => n.shape === 'lifeline'),
  });
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
  if (copied) {
    showToast(`Prompt copied — opened ${provider.name}. Attach the diagram image, paste, and send.`, 'success', 3200);
  }
}

async function downloadImage() {
  const result = await exportPNG(store.getState().name);
  if (!result.ok) showToast(result.error, 'error');
}

async function copyImageToClipboard() {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    showToast("This browser can't copy images — use Download PNG instead.", 'error');
    return;
  }
  const canvas = await captureDiagramCanvas();
  if (!canvas) {
    showToast('Nothing to export yet — add some components first.', 'error');
    return;
  }
  canvas.toBlob(async (blob) => {
    if (!blob) { showToast('Copy failed — use Download PNG instead.', 'error'); return; }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Diagram image copied — paste it into your AI chat.', 'success');
    } catch {
      showToast('Copy failed — use Download PNG instead.', 'error');
    }
  }, 'image/png');
}

function render() {
  clear(rootEl);

  const header = el('div', { class: 'details-header' });
  header.appendChild(el('span', { class: 'details-icon', text: '🤖' }));
  header.appendChild(el('span', { class: 'ai-review-title', text: 'AI Design Review' }));
  header.appendChild(el('button', { type: 'button', class: 'details-close', text: '✕', 'aria-label': 'Close AI design review', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'details-body ai-review-body' });

  body.appendChild(el('p', { class: 'modal-hint', text: 'No API key or setup needed: this prepares a review prompt and the diagram image, then opens your chosen AI\'s own website (where you\'re already signed in) so you can paste them in yourself. There\'s no automatic round trip — paste the AI\'s reply back below to keep it with your project.' }));

  body.appendChild(el('h3', { text: '1. Optional: attach a spec to compare against' }));
  body.appendChild(buildSpecAttach());

  body.appendChild(el('h3', { text: '2. Review prompt (editable)' }));
  const promptArea = el('textarea', {
    class: 'ai-review-prompt',
    rows: 8,
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
    onClick: () => { promptOverride = null; render(); },
  }));
  body.appendChild(promptActions);

  body.appendChild(el('h3', { text: '3. Get the diagram image' }));
  const imageActions = el('div', { class: 'field-row' });
  imageActions.appendChild(el('button', { type: 'button', class: 'btn btn-secondary', text: '🖼️ Download PNG', onClick: downloadImage }));
  imageActions.appendChild(el('button', { type: 'button', class: 'btn btn-secondary', text: '📋 Copy image', onClick: copyImageToClipboard }));
  body.appendChild(imageActions);

  body.appendChild(el('h3', { text: '4. Open your AI and paste both in' }));
  const providerGrid = el('div', { class: 'ai-provider-grid' });
  for (const provider of AI_PROVIDERS) {
    providerGrid.appendChild(el('button', {
      type: 'button', class: 'btn ai-provider-btn', onClick: () => openProvider(provider),
    }, [
      el('span', { class: 'ai-provider-icon', text: provider.icon, 'aria-hidden': 'true' }),
      el('span', { text: provider.name }),
    ]));
  }
  body.appendChild(providerGrid);

  body.appendChild(el('h3', { text: '5. Bring the response back here' }));
  body.appendChild(buildPasteBack());

  if (savedReviews.length) {
    body.appendChild(el('h3', { text: 'Saved this session' }));
    body.appendChild(buildSavedReviews());
  }

  rootEl.appendChild(body);
}

function buildSpecAttach() {
  const wrap = el('div', { class: 'ai-review-spec' });
  if (specFileName) {
    const row = el('div', { class: 'field-row' });
    row.appendChild(el('span', { class: 'ai-review-spec-name', text: `📎 ${specFileName}` }));
    row.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', text: '×', 'aria-label': 'Remove attached spec',
      onClick: () => { specFileName = ''; specText = ''; promptOverride = null; render(); },
    }));
    wrap.appendChild(row);
  } else {
    const input = el('input', { type: 'file', accept: '.txt,.md,.markdown,text/plain', 'aria-label': 'Attach a plain-text or Markdown spec file' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      specText = await file.text();
      specFileName = file.name;
      promptOverride = null;
      render();
    });
    wrap.appendChild(input);
    wrap.appendChild(el('p', { class: 'modal-hint', text: 'Plain text or Markdown only (.txt/.md) — its content is folded into the prompt above.' }));
  }
  return wrap;
}

function buildPasteBack() {
  const wrap = el('div', { class: 'ai-review-pasteback' });
  const textarea = el('textarea', { class: 'ai-review-response', rows: 6, placeholder: "Paste the AI's response here…" });
  wrap.appendChild(textarea);
  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: 'Save to this session',
    onClick: () => {
      if (!textarea.value.trim()) return;
      savedReviews = [{ id: nextId('review'), text: textarea.value.trim(), at: new Date() }, ...savedReviews];
      render();
    },
  }));
  return wrap;
}

function buildSavedReviews() {
  const wrap = el('div', { class: 'ai-review-saved-list' });
  for (const review of savedReviews) {
    const card = el('div', { class: 'ai-review-saved-card' });
    const cardHeader = el('div', { class: 'ai-review-saved-header' });
    cardHeader.appendChild(el('span', { text: review.at.toLocaleString() }));
    const cardActions = el('div', { class: 'field-row' });
    cardActions.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', text: '📋', 'aria-label': 'Copy this saved review',
      onClick: async () => { await navigator.clipboard.writeText(review.text); showToast('Copied.', 'success', 1200); },
    }));
    cardActions.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', text: '×', 'aria-label': 'Remove this saved review',
      onClick: () => { savedReviews = savedReviews.filter((r) => r.id !== review.id); render(); },
    }));
    cardHeader.appendChild(cardActions);
    card.appendChild(cardHeader);
    card.appendChild(el('p', { class: 'ai-review-saved-text', text: review.text }));
    wrap.appendChild(card);
  }
  return wrap;
}
