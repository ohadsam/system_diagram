// "C4 Context Diagram" wizard — reachable from the toolbar's Create
// dropdown. Bootstraps the most common C4 Model starting point: a central
// Software System box, a row of Person/Actor boxes above it, and a row of
// External Software System boxes below it, each connected to the central
// system (see canvas/canvas.js#createC4ContextDiagram). A Container or
// Component diagram isn't a separate wizard — build one the same way as any
// other diagram, by dragging the matching shapes from the "C4 Model"
// sidebar category and connecting them.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { textInput } from '../utils/formControls.js';
import { createC4ContextDiagram } from '../canvas/canvas.js';

window.addEventListener('sdb:open-c4-context', () => openC4ContextModal());

export function openC4ContextModal() {
  const state = {
    systemName: 'My System',
    people: ['User'],
    externalSystems: ['Payment Gateway'],
  };

  openModal({
    title: 'C4 Context Diagram',
    className: 'c4-context-modal',
    render: (body, api) => {
      const rerender = () => renderBody(body, api, state, rerender);
      rerender();
    },
  });
}

function nameListField(body, label, names, focusPrefix, addLabel, rerender) {
  body.appendChild(el('label', { class: 'field-label', text: label }));
  const list = el('div', { class: 'sequence-participant-list' });
  names.forEach((name, idx) => {
    const row = el('div', { class: 'field-row' });
    row.appendChild(textInput(name, (v) => { names[idx] = v; }, {
      placeholder: `${label} ${idx + 1}`,
      'data-focus-key': `${focusPrefix}-${idx}`,
    }));
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-icon',
      text: '×',
      'aria-label': `Remove ${label.toLowerCase()}`,
      onClick: () => { names.splice(idx, 1); rerender(); },
    }));
    list.appendChild(row);
  });
  body.appendChild(list);
  body.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: addLabel,
    onClick: () => { names.push(''); rerender(); },
  }));
}

function renderBody(body, api, state, rerender) {
  clear(body);
  body.appendChild(el('p', {
    class: 'modal-hint',
    text: 'Name the system in scope, who uses it, and any external systems it talks to — a System Context diagram is created with everything connected to the central system. Container and Component diagrams are built the same way: drag "Container"/"Component" shapes from the C4 Model sidebar category and connect them.',
  }));

  body.appendChild(el('label', { class: 'field-label', text: 'System name' }));
  body.appendChild(textInput(state.systemName, (v) => { state.systemName = v; }, {
    placeholder: 'e.g. Online Banking System',
    'data-focus-key': 'system-name',
  }));

  nameListField(body, 'Person', state.people, 'person', '+ Add person', rerender);
  nameListField(body, 'External system', state.externalSystems, 'external', '+ Add external system', rerender);

  const error = el('p', { class: 'sequence-diagram-error', hidden: true });
  body.appendChild(error);

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
  actions.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-primary',
    text: '🧩 Create',
    onClick: () => {
      const systemName = state.systemName.trim();
      if (!systemName) {
        error.textContent = 'Name the system in scope.';
        error.hidden = false;
        return;
      }
      const people = state.people.map((n) => n.trim()).filter(Boolean);
      const externalSystems = state.externalSystems.map((n) => n.trim()).filter(Boolean);
      createC4ContextDiagram(systemName, people, externalSystems);
      api.close();
    },
  }));
  body.appendChild(actions);
}
