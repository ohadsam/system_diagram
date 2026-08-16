// Right slide-in details panel: notes, labels, sub-components and (for
// "server with rows" nodes) rows — opened via a node's ⓘ button.
import * as store from '../core/store.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import { nextId } from '../core/id.js';
import { textInput, field, selectInput, checkbox } from '../utils/formControls.js';
import { LAYER_DATALIST_ID, ensureLayerDatalist, findLayerByName } from '../utils/layerDatalist.js';
import { SUBCOMPONENTS_DISPLAY_MODES } from '../core/project.js';
import { getReplicationInfoForNode } from '../canvas/canvas.js';
import { readJSON, writeJSON } from '../io/storage.js';

const SUBCOMPONENTS_DISPLAY_LABELS = { chips: 'Compact chips', full: 'Full list' };
const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 640;

let rootEl = null;
let currentNodeId = null;
let isCollapsed = false;
let resizeHandleEl = null;

export function initDetailsPanel(root) {
  rootEl = root;
  rootEl.classList.add('details-panel');
  ensureLayerDatalist();
  applyStoredWidth();
  initResizeHandle();

  window.addEventListener('sdb:open-details', (e) => open(e.detail.nodeId));

  // Full rebuild on every store change (see render()'s clear()+rebuild) would
  // otherwise steal focus from a field the user is typing into and reset
  // .details-body's scroll position on every keystroke — see
  // utils/dom.js#rerenderPreservingUiState.
  store.subscribe('change', () => {
    if (!currentNodeId) return;
    const node = store.getState().nodes.find((n) => n.id === currentNodeId);
    if (!node) close();
    else rerenderPreservingUiState(rootEl, () => render(node), '.details-body');
  });

  // Keep the panel in sync with the canvas's own selection instead of only
  // reacting to the explicit "open details" action: clicking empty canvas
  // (selection cleared) closes a stale panel instead of leaving it open on
  // whatever was previously selected, and selecting a different single node
  // switches the panel straight to it instead of continuing to show the old
  // one — either was confusing before, since selection changes never
  // reached this module at all. A multi/edge-only selection just closes the
  // panel (nothing single-node-specific left to show).
  store.subscribe('selection', (selection) => {
    if (!currentNodeId) return;
    if (selection.nodeIds.length === 1 && !selection.edgeIds.length) {
      if (selection.nodeIds[0] !== currentNodeId) open(selection.nodeIds[0]);
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
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  if (!node) return;
  isCollapsed = false;
  render(node);
  rootEl.classList.add('open');
}

export function close() {
  currentNodeId = null;
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

  body.appendChild(el('h3', { text: 'Labels' }));
  body.appendChild(renderLabels(node));

  body.appendChild(el('h3', { text: 'Sub-components' }));
  body.appendChild(renderSubComponents(node));

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
