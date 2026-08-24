// "Sequence Diagram" wizard — reachable from the toolbar's Create dropdown.
// Turns a list of participant names into a set of titled "lifeline" nodes
// (see canvas/canvas.js#createSequenceDiagram); messages between them are
// then drawn afterward with the ordinary connect-a-node gesture.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { textInput } from '../utils/formControls.js';
import { createSequenceDiagram } from '../canvas/canvas.js';

// Dispatched as a window event (not a direct import from toolbar.js) purely
// for consistency with this codebase's other `sdb:open-*` action modals
// (see modals/replicationModal.js) — toolbar.js could import this module
// directly too, since nothing here imports back from toolbar.js, but this
// keeps every "open a Create-dropdown wizard" entry point uniform.
window.addEventListener('sdb:open-sequence-diagram', () => openSequenceDiagramModal());

export function openSequenceDiagramModal() {
  const names = ['Client', 'Server'];

  openModal({
    title: 'Sequence Diagram',
    className: 'sequence-diagram-modal',
    render: (body, api) => {
      const rerender = () => renderBody(body, api, names, rerender);
      rerender();
    },
  });
}

function renderBody(body, api, names, rerender) {
  clear(body);
  body.appendChild(el('p', {
    class: 'modal-hint',
    text: 'Name each participant (Client, Server, Database, ...) — a titled lifeline is created for each, left to right. Afterward, drag from one lifeline\'s edge to another to draw a message at whatever height represents when it happens.',
  }));

  const list = el('div', { class: 'sequence-participant-list' });
  names.forEach((name, idx) => {
    const row = el('div', { class: 'field-row' });
    row.appendChild(textInput(name, (v) => { names[idx] = v; }, {
      placeholder: `Participant ${idx + 1}`,
      'data-focus-key': `participant-${idx}`,
    }));
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-icon',
      text: '×',
      'aria-label': 'Remove participant',
      disabled: names.length <= 2,
      onClick: () => { names.splice(idx, 1); rerender(); },
    }));
    list.appendChild(row);
  });
  body.appendChild(list);

  body.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: '+ Add participant',
    onClick: () => { names.push(''); rerender(); },
  }));

  const error = el('p', { class: 'sequence-diagram-error', hidden: true });
  body.appendChild(error);

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
  actions.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-primary',
    text: '🔀 Create',
    onClick: () => {
      const trimmed = names.map((n) => n.trim()).filter(Boolean);
      if (trimmed.length < 2) {
        error.textContent = 'Name at least 2 participants.';
        error.hidden = false;
        return;
      }
      createSequenceDiagram(trimmed);
      api.close();
    },
  }));
  body.appendChild(actions);
}
