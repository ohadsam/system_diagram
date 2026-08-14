// Pure(ish) DOM builder/updater for a single node. Drag/resize/connect
// gestures are wired by nodeInteractions.js; simple clicks (select, rename,
// row edit, info/menu buttons) are wired here and dispatch to the store
// directly since they involve no pointer-move gesture state.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';

let handlers = {
  onSelect: () => {},
  onOpenDetails: () => {},
  onContextMenu: () => {},
};

export function configureNodeHandlers(next) {
  handlers = { ...handlers, ...next };
}

const SIDES = ['top', 'right', 'bottom', 'left'];
const HANDLES = ['nw', 'ne', 'se', 'sw'];

export function createNodeEl(node) {
  const root = el('div', {
    class: 'node',
    'data-node-id': node.id,
    'data-shape': node.shape,
    tabIndex: 0,
    role: 'group',
    'aria-label': node.text || 'component',
  });

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.conn-point, .resize-handle, .node-info-btn, .node-menu-btn, .row-item, .node-add-row')) return;
    handlers.onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey, e);
  });
  root.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handlers.onSelect(node.id, false);
    handlers.onContextMenu(node.id, e);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlers.onOpenDetails(node.id);
  });

  const body = el('div', { class: 'node-body' });
  root.appendChild(body);

  const badge = el('span', { class: 'node-badge', title: 'Has notes, labels or sub-components' }, '●');
  root.appendChild(badge);

  const points = el('div', { class: 'node-connection-points' });
  for (const side of SIDES) {
    const point = el('button', {
      class: `conn-point conn-${side}`,
      type: 'button',
      'data-side': side,
      'aria-label': `Draw connector from ${side}`,
      title: 'Drag to connect',
    });
    points.appendChild(point);
  }
  root.appendChild(points);

  const handlesWrap = el('div', { class: 'node-resize-handles' });
  for (const h of HANDLES) {
    handlesWrap.appendChild(el('button', { class: `resize-handle rh-${h}`, type: 'button', 'data-handle': h, 'aria-label': `Resize ${h}`, tabIndex: -1 }));
  }
  root.appendChild(handlesWrap);

  const infoBtn = el('button', {
    class: 'node-info-btn',
    type: 'button',
    title: 'Open details (notes, labels, sub-components)',
    'aria-label': 'Open details',
    text: 'ⓘ',
    onClick: (e) => {
      e.stopPropagation();
      handlers.onOpenDetails(node.id);
    },
  });
  root.appendChild(infoBtn);

  const menuBtn = el('button', {
    class: 'node-menu-btn',
    type: 'button',
    title: 'Edit & more options',
    'aria-label': 'Edit and more options',
    text: '⋮',
    onClick: (e) => {
      e.stopPropagation();
      handlers.onSelect(node.id, false);
      handlers.onContextMenu(node.id, e, true);
    },
  });
  root.appendChild(menuBtn);

  updateNodeEl(root, node, { selected: false });
  return root;
}

export function updateNodeEl(rootEl, node, { selected = false } = {}) {
  rootEl.dataset.shape = node.shape;
  rootEl.style.left = `${node.x}px`;
  rootEl.style.top = `${node.y}px`;
  rootEl.style.width = `${node.w}px`;
  rootEl.style.height = `${node.h}px`;
  rootEl.style.zIndex = String(node.zIndex || 1);
  rootEl.classList.toggle('selected', !!selected);

  const hasInfo = !!(node.notes?.trim() || node.labels?.length || (node.subComponents?.length && node.shape !== 'rows'));
  rootEl.classList.toggle('has-info', hasInfo);
  rootEl.setAttribute('aria-label', node.text || 'component');

  const body = rootEl.querySelector('.node-body');
  body.style.background = node.fill;
  body.style.borderColor = node.stroke;
  body.style.borderWidth = `${node.strokeWidth}px`;
  body.style.color = '#1F2937';
  body.style.fontSize = `${node.fontSize}px`;
  body.style.textAlign = node.textAlign;

  clear(body);
  if (node.shape === 'rows') {
    body.appendChild(buildRowsBody(node));
  } else {
    body.appendChild(buildStandardBody(node));
  }

  updateExternalLabel(rootEl, node);
}

const OUTSIDE_POSITIONS = ['above', 'below'];

function renameNode(node, value) {
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === node.id);
    if (n) n.text = value;
  });
}

function buildStandardBody(node) {
  const position = node.textPosition || 'center';
  const wrap = el('div', { class: `node-standard pos-${position}` });
  if (node.iconVisible !== false && node.icon) wrap.appendChild(el('div', { class: 'node-icon', text: node.icon }));

  if (!OUTSIDE_POSITIONS.includes(position)) {
    const label = el('div', { class: 'node-label', title: 'Double-click to rename' });
    label.textContent = node.text;
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineEdit(label, node.text, (value) => renameNode(node, value));
    });
    wrap.appendChild(label);
  }

  if (node.subComponents?.length) {
    wrap.appendChild(buildSubComponentsDisplay(node));
  }
  return wrap;
}

function buildSubComponentsDisplay(node) {
  if (node.subComponentsDisplay === 'full') {
    const list = el('div', { class: 'node-subcomponents-full' });
    for (const sc of node.subComponents) {
      list.appendChild(el('div', { class: 'node-subcomponent-row', text: `${sc.icon || ''} ${sc.name}`.trim() }));
    }
    return list;
  }
  const chips = el('div', { class: 'node-subchips' });
  for (const sc of node.subComponents.slice(0, 4)) {
    chips.appendChild(el('span', { class: 'node-subchip', text: `${sc.icon || ''} ${sc.name}`.trim() }));
  }
  if (node.subComponents.length > 4) chips.appendChild(el('span', { class: 'node-subchip more', text: `+${node.subComponents.length - 4}` }));
  return chips;
}

/** For textPosition 'above'/'below': the label must live outside .node-body
 * (which has overflow:hidden to respect clip-path shapes) as a direct child
 * of the node root, or it would be clipped — see docs/ARCHITECTURE.md. */
function updateExternalLabel(rootEl, node) {
  const position = node.textPosition || 'center';
  let labelEl = rootEl.querySelector('.node-external-label');
  if (!OUTSIDE_POSITIONS.includes(position)) {
    labelEl?.remove();
    return;
  }
  if (!labelEl) {
    labelEl = el('div', { class: 'node-external-label', title: 'Double-click to rename' });
    labelEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    rootEl.appendChild(labelEl);
  }
  labelEl.classList.toggle('pos-above', position === 'above');
  labelEl.classList.toggle('pos-below', position === 'below');
  labelEl.textContent = node.text;
  labelEl.ondblclick = (e) => {
    e.stopPropagation();
    startInlineEdit(labelEl, node.text, (value) => renameNode(node, value));
  };
}

function buildRowsBody(node) {
  const wrap = el('div', { class: 'node-rows' });
  const header = el('div', { class: 'node-rows-header' });
  if (node.iconVisible !== false && node.icon) header.appendChild(el('span', { class: 'node-icon', text: node.icon }));
  const label = el('span', { class: 'node-label', text: node.text, title: 'Double-click to rename' });
  label.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startInlineEdit(label, node.text, (value) => {
      store.dispatch((draft) => {
        const n = draft.nodes.find((x) => x.id === node.id);
        if (n) n.text = value;
      });
    });
  });
  header.appendChild(label);
  wrap.appendChild(header);

  const list = el('div', { class: 'node-rows-list' });
  (node.rows || []).forEach((row, idx) => {
    const item = el('div', { class: 'row-item' });
    const text = el('span', { class: 'row-text', text: row, title: 'Double-click to rename' });
    text.addEventListener('pointerdown', (e) => e.stopPropagation());
    text.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineEdit(text, row, (value) => {
        store.dispatch((draft) => {
          const n = draft.nodes.find((x) => x.id === node.id);
          if (n) n.rows[idx] = value;
        });
      });
    });
    const del = el('button', {
      class: 'row-delete',
      type: 'button',
      text: '×',
      'aria-label': 'Remove row',
      onClick: (e) => {
        e.stopPropagation();
        store.dispatch((draft) => {
          const n = draft.nodes.find((x) => x.id === node.id);
          if (n) n.rows.splice(idx, 1);
        });
      },
    });
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    item.appendChild(text);
    item.appendChild(del);
    list.appendChild(item);
  });
  wrap.appendChild(list);

  const addBtn = el('button', {
    class: 'node-add-row',
    type: 'button',
    text: '+ Add row',
    onClick: (e) => {
      e.stopPropagation();
      store.dispatch((draft) => {
        const n = draft.nodes.find((x) => x.id === node.id);
        if (n) n.rows.push(`Row ${n.rows.length + 1}`);
      });
    },
  });
  addBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.appendChild(addBtn);
  return wrap;
}

function startInlineEdit(labelEl, currentValue, onCommit) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit-input';
  input.value = currentValue;
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    if (commit && input.value.trim() && input.value !== currentValue) onCommit(input.value.trim());
    input.replaceWith(labelEl);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
}

export const NODE_HANDLE_IDS = HANDLES;
export const NODE_SIDE_IDS = SIDES;
