// "Replicate" — create/join/break live replication pairs (see
// core/replication.js and docs/SPEC.md "Live Replication"). Reachable from
// the toolbar's contextual "🔁" button whenever ≥1 node is selected.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { REPLICATION_MODES } from '../core/project.js';
import {
  createReplicationPairFromSelection, addSelectionToReplicationSide, breakReplicationPair, getReplicationInfoForNode, setReplicationPairFrozen,
} from '../canvas/canvas.js';
import { selectInput } from '../utils/formControls.js';
import { confirmAction } from './confirmModal.js';

const MODE_LABELS = {
  'active-active': 'Active-Active',
  'active-passive': 'Active-Passive (Primary-Standby)',
  'primary-replica': 'Primary-Replica',
};

function pairSummary(pair) {
  const count = pair.members.length;
  const base = `${MODE_LABELS[pair.mode] || pair.mode} — ${count} mirrored component${count === 1 ? '' : 's'}`;
  return pair.frozen ? `❄️ ${base} (frozen)` : base;
}

// A node's right-click context menu offers "Join replication..." for a
// node not yet part of a pair (canvas.js#openNodeContextMenu) — dispatched
// as a window event rather than canvas.js importing this module directly,
// since this module already imports several actions *from* canvas.js and
// a direct import the other way would be circular. Selects the node first
// so the modal's own "current selection" section (which reads
// store.getSelection()) immediately shows its join options.
window.addEventListener('sdb:open-replication', (e) => {
  store.select([e.detail.nodeId], []);
  openReplicationModal();
});

export function openReplicationModal() {
  let selectedMode = REPLICATION_MODES[0];
  const unsubscribers = [];

  openModal({
    title: 'Replicate',
    className: 'replication-modal',
    onClose: () => unsubscribers.forEach((fn) => fn()),
    render: (body, api) => {
      const rerender = () => renderBody(body, api, selectedMode, (m) => { selectedMode = m; });
      unsubscribers.push(store.subscribe('change', rerender));
      unsubscribers.push(store.subscribe('selection', rerender));
      rerender();
    },
  });
}

function renderBody(body, api, selectedMode, setMode) {
  clear(body);
  const state = store.getState();
  const selection = store.getSelection();
  const pairs = state.replicationPairs;

  body.appendChild(el('p', { class: 'modal-hint', text: 'Link two sides so components added to one automatically mirror to the other. Exclude any single component from the details panel.' }));

  body.appendChild(el('h3', { class: 'modal-subheading', text: 'Current selection' }));
  if (!selection.nodeIds.length) {
    body.appendChild(el('p', { class: 'modal-hint', text: 'Select one or more components on the canvas, then come back here.' }));
  } else {
    renderSelectionSection(body, api, state, selection, pairs, selectedMode, setMode);
  }

  body.appendChild(el('h3', { class: 'modal-subheading', text: 'All replication pairs in this project' }));
  if (!pairs.length) {
    body.appendChild(el('p', { class: 'modal-hint', text: 'None yet.' }));
  } else {
    const list = el('div', { class: 'replication-pair-list' });
    for (const pair of pairs) {
      const row = el('div', { class: 'replication-pair-row' });
      row.appendChild(el('span', { text: pairSummary(pair) }));
      row.appendChild(el('button', {
        type: 'button', class: 'btn btn-icon', text: pair.frozen ? '▶️' : '❄️',
        title: pair.frozen ? 'Resume: changes will mirror between the two sides again' : 'Freeze: pause mirroring so either side can be edited without affecting the other',
        'aria-label': pair.frozen ? 'Resume this replication pair' : 'Freeze this replication pair',
        onClick: () => setReplicationPairFrozen(pair.id, !pair.frozen),
      }));
      row.appendChild(el('button', {
        type: 'button', class: 'btn btn-icon', text: '🗑️', title: 'Break this replication pair', 'aria-label': 'Break this replication pair',
        onClick: async () => {
          const ok = await confirmAction({
            title: 'Break this replication pair?',
            message: 'Both sides stay exactly as they are now — they just stop staying in sync going forward.',
            confirmLabel: 'Break',
            danger: false,
          });
          if (ok) breakReplicationPair(pair.id);
        },
      }));
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Close', onClick: () => api.close() }));
  body.appendChild(actions);
}

function renderSelectionSection(body, api, state, selection, pairs, selectedMode, setMode) {
  const infos = selection.nodeIds.map((id) => getReplicationInfoForNode(id));
  const linkedPairIds = new Set(infos.filter(Boolean).map((i) => i.pair.id));

  // Only treat the whole selection as "nothing to do here" when EVERY
  // selected node already belongs to the same one pair — a selection that
  // mixes an already-linked node with a fresh one (e.g. shift-clicking a
  // new component together with an existing side-A member) still has real
  // work to offer below, and the create/join actions' own conflict guards
  // (see canvas.js) keep that safe.
  if (infos.every(Boolean) && linkedPairIds.size === 1) {
    const sides = new Set(infos.map((i) => i.side));
    const sideLabel = sides.size === 1 ? `side ${[...sides][0].toUpperCase()}` : 'both sides';
    const mode = infos[0].pair.mode;
    body.appendChild(el('p', { class: 'modal-hint', text: `Every selected component is already part of the "${MODE_LABELS[mode] || mode}" pair (${sideLabel}).` }));
    return;
  }
  if (linkedPairIds.size > 1) {
    body.appendChild(el('p', { class: 'modal-hint', text: 'This selection spans more than one replication pair — pick a more focused selection to manage it here.' }));
    return;
  }

  // Not (fully) part of a pair yet: offer to create a new one, or join an existing one.
  const createRow = el('div', { class: 'field-row' });
  createRow.appendChild(selectInput(REPLICATION_MODES, selectedMode, setMode, MODE_LABELS));
  createRow.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: '🔁 Create replication pair',
    onClick: () => { createReplicationPairFromSelection(selectedMode); api.close(); },
  }));
  body.appendChild(createRow);

  if (pairs.length) {
    body.appendChild(el('p', { class: 'modal-hint', text: 'Or add this selection to an existing pair:' }));
    const joinList = el('div', { class: 'replication-pair-list' });
    for (const pair of pairs) {
      const row = el('div', { class: 'replication-pair-row' });
      row.appendChild(el('span', { text: pairSummary(pair) }));
      const joinTitle = pair.frozen ? 'Resume this pair first — while frozen, a new member would not get mirrored' : undefined;
      row.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary', text: 'Add as side A', disabled: pair.frozen, title: joinTitle,
        onClick: () => { addSelectionToReplicationSide(pair.id, 'a'); api.close(); },
      }));
      row.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary', text: 'Add as side B', disabled: pair.frozen, title: joinTitle,
        onClick: () => { addSelectionToReplicationSide(pair.id, 'b'); api.close(); },
      }));
      joinList.appendChild(row);
    }
    body.appendChild(joinList);
  }
}
