// Right slide-in "AI Design Review" panel — see docs/SPEC.md 4.12 for the
// full explanation of why "prepare & hand off" (copy a prompt, open the
// provider's own website, paste the reply back) is this app's default flow
// rather than a live API integration: no mainstream LLM offers anonymous,
// key-free API access, and this is a 100% static app with nowhere to keep
// a secret server-side. Settings -> AI Providers (io/aiProviderKeys.js)
// offers an opt-in "Direct API" mode for the providers that genuinely
// support a direct browser call with a user-supplied key — see
// io/aiDirectCall.js's header comment for exactly which ones and why —
// surfaced here via utils/aiProviderActions.js's shared "⚡ Send directly"
// button, always alongside (never instead of) the hand-off buttons below.
// Nothing here is persisted across a reload — it's a working scratch pad
// for one review session.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { nextId } from '../core/id.js';
import { buildReviewPrompt, buildExplainPrompt, buildSuggestionsPrompt, extractSuggestionsArray, buildSecurityPrompt, extractSecurityFindings } from '../io/aiReview.js';
import { exportPNG, captureDiagramCanvas } from '../io/exportImage.js';
import { showToast } from '../utils/toast.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';
import { isAutomaticSendConfigured } from '../io/aiProviderKeys.js';
import { findComponentMatch } from '../core/aiSuggestionMatch.js';
import { ALL_COMPONENTS } from '../data/index.js';
import { getCustomComponents } from '../io/customComponents.js';
import { addComponentAtCenter } from '../canvas/canvas.js';

/** The two "structured JSON response" modes, alongside the free-form
 * 'review'/'explain' prose modes — each asks for a strict array of tagged
 * items so the panel can render clickable/color-coded cards instead of a
 * block of text to read, and each shares the same send/parse/render/
 * manual-fallback machinery below (buildStructuredResultSection,
 * buildStructuredList) parameterized by this config rather than two
 * hand-copied implementations. 'suggest' and 'security' differ in real
 * ways this config captures: 'suggest' only exists as an *automatic*
 * round trip (availableOnly: true — see isAutomaticSendConfigured() below),
 * while 'security' is offered even hand-off-only, exactly like
 * Review/Explain, since a security review is worth a copy/paste the way
 * general suggestions arguably aren't. */
const STRUCTURED_MODES = {
  suggest: {
    label: '💡 Suggestions',
    buildPrompt: buildSuggestionsPrompt,
    extract: extractSuggestionsArray,
    availableOnly: true,
    groupField: 'category',
    groupOrder: ['component', 'pricing', 'improvement'],
    groupMeta: {
      component: { icon: '🧩', label: 'Suggested components' },
      pricing: { icon: '💰', label: 'Pricing notes' },
      improvement: { icon: '✨', label: 'Improvements' },
    },
    promptStepLabel: 'Suggestions prompt (editable)',
    sendStepLabel: 'Send — automatic with Direct/Local AI',
    resultStepLabel: 'Suggestions',
    resultPlaceholder: 'Suggestions appear here automatically after sending above — or paste a response here to parse it manually.',
    parseButtonLabel: '💡 Parse suggestions',
    autoParseErrorToast: "Got a response, but couldn't read it as a suggestions list — showing the raw reply below to parse manually.",
    renderItemAction: (item, groupKey, components) => {
      if (groupKey !== 'component') return null;
      const match = findComponentMatch(item.title, components);
      if (!match) return null;
      return el('button', {
        type: 'button', class: 'btn btn-secondary ai-suggestion-add-btn',
        text: `+ Add ${match.name}`,
        title: `Add "${match.name}" to the canvas`,
        onClick: () => { addComponentAtCenter(match.id); showToast(`Added ${match.name}.`, 'success', 1600); },
      });
    },
  },
  security: {
    label: '🛡️ Security',
    buildPrompt: buildSecurityPrompt,
    extract: extractSecurityFindings,
    availableOnly: false,
    groupField: 'severity',
    groupOrder: ['high', 'medium', 'low'],
    groupMeta: {
      high: { icon: '🔴', label: 'High severity' },
      medium: { icon: '🟠', label: 'Medium severity' },
      low: { icon: '🟡', label: 'Low severity' },
    },
    groupClassPrefix: 'ai-security-severity-',
    promptStepLabel: 'Security prompt (editable)',
    sendStepLabel: null, // uses the same hand-off/direct step 4 label as Review/Explain
    resultStepLabel: 'Security findings',
    resultPlaceholder: "Findings appear here automatically after a direct/local send — or paste a response here (including from a hand-off reply) to parse it manually.",
    parseButtonLabel: '🛡️ Parse findings',
    autoParseErrorToast: "Got a response, but couldn't read it as a findings list — showing the raw reply below to parse manually.",
    renderItemAction: () => null,
  },
};

let rootEl = null;
let isOpen = false;
let specFileName = '';
let specText = '';
let promptOverride = null;
let mode = 'review'; // 'review' | 'explain' | 'suggest' | 'security' — which prompt builder currentPrompt() uses
let savedReviews = [];
let lastProjectId = null;
let pasteBackTextarea = null; // set by buildPasteBack() each render; filled in by a successful direct send
let parsedFindings = null; // array of tagged items once a structured-mode response parses cleanly
let findingsRawText = ''; // raw response text kept for manual re-parsing when auto-parse fails

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
    parsedFindings = null;
    findingsRawText = '';
    if (isOpen) render();
  });
}

export function toggleAiReviewPanel() {
  if (isOpen) close();
  else open();
}

/** Entry point for the toolbar's "💡" auto-suggest-ready badge
 * (toolbar.js, fed by io/autoSuggestWatcher.js) — opens straight into
 * 'suggest' mode with the background run's already-parsed findings, so
 * clicking the badge shows the result immediately instead of re-running
 * the request the user already effectively triggered by editing the
 * diagram. */
export function openWithAutoSuggestions(findings) {
  mode = 'suggest';
  promptOverride = null;
  parsedFindings = findings;
  findingsRawText = '';
  open();
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
  const args = {
    projectName: state.name,
    nodeCount: state.nodes.length,
    edgeCount: state.edges.length,
    componentNames,
    specText,
    hasSequenceDiagram: state.nodes.some((n) => n.shape === 'lifeline'),
  };
  const structured = STRUCTURED_MODES[mode];
  if (structured) return structured.buildPrompt(args);
  return mode === 'explain' ? buildExplainPrompt(args) : buildReviewPrompt(args);
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

/** Same rendered canvas as copyImageToClipboard/downloadImage, but as a
 * bare base64 string (no `data:image/...;base64,` prefix) for a direct API
 * call's multimodal image content block — see utils/aiProviderActions.js. */
async function currentImageBase64() {
  const canvas = await captureDiagramCanvas();
  if (!canvas) return undefined;
  return canvas.toDataURL('image/png').split(',')[1];
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
  if (mode === 'suggest' && !isAutomaticSendConfigured()) {
    mode = 'review';
    promptOverride = null;
  }
  clear(rootEl);

  const structured = STRUCTURED_MODES[mode];

  const header = el('div', { class: 'details-header' });
  header.appendChild(el('span', { class: 'details-icon', text: '🤖' }));
  header.appendChild(el('span', { class: 'ai-review-title', text: 'AI Design Review' }));
  header.appendChild(el('button', { type: 'button', class: 'details-close', text: '✕', 'aria-label': 'Close AI design review', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'details-body ai-review-body' });

  body.appendChild(buildModeToggle());

  body.appendChild(el('p', { class: 'modal-hint', text: introHintFor(mode) }));

  body.appendChild(el('h3', { text: '1. Optional: attach a spec to compare against' }));
  body.appendChild(buildSpecAttach());

  body.appendChild(el('h3', { text: `2. ${structured ? structured.promptStepLabel : mode === 'explain' ? 'Explain prompt (editable)' : 'Review prompt (editable)'}` }));
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

  body.appendChild(el('h3', { text: `4. ${(structured && structured.sendStepLabel) || 'Open your AI and paste both in — or send it directly'}` }));
  body.appendChild(buildAiProviderActions({
    openProvider,
    getPrompt: currentPrompt,
    getImageBase64: currentImageBase64,
    onDirectResult: (text) => {
      if (!structured) { if (pasteBackTextarea) pasteBackTextarea.value = text; return; }
      findingsRawText = text;
      const result = structured.extract(text);
      if (result.ok) {
        parsedFindings = result.data;
      } else {
        showToast(structured.autoParseErrorToast, 'error', 4500);
      }
      render();
    },
  }));

  body.appendChild(el('h3', { text: `5. ${structured ? structured.resultStepLabel : 'Bring the response back here'}` }));
  body.appendChild(structured ? buildStructuredResultSection(structured) : buildPasteBack());

  if (!structured && savedReviews.length) {
    body.appendChild(el('h3', { text: 'Saved this session' }));
    body.appendChild(buildSavedReviews());
  }

  rootEl.appendChild(body);
}

function introHintFor(currentMode) {
  if (currentMode === 'suggest') {
    return 'Uses your configured Direct API provider or Local AI model to analyze this diagram and suggest specific missing components, pricing considerations, and other improvements — automatically, with no copy/paste round trip.';
  }
  if (currentMode === 'security') {
    return isAutomaticSendConfigured()
      ? 'Focused specifically on security risks (public exposure, missing encryption, unclear auth boundaries, secrets handling, missing audit logging) rather than general design advice. Sends automatically since Direct API mode or Local AI mode is set up — or use the hand-off buttons below, same as Review/Explain.'
      : 'Focused specifically on security risks (public exposure, missing encryption, unclear auth boundaries, secrets handling, missing audit logging) rather than general design advice — same hand-off flow as Review/Explain below.';
  }
  return 'No API key or setup needed: this prepares a prompt and the diagram image, then opens your chosen AI\'s own website (where you\'re already signed in) so you can paste them in yourself. There\'s no automatic round trip — paste the AI\'s reply back below to keep it with your project.';
}

/** "🔍 Review" vs "💬 Explain" — same prepare-and-hand-off mechanism
 * (currentPrompt() above just picks a different builder), just asking for
 * a plain-language walkthrough instead of critique/feedback. Switching
 * modes clears any hand-edited prompt override so the new mode's own
 * auto-generated prompt shows, rather than silently keeping stale text
 * from the other mode. */
function buildModeToggle() {
  const wrap = el('div', { class: 'ai-review-mode-toggle' });
  const modes = [['review', '🔍 Review'], ['explain', '💬 Explain'], ['security', STRUCTURED_MODES.security.label]];
  if (isAutomaticSendConfigured()) modes.push(['suggest', STRUCTURED_MODES.suggest.label]);
  for (const [value, label] of modes) {
    wrap.appendChild(el('button', {
      type: 'button',
      class: value === mode ? 'btn btn-primary' : 'btn',
      text: label,
      onClick: () => {
        if (mode === value) return;
        mode = value;
        promptOverride = null;
        parsedFindings = null;
        findingsRawText = '';
        render();
      },
    }));
  }
  return wrap;
}

/** Step 5 for either structured mode ('suggest' or 'security'): the
 * parsed cards once a response comes back clean, or a manual
 * paste-and-parse fallback (same shape as buildPasteBack() below) for
 * when auto-parse fails, or — for 'security', which is hand-off-capable
 * unlike 'suggest' — as the primary path when no automatic send is
 * configured at all. */
function buildStructuredResultSection(cfg) {
  const wrap = el('div', { class: 'ai-suggestions-wrap' });
  if (parsedFindings && parsedFindings.length) {
    wrap.appendChild(buildStructuredList(parsedFindings, cfg));
    wrap.appendChild(el('button', {
      type: 'button', class: 'btn-link', text: '🔄 Ask again',
      onClick: () => { parsedFindings = null; findingsRawText = ''; render(); },
    }));
    return wrap;
  }
  const textarea = el('textarea', {
    class: 'ai-review-response', rows: 6,
    placeholder: cfg.resultPlaceholder,
  });
  textarea.value = findingsRawText;
  wrap.appendChild(textarea);
  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: cfg.parseButtonLabel,
    onClick: () => {
      const result = cfg.extract(textarea.value);
      if (!result.ok) { showToast(result.error, 'error'); return; }
      parsedFindings = result.data;
      findingsRawText = textarea.value;
      render();
    },
  }));
  return wrap;
}

/** Renders parsed structured items grouped by `cfg.groupField`
 * ('category' for Suggestions, 'severity' for Security), each with
 * whatever `cfg.renderItemAction` returns — for Suggestions, a "+ Add"
 * button when a "component" item's title matches something in this app's
 * own library (io/aiSuggestionMatch.js), placed at the canvas center via
 * canvas.js#addComponentAtCenter (the same action a sidebar click uses,
 * since a suggestion isn't anchored to any one existing node the way
 * canvas/suggestions.js's post-placement banner is); Security has no
 * per-item action, just color-coded severity groups. */
function buildStructuredList(items, cfg) {
  const wrap = el('div', { class: 'ai-suggestions-list' });
  const components = cfg.groupField === 'category' ? [...ALL_COMPONENTS, ...getCustomComponents()] : null;
  for (const groupKey of cfg.groupOrder) {
    const group = items.filter((item) => item[cfg.groupField] === groupKey);
    if (!group.length) continue;
    const meta = cfg.groupMeta[groupKey];
    const groupClass = `ai-suggestions-group-title${cfg.groupClassPrefix ? ` ${cfg.groupClassPrefix}${groupKey}` : ''}`;
    wrap.appendChild(el('div', { class: groupClass, text: `${meta.icon} ${meta.label}` }));
    for (const item of group) {
      const row = el('div', { class: 'ai-suggestion-row' });
      const text = el('div', { class: 'ai-suggestion-text' });
      text.appendChild(el('div', { class: 'ai-suggestion-title', text: item.title }));
      if (item.detail) text.appendChild(el('div', { class: 'ai-suggestion-detail', text: item.detail }));
      row.appendChild(text);
      const action = cfg.renderItemAction(item, groupKey, components);
      if (action) row.appendChild(action);
      wrap.appendChild(row);
    }
  }
  return wrap;
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
  const textarea = el('textarea', { class: 'ai-review-response', rows: 6, placeholder: "Paste the AI's response here (or send it directly above)…" });
  pasteBackTextarea = textarea;
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

// Canvas-background right-click menu dispatches this to avoid a circular
// import (this file imports from canvas/canvas.js) — see canvas.js's
// openCanvasContextMenu and the sdb:open-* convention used throughout.
window.addEventListener('sdb:open-ai-review', () => toggleAiReviewPanel());
