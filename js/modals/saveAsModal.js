import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, textInput } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { saveNamedProject } from '../io/projects.js';
import { showToast } from '../utils/toast.js';

export function openSaveAsModal() {
  const project = store.getState();
  let name = project.name;

  openModal({
    title: 'Save project as…',
    className: 'save-as-modal',
    render: (body, api) => {
      const form = el('div', { class: 'modal-form' });
      const input = textInput(name, (v) => { name = v; }, { placeholder: 'My Architecture', required: true });
      form.appendChild(field('Project name', input));

      const actions = el('div', { class: 'modal-actions' });
      const buttons = el('div', { class: 'modal-actions-primary' });
      buttons.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      buttons.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: 'Save',
        onClick: () => {
          if (!name.trim()) { showToast('Please enter a project name.', 'error'); return; }
          store.dispatch((draft) => { draft.name = name.trim(); });
          saveNamedProject(store.getState());
          showToast(`Saved "${name.trim()}".`, 'success');
          api.close();
        },
      }));
      actions.appendChild(buttons);
      form.appendChild(actions);
      body.appendChild(form);
      setTimeout(() => { input.focus(); input.select(); }, 0);
    },
  });
}
