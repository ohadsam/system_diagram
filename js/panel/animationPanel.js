// Right slide-in "Diagram Animation" panel — build/edit the ordered reveal
// sequence played back by core/animationPlayback.js (see canvas.js's
// animation actions and docs/ARCHITECTURE.md's "Diagram Animation"
// section). Structurally mirrors panel/outlinePanel.js: same
// rerenderPreservingUiState + data-focus-key mechanism for the "add more"
// search box, same own store subscription rather than living inside
// canvas.js's render().
import * as store from '../core/store.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import { selectInput, numberInput } from '../utils/formControls.js';
import {
  getAnimationSteps, addAnimationStep, removeAnimationStep, reorderAnimationStep,
  updateAnimationStepSettings, setAnimationSteps, startAnimationPlayback,
} from '../canvas/canvas.js';
import { exportAnimation, parseAnimationFile } from '../io/exportAnimation.js';
import { pickJSONFile } from '../io/fileIO.js';
import { confirmAction } from '../modals/confirmModal.js';
import { showToast } from '../utils/toast.js';
import { ANIMATION_REVEAL_MODES } from '../core/project.js';

let rootEl = null;
let isOpen = false;
let searchQuery = '';
let unsubChange = null;

export function initAnimationPanel(root) {
  rootEl = root;
  rootEl.classList.add('animation-panel');
}

export function toggleAnimationPanel() {
  if (isOpen) close();
  else open();
}

function open() {
  isOpen = true;
  rootEl.classList.add('open');
  unsubChange = store.subscribe('change', render);
  render();
}

export function close() {
  isOpen = false;
  rootEl.classList.remove('open');
  unsubChange?.();
  unsubChange = null;
}

function nodeLabel(n) {
  return n.text || n.defId || 'Component';
}

function edgeLabel(e, nodesById) {
  if (e.label) return e.label;
  const from = nodesById.get(e.from);
  const to = nodesById.get(e.to);
  return `${from ? nodeLabel(from) : '?'} → ${to ? nodeLabel(to) : '?'}`;
}

function labelFor(step, state, nodesById) {
  if (step.targetType === 'node') {
    const n = nodesById.get(step.targetId);
    return n ? nodeLabel(n) : null;
  }
  const e = state.edges.find((x) => x.id === step.targetId);
  return e ? edgeLabel(e, nodesById) : null;
}

function render() {
  if (!rootEl || !isOpen) return;
  rerenderPreservingUiState(rootEl, buildContents, '.animation-body');
}

function buildContents() {
  clear(rootEl);
  const state = store.getState();
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const steps = getAnimationSteps();

  const header = el('div', { class: 'animation-header' });
  header.appendChild(el('h2', { text: 'Diagram Animation' }));
  header.appendChild(el('button', { type: 'button', class: 'animation-close', 'aria-label': 'Close animation panel', text: '✕', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'animation-body' });

  const playBtn = el('button', {
    type: 'button',
    class: 'btn btn-primary animation-play-btn',
    text: '▶️ Play Animation',
    disabled: steps.length === 0,
    onClick: () => { close(); startAnimationPlayback(); },
  });
  body.appendChild(playBtn);
  if (!steps.length) {
    body.appendChild(el('p', { class: 'animation-empty-hint', text: 'Add at least one component or connector below to build an animation.' }));
  }

  const ioRow = el('div', { class: 'animation-io-row' });
  ioRow.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: '⬇️ Export Animation',
    disabled: steps.length === 0,
    onClick: () => {
      const edgesById = new Map(state.edges.map((e) => [e.id, e]));
      exportAnimation(steps, state.name, nodesById, edgesById);
    },
  }));
  ioRow.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: '⬆️ Import Animation',
    onClick: async () => {
      const text = await pickJSONFile();
      if (!text) return;
      const existingNodeIds = new Set(store.getState().nodes.map((n) => n.id));
      const existingEdgeIds = new Set(store.getState().edges.map((e) => e.id));
      const result = parseAnimationFile(text, existingNodeIds, existingEdgeIds);
      if (!result.ok) { showToast(`Could not import: ${result.error}`, 'error'); return; }
      if (getAnimationSteps().length) {
        const proceed = await confirmAction({
          title: 'Replace current animation?',
          message: 'Importing replaces this diagram\'s current animation sequence entirely. This can\'t be undone with Ctrl/Cmd+Z.',
          confirmLabel: 'Replace',
        });
        if (!proceed) return;
      }
      setAnimationSteps(result.steps);
      showToast(
        result.skippedCount
          ? `Imported ${result.appliedCount} step${result.appliedCount === 1 ? '' : 's'} — ${result.skippedCount} skipped (not on this diagram).`
          : `Imported ${result.appliedCount} step${result.appliedCount === 1 ? '' : 's'}.`,
        'success',
      );
    },
  }));
  body.appendChild(ioRow);

  body.appendChild(buildInAnimationSection(steps, state, nodesById));
  body.appendChild(buildAddMoreSection(steps, state, nodesById));

  rootEl.appendChild(body);
}

function buildInAnimationSection(steps, state, nodesById) {
  const section = el('div', { class: 'animation-section' });
  section.appendChild(el('h3', { text: `In animation (${steps.length})` }));
  if (!steps.length) return section;

  const list = el('div', { class: 'animation-step-list' });
  steps.forEach((step, index) => {
    const label = labelFor(step, state, nodesById);
    if (label == null) return; // orphaned reference — validateProject would have already dropped it on load; defensive only
    const row = el('div', { class: 'animation-step-row' });
    row.appendChild(el('span', { class: 'animation-step-order', text: String(index + 1) }));
    row.appendChild(el('span', { class: 'animation-step-icon', text: step.targetType === 'node' ? '🔲' : '➔', 'aria-hidden': 'true' }));
    row.appendChild(el('span', { class: 'animation-step-label', text: label }));

    const controls = el('div', { class: 'animation-step-controls' });
    controls.appendChild(selectInput(
      ANIMATION_REVEAL_MODES,
      step.revealMode,
      (v) => updateAnimationStepSettings(step.id, { revealMode: v }),
      { auto: 'Auto', click: 'Click' },
    ));
    if (step.revealMode === 'auto') {
      controls.appendChild(numberInput(
        step.delayMs / 1000,
        0.5, 60, 0.5,
        (v) => updateAnimationStepSettings(step.id, { delayMs: Math.max(500, Math.round(v * 1000)) }),
        { class: 'animation-step-delay', title: 'Seconds before this step reveals automatically' },
      ));
    }
    row.appendChild(controls);

    const moveUp = el('button', { type: 'button', class: 'animation-step-move', 'aria-label': 'Move earlier', text: '▲', disabled: index === 0, onClick: () => reorderAnimationStep(step.id, -1) });
    const moveDown = el('button', { type: 'button', class: 'animation-step-move', 'aria-label': 'Move later', text: '▼', disabled: index === steps.length - 1, onClick: () => reorderAnimationStep(step.id, 1) });
    row.appendChild(moveUp);
    row.appendChild(moveDown);
    row.appendChild(el('button', { type: 'button', class: 'animation-step-remove', 'aria-label': `Remove ${label} from animation`, text: '✕', onClick: () => removeAnimationStep(step.id) }));
    list.appendChild(row);
  });
  section.appendChild(list);
  return section;
}

function buildAddMoreSection(steps, state, nodesById) {
  const inAnimation = new Set(steps.map((s) => `${s.targetType}:${s.targetId}`));
  const q = searchQuery.trim().toLowerCase();

  const section = el('div', { class: 'animation-section' });
  section.appendChild(el('h3', { text: 'Add more' }));

  const search = el('input', {
    type: 'search',
    class: 'animation-search',
    placeholder: 'Search components & connectors…',
    value: searchQuery,
    'data-focus-key': 'animation-search',
    onInput: (e) => { searchQuery = e.target.value; render(); },
  });
  section.appendChild(search);

  const candidateNodes = state.nodes.filter((n) => !inAnimation.has(`node:${n.id}`) && (!q || nodeLabel(n).toLowerCase().includes(q)));
  const candidateEdges = state.edges.filter((e) => !inAnimation.has(`edge:${e.id}`) && (!q || edgeLabel(e, nodesById).toLowerCase().includes(q)));

  const list = el('div', { class: 'animation-add-list' });
  for (const n of candidateNodes) {
    list.appendChild(buildAddRow('🔲', nodeLabel(n), () => addAnimationStep('node', n.id)));
  }
  for (const e of candidateEdges) {
    list.appendChild(buildAddRow('➔', edgeLabel(e, nodesById), () => addAnimationStep('edge', e.id)));
  }
  if (!candidateNodes.length && !candidateEdges.length) {
    list.appendChild(el('p', { class: 'animation-empty-hint', text: q ? 'No matches.' : 'Everything on the canvas is already in the animation.' }));
  }
  section.appendChild(list);
  return section;
}

function buildAddRow(icon, label, onAdd) {
  const row = el('div', { class: 'animation-add-row' });
  row.appendChild(el('span', { class: 'animation-step-icon', text: icon, 'aria-hidden': 'true' }));
  row.appendChild(el('span', { class: 'animation-step-label', text: label }));
  row.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '+ Add', onClick: onAdd }));
  return row;
}
