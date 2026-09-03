// Right slide-in details panel: notes, labels, sub-components and (for
// "server with rows" nodes) rows — opened via a node's ⓘ button. Also
// (separately — see `openEdge` below) shows a message/connector's label and
// notes when exactly one edge is selected, e.g. for annotating a
// sequence-diagram message with extra context.
import * as store from '../core/store.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import { nextId } from '../core/id.js';
import { textInput, field, selectInput, checkbox, numberInput } from '../utils/formControls.js';
import { formatMonthlyCost } from '../core/cost.js';
import { LAYER_DATALIST_ID, ensureLayerDatalist, findLayerByName } from '../utils/layerDatalist.js';
import { SUBCOMPONENTS_DISPLAY_MODES } from '../core/project.js';
import { getReplicationInfoForNode, computeMessageSequenceNumbers, attachSuggestedPatternAsMiniature } from '../canvas/canvas.js';
import { getUnattachedLayerSuggestions, getPatternSuggestionsForNode } from '../canvas/suggestions.js';
import { readJSON, writeJSON } from '../io/storage.js';
import { openGroupExplanationModal } from '../modals/groupExplanationModal.js';

const SUBCOMPONENTS_DISPLAY_LABELS = { chips: 'Compact chips', full: 'Full list' };
const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 640;

let rootEl = null;
let currentNodeId = null;
let currentEdgeId = null;
let isCollapsed = false;
let resizeHandleEl = null;
// Which curated sub-component suggestions are currently checked, keyed by
// name (suggestions have no id of their own on the node) — module-level
// rather than per-render state since render() fully rebuilds the DOM on
// every store change; cleared whenever a different node is opened.
let suggestionSelection = new Set();

export function initDetailsPanel(root) {
  rootEl = root;
  rootEl.classList.add('details-panel');
  ensureLayerDatalist();
  applyStoredWidth();
  initResizeHandle();

  window.addEventListener('sdb:open-details', (e) => open(e.detail.nodeId));
  window.addEventListener('sdb:open-edge-details', (e) => openEdge(e.detail.edgeId));

  // Full rebuild on every store change (see render()'s clear()+rebuild) would
  // otherwise steal focus from a field the user is typing into and reset
  // .details-body's scroll position on every keystroke — see
  // utils/dom.js#rerenderPreservingUiState.
  store.subscribe('change', () => {
    if (currentNodeId) {
      const node = store.getState().nodes.find((n) => n.id === currentNodeId);
      if (!node) close();
      else rerenderPreservingUiState(rootEl, () => render(node), '.details-body');
    } else if (currentEdgeId) {
      const edge = store.getState().edges.find((e) => e.id === currentEdgeId);
      if (!edge) close();
      else rerenderPreservingUiState(rootEl, () => renderEdgeDetails(edge), '.details-body');
    }
  });

  // Keep the panel in sync with the canvas's own selection instead of only
  // reacting to the explicit "open details" action: clicking empty canvas
  // (selection cleared) closes a stale panel instead of leaving it open on
  // whatever was previously selected, and selecting a different single node
  // switches the panel straight to it instead of continuing to show the old
  // one — either was confusing before, since selection changes never
  // reached this module at all. A single-edge selection opens the edge
  // (message) variant below; any other combination (multi-select, or a
  // mixed node+edge selection) just closes the panel.
  store.subscribe('selection', (selection) => {
    if (!currentNodeId && !currentEdgeId) return;
    if (selection.nodeIds.length === 1 && !selection.edgeIds.length) {
      if (selection.nodeIds[0] !== currentNodeId) open(selection.nodeIds[0]);
    } else if (selection.edgeIds.length === 1 && !selection.nodeIds.length) {
      if (selection.edgeIds[0] !== currentEdgeId) openEdge(selection.edgeIds[0]);
    } else {
      close();
    }
  });
}

function applyStoredWidth() {
  const saved = readJSON('detailsPanelWidth', null);
  if (typeof saved === 'number' && saved >= MIN_PANEL_WIDTH && saved <= MAX_PANEL_WIDTH) {
    rootEl.style.setProperty('--panel-width', `${saved}px`);
  }
}

/** Drag-to-resize handle on the panel's left edge — the panel otherwise had
 * no way to widen/narrow itself beyond the fixed --panel-width default.
 * Created once here but (re-)appended to rootEl at the end of every
 * render() call, since render() clear()s rootEl's entire contents on every
 * open/change — appending the *same* element back afterwards keeps its
 * listeners intact (unlike recreating it, which would need rewiring). */
function initResizeHandle() {
  const handle = el('div', { class: 'details-resize-handle', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize details panel', tabIndex: 0 });
  resizeHandleEl = handle;

  const onPointerMove = (e) => {
    const width = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, window.innerWidth - e.clientX));
    rootEl.style.setProperty('--panel-width', `${width}px`);
  };
  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.body.classList.remove('resizing-details-panel');
    const width = parseFloat(rootEl.style.getPropertyValue('--panel-width'));
    if (width) writeJSON('detailsPanelWidth', width);
  };
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    document.body.classList.add('resizing-details-panel');
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });
  // Keyboard equivalent for the drag handle, same step used elsewhere for
  // small nudges (e.g. resize handles have no separate keyboard path today,
  // but a `role="separator"` should still respond to arrow keys).
  handle.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const current = parseFloat(getComputedStyle(rootEl).getPropertyValue('--panel-width')) || 320;
    const delta = e.key === 'ArrowLeft' ? 16 : -16;
    const width = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, current + delta));
    rootEl.style.setProperty('--panel-width', `${width}px`);
    writeJSON('detailsPanelWidth', width);
  });
}

function open(nodeId) {
  currentNodeId = nodeId;
  currentEdgeId = null;
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  if (!node) return;
  isCollapsed = false;
  suggestionSelection = new Set();
  render(node);
  rootEl.classList.add('open');
}

function openEdge(edgeId) {
  currentEdgeId = edgeId;
  currentNodeId = null;
  const edge = store.getState().edges.find((e) => e.id === edgeId);
  if (!edge) return;
  isCollapsed = false;
  renderEdgeDetails(edge);
  rootEl.classList.add('open');
}

export function close() {
  currentNodeId = null;
  currentEdgeId = null;
  isCollapsed = false;
  rootEl.classList.remove('open', 'collapsed');
}

function toggleCollapsed() {
  isCollapsed = !isCollapsed;
  rootEl.classList.toggle('collapsed', isCollapsed);
}

function updateNode(fn) {
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === currentNodeId);
    if (n) fn(n);
  });
}

function updateEdge(fn) {
  store.dispatch((draft) => {
    const e = draft.edges.find((x) => x.id === currentEdgeId);
    if (e) fn(e);
  });
}

/** Edge (message/connector) variant of render() above — deliberately a
 * separate, independent path rather than folded into the node-centric
 * render() (large, heavily tested, and every field there is node-only) —
 * label, a free-text notes field (new — edges had no notes before this),
 * and, when both endpoints are sequence-diagram lifelines, the message's
 * auto-computed order (see canvas/canvas.js#computeMessageSequenceNumbers,
 * the same numbering the small badge on the canvas itself shows). */
function renderEdgeDetails(edge) {
  clear(rootEl);
  rootEl.classList.toggle('collapsed', isCollapsed);

  const header = el('div', { class: 'details-header' });
  header.appendChild(el('span', { class: 'details-icon', text: '↔️' }));
  header.appendChild(textInput(edge.label, (v) => updateEdge((e) => { e.label = v; }), { class: 'details-title-input', placeholder: 'Message label', 'data-focus-key': 'edge-label' }));
  header.appendChild(el('button', {
    type: 'button',
    class: 'details-collapse-toggle',
    text: isCollapsed ? '‹' : '›',
    title: isCollapsed ? 'Expand details' : 'Collapse details',
    'aria-label': isCollapsed ? 'Expand details panel' : 'Collapse details panel',
    onClick: toggleCollapsed,
  }));
  header.appendChild(el('button', { type: 'button', class: 'details-close', text: '✕', 'aria-label': 'Close details', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'details-body' });

  const state = store.getState();
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const fromNode = nodesById.get(edge.from);
  const toNode = nodesById.get(edge.to);
  if (fromNode?.shape === 'lifeline' && toNode?.shape === 'lifeline') {
    const seq = computeMessageSequenceNumbers(state.edges, nodesById).get(edge.id);
    if (seq != null) body.appendChild(el('p', { class: 'modal-hint', text: `Message ${seq} in this sequence diagram (${fromNode.text} → ${toNode.text}).` }));
  }

  body.appendChild(el('h3', { text: 'Notes' }));
  const notes = el('textarea', {
    class: 'details-notes',
    placeholder: 'Free-form notes about this message/connector…',
    rows: 4,
    'data-focus-key': 'edge-notes',
    onInput: (e) => updateEdge((ed) => { ed.notes = e.target.value; }),
  });
  notes.value = edge.notes || '';
  body.appendChild(notes);

  rootEl.appendChild(body);
  rootEl.appendChild(resizeHandleEl);
}

function render(node) {
  clear(rootEl);
  rootEl.classList.toggle('collapsed', isCollapsed);

  const header = el('div', { class: 'details-header' });
  header.appendChild(el('span', { class: 'details-icon', text: node.icon || '📦' }));
  header.appendChild(textInput(node.text, (v) => updateNode((n) => { n.text = v; }), { class: 'details-title-input', 'data-focus-key': 'title' }));
  header.appendChild(el('button', {
    type: 'button',
    class: 'details-collapse-toggle',
    text: isCollapsed ? '‹' : '›',
    title: isCollapsed ? 'Expand details' : 'Collapse details',
    'aria-label': isCollapsed ? 'Expand details panel' : 'Collapse details panel',
    onClick: toggleCollapsed,
  }));
  header.appendChild(el('button', { type: 'button', class: 'details-close', text: '✕', 'aria-label': 'Close details', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'details-body' });

  const replicationInfo = getReplicationInfoForNode(node.id);
  if (replicationInfo) {
    body.appendChild(el('h3', { text: 'Replication' }));
    body.appendChild(renderReplicationSection(node, replicationInfo));
  }

  // Only set on a node created by instantiating a library pattern/template
  // (see canvas.js#instantiatePatternAtPoint) — a hand-built component has
  // nothing to look this up from, so this section simply doesn't appear.
  if (node.patternInstanceId) {
    body.appendChild(el('h3', { text: 'About this diagram' }));
    body.appendChild(el('div', { class: 'details-pattern-explanation' }, [
      el('p', { class: 'modal-hint', text: 'This component is part of a built-in library pattern.' }),
      el('button', {
        type: 'button', class: 'btn btn-secondary', text: '📖 Explain This Diagram',
        onClick: () => openGroupExplanationModal(node.patternInstanceId),
      }),
    ]));
  }

  body.appendChild(el('h3', { text: 'Notes' }));
  const notes = el('textarea', {
    class: 'details-notes',
    placeholder: 'Free-form notes about this component…',
    rows: 4,
    'data-focus-key': 'notes',
    onInput: (e) => updateNode((n) => { n.notes = e.target.value; }),
  });
  notes.value = node.notes || '';
  body.appendChild(notes);

  body.appendChild(el('h3', { text: 'Estimated Monthly Cost' }));
  body.appendChild(renderMonthlyCost(node));

  body.appendChild(el('h3', { text: 'Labels' }));
  body.appendChild(renderLabels(node));

  body.appendChild(el('h3', { text: 'Sub-components' }));
  body.appendChild(renderSubComponents(node));

  const suggestions = renderSuggestedSubComponents(node);
  if (suggestions) {
    body.appendChild(el('h3', { text: '💡 Suggested sub-components' }));
    body.appendChild(suggestions);
  }

  const patternSuggestions = renderSuggestedPatterns(node);
  if (patternSuggestions) {
    body.appendChild(el('h3', { text: '🔀 Suggested flow diagrams' }));
    body.appendChild(patternSuggestions);
  }

  if (node.shape === 'rows') {
    body.appendChild(el('h3', { text: 'Rows' }));
    body.appendChild(renderRows(node));
  }

  rootEl.appendChild(body);
  rootEl.appendChild(resizeHandleEl);
}

function renderReplicationSection(node, { side }) {
  const wrap = el('div', { class: 'details-replication' });
  wrap.appendChild(el('p', { class: 'modal-hint', text: `Part of a live replication pair, side ${side.toUpperCase()} — components added here auto-mirror to the other side.` }));
  wrap.appendChild(checkbox(
    node.replicationExcluded === true,
    (v) => updateNode((n) => { n.replicationExcluded = v; }),
    'Exclude this component from replication mirroring',
  ));
  return wrap;
}

function renderMonthlyCost(node) {
  const wrap = el('div', { class: 'details-cost' });
  const row = el('div', { class: 'field-row' });
  row.appendChild(el('span', { class: 'details-cost-prefix', text: '$', 'aria-hidden': 'true' }));
  row.appendChild(numberInput(node.monthlyCost ?? '', 0, null, 0.01, (v) => {
    updateNode((n) => { n.monthlyCost = Number.isFinite(v) ? Math.max(0, v) : null; });
  }, { placeholder: 'Not estimated', 'aria-label': 'Estimated monthly cost in US dollars' }));
  row.appendChild(el('span', { class: 'details-cost-suffix', text: '/ mo' }));
  if (Number.isFinite(node.monthlyCost)) {
    row.appendChild(el('button', {
      type: 'button', class: 'btn-link', text: 'Clear',
      onClick: () => updateNode((n) => { n.monthlyCost = null; }),
    }));
  }
  wrap.appendChild(row);
  return wrap;
}

function renderLabels(node) {
  const wrap = el('div', { class: 'details-labels' });
  const chips = el('div', { class: 'label-chips' });
  (node.labels || []).forEach((label, idx) => {
    const chip = el('span', { class: 'label-chip' });
    chip.appendChild(el('span', { text: label }));
    chip.appendChild(el('button', {
      type: 'button', text: '×', 'aria-label': `Remove label ${label}`,
      onClick: () => updateNode((n) => n.labels.splice(idx, 1)),
    }));
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);

  const addRow = el('div', { class: 'field-row' });
  const input = textInput('', () => {}, { placeholder: 'Add a label and press Enter' });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const value = input.value.trim();
      updateNode((n) => { n.labels = [...(n.labels || []), value]; });
      input.value = '';
    }
  });
  addRow.appendChild(input);
  wrap.appendChild(addRow);
  return wrap;
}

function renderSubComponents(node) {
  const wrap = el('div', { class: 'subcomponent-editor' });
  wrap.appendChild(field('On the canvas, show as', selectInput(
    SUBCOMPONENTS_DISPLAY_MODES,
    node.subComponentsDisplay || 'chips',
    (v) => updateNode((n) => { n.subComponentsDisplay = v; }),
    SUBCOMPONENTS_DISPLAY_LABELS,
  )));
  (node.subComponents || []).forEach((sc, idx) => {
    const row = el('div', { class: 'field-row subcomponent-row' });
    // Keyed by the sub-component's own stable id (not idx) so focus survives
    // even if another sub-component row is added/removed while this one is
    // still being typed into.
    row.appendChild(textInput(sc.icon, (v) => updateNode((n) => { n.subComponents[idx].icon = v; }), { maxLength: 4, class: 'sub-icon-input', placeholder: '🔧', 'data-focus-key': `sc-icon-${sc.id}` }));

    const nameInput = textInput(sc.name, (v) => updateNode((n) => { n.subComponents[idx].name = v; }), {
      placeholder: 'Name — try "Controller", "DAL", "React Hook"…',
      list: LAYER_DATALIST_ID,
      'data-focus-key': `sc-name-${sc.id}`,
    });
    nameInput.addEventListener('change', () => {
      const match = findLayerByName(nameInput.value);
      if (!match) return;
      updateNode((n) => {
        const item = n.subComponents[idx];
        if (item && !item.icon) item.icon = match.icon;
      });
    });
    row.appendChild(nameInput);

    row.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', text: '×', 'aria-label': 'Remove sub-component',
      onClick: () => updateNode((n) => n.subComponents.splice(idx, 1)),
    }));
    wrap.appendChild(row);
  });
  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-secondary', text: '+ Add sub-component',
    onClick: () => updateNode((n) => { n.subComponents = [...(n.subComponents || []), { id: nextId('sc'), name: '', icon: '' }]; }),
  }));
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'Tip: names matching the Layers & Roles library (Controller, Service, DAL, React Hook, …) auto-fill their icon.' }));
  return wrap;
}

/** The same curated "Common building blocks" suggestions Smart Suggestions
 * offers right after placement (canvas/suggestions.js#showSuggestionsFor),
 * but revisitable any time from the details panel — the placement-time
 * banner is easy to miss/dismiss, and a node loaded from a saved project
 * never saw it in this session at all. Lets you check off any number and
 * add them all in one dispatch, instead of one click per suggestion.
 * Returns null (renders nothing) once every curated suggestion is already
 * attached. */
function renderSuggestedSubComponents(node) {
  const suggestions = getUnattachedLayerSuggestions(node);
  // Drop a checked name no longer being suggested — attached some other
  // way (the manual "+ Add sub-component" field, for instance) while this
  // checkbox sat checked — so a stale name can't render as still-checked
  // or sneak into a later "Add selected" click.
  for (const name of [...suggestionSelection]) {
    if (!suggestions.some((rel) => rel.name === name)) suggestionSelection.delete(name);
  }
  if (!suggestions.length) return null;

  const wrap = el('div', { class: 'suggested-subcomponents' });
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'Common building blocks for this component, hand-picked — not automatic. Select one or more to add.' }));

  const list = el('div', { class: 'suggested-subcomponents-list' });
  const labelFor = () => (suggestionSelection.size ? `+ Add selected (${suggestionSelection.size})` : '+ Add selected');
  const addBtn = el('button', {
    type: 'button',
    class: 'btn btn-secondary btn-sm',
    text: labelFor(),
    disabled: suggestionSelection.size === 0,
    onClick: () => {
      const toAdd = suggestions.filter((rel) => suggestionSelection.has(rel.name));
      if (!toAdd.length) return;
      updateNode((n) => {
        n.subComponents = [...(n.subComponents || []), ...toAdd.map((rel) => ({ id: nextId('sc'), name: rel.name, icon: rel.icon }))];
      });
      suggestionSelection.clear();
    },
  });

  for (const rel of suggestions) {
    const row = el('label', { class: 'suggested-subcomponent-row' });
    row.appendChild(el('input', {
      type: 'checkbox',
      checked: suggestionSelection.has(rel.name),
      'aria-label': `Select ${rel.name}`,
      onChange: (e) => {
        if (e.target.checked) suggestionSelection.add(rel.name);
        else suggestionSelection.delete(rel.name);
        addBtn.disabled = suggestionSelection.size === 0;
        addBtn.textContent = labelFor();
      },
    }));
    row.appendChild(el('span', { class: 'suggested-subcomponent-icon', text: rel.icon, 'aria-hidden': 'true' }));
    row.appendChild(el('span', { class: 'suggested-subcomponent-name', text: rel.name }));
    list.appendChild(row);
  }
  wrap.appendChild(list);
  wrap.appendChild(addBtn);
  return wrap;
}

/** The same curated "sequence diagrams for X" suggestions Smart
 * Suggestions offers right after placement, but revisitable any time —
 * same rationale as renderSuggestedSubComponents above. Unlike a
 * sub-component, adding a flow diagram again isn't "already attached" —
 * there's nothing to filter out, so every curated template always shows
 * with its own one-click "+ Add" button instead of a shared checkbox
 * list. Returns null (renders nothing) when this component has no curated
 * `relatedPatterns`. */
function renderSuggestedPatterns(node) {
  const patterns = getPatternSuggestionsForNode(node);
  if (!patterns.length) return null;

  const wrap = el('div', { class: 'suggested-patterns' });
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'Common flow diagrams for this component, hand-picked — not automatic. Adds the whole diagram next to this component.' }));

  const list = el('div', { class: 'suggested-patterns-list' });
  for (const pat of patterns) {
    const row = el('div', { class: 'suggested-pattern-row' });
    row.appendChild(el('span', { class: 'suggested-pattern-icon', text: pat.icon, 'aria-hidden': 'true' }));
    row.appendChild(el('span', { class: 'suggested-pattern-name', text: pat.name }));
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-secondary btn-sm',
      text: '+ Add',
      title: `Add the "${pat.name}" flow diagram as a small indicator on this component (click 🔍 to view it full size)`,
      onClick: () => attachSuggestedPatternAsMiniature(pat.id, node.id),
    }));
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

function renderRows(node) {
  const wrap = el('div', { class: 'subcomponent-editor' });
  (node.rows || []).forEach((row, idx) => {
    const rowEl = el('div', { class: 'field-row subcomponent-row' });
    rowEl.appendChild(textInput(row, (v) => updateNode((n) => { n.rows[idx] = v; }), { placeholder: `Row ${idx + 1}`, 'data-focus-key': `row-${idx}` }));
    rowEl.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon', text: '×', 'aria-label': 'Remove row',
      onClick: () => updateNode((n) => n.rows.splice(idx, 1)),
    }));
    wrap.appendChild(rowEl);
  });
  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-secondary', text: '+ Add row',
    onClick: () => updateNode((n) => { n.rows = [...(n.rows || []), `Row ${n.rows.length + 1}`]; }),
  }));
  return wrap;
}
