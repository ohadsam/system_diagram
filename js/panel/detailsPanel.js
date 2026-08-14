// Right slide-in details panel: notes, labels, sub-components and (for
// "server with rows" nodes) rows — opened via a node's ⓘ button.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { nextId } from '../core/id.js';
import { textInput } from '../utils/formControls.js';
import { LAYER_DATALIST_ID, ensureLayerDatalist, findLayerByName } from '../utils/layerDatalist.js';

let rootEl = null;
let currentNodeId = null;

export function initDetailsPanel(root) {
  rootEl = root;
  rootEl.classList.add('details-panel');
  ensureLayerDatalist();

  window.addEventListener('sdb:open-details', (e) => open(e.detail.nodeId));
  store.subscribe('change', () => {
    if (!currentNodeId) return;
    const node = store.getState().nodes.find((n) => n.id === currentNodeId);
    if (!node) close();
    else render(node);
  });
}

function open(nodeId) {
  currentNodeId = nodeId;
  const node = store.getState().nodes.find((n) => n.id === nodeId);
  if (!node) return;
  render(node);
  rootEl.classList.add('open');
}

export function close() {
  currentNodeId = null;
  rootEl.classList.remove('open');
}

function updateNode(fn) {
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === currentNodeId);
    if (n) fn(n);
  });
}

function render(node) {
  clear(rootEl);

  const header = el('div', { class: 'details-header' });
  header.appendChild(el('span', { class: 'details-icon', text: node.icon || '📦' }));
  header.appendChild(textInput(node.text, (v) => updateNode((n) => { n.text = v; }), { class: 'details-title-input' }));
  header.appendChild(el('button', { type: 'button', class: 'details-close', text: '✕', 'aria-label': 'Close details', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'details-body' });

  body.appendChild(el('h3', { text: 'Notes' }));
  const notes = el('textarea', {
    class: 'details-notes',
    placeholder: 'Free-form notes about this component…',
    rows: 4,
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
  (node.subComponents || []).forEach((sc, idx) => {
    const row = el('div', { class: 'field-row subcomponent-row' });
    row.appendChild(textInput(sc.icon, (v) => updateNode((n) => { n.subComponents[idx].icon = v; }), { maxLength: 4, class: 'sub-icon-input', placeholder: '🔧' }));

    const nameInput = textInput(sc.name, (v) => updateNode((n) => { n.subComponents[idx].name = v; }), {
      placeholder: 'Name — try "Controller", "DAL", "React Hook"…',
      list: LAYER_DATALIST_ID,
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
    rowEl.appendChild(textInput(row, (v) => updateNode((n) => { n.rows[idx] = v; }), { placeholder: `Row ${idx + 1}` }));
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
