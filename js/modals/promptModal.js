import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, textInput, numberInput } from '../utils/formControls.js';

/** A single-line text-input confirmation dialog — this app's only text-entry
 * prompt (no native window.prompt(), which can't be styled and is awkward to
 * drive from Playwright). Used for naming/renaming favorites folders.
 * @returns {Promise<string|null>} the trimmed value, or null if cancelled. */
export function promptText({ title = 'Enter a name', label = '', defaultValue = '', confirmLabel = 'Save' }) {
  return new Promise((resolve) => {
    let resolved = false;
    let value = defaultValue;
    const api = openModal({
      title,
      className: 'prompt-modal',
      render: (body) => {
        const form = el('form', {
          class: 'modal-form',
          onSubmit: (e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) { input.focus(); return; }
            resolved = true;
            resolve(trimmed);
            api.close();
          },
        });
        const input = textInput(value, (v) => { value = v; }, { maxLength: 60, required: true });
        form.appendChild(field(label || 'Name', input));

        const actions = el('div', { class: 'modal-actions' });
        const buttons = el('div', { class: 'modal-actions-primary' });
        buttons.appendChild(el('button', {
          class: 'btn',
          type: 'button',
          text: 'Cancel',
          onClick: () => { resolved = true; resolve(null); api.close(); },
        }));
        buttons.appendChild(el('button', { class: 'btn btn-primary', type: 'submit', text: confirmLabel }));
        actions.appendChild(buttons);
        form.appendChild(actions);
        body.appendChild(form);
        setTimeout(() => { input.focus(); input.select(); }, 0);
      },
      onClose: () => { if (!resolved) resolve(null); },
    });
  });
}

/** Same shape as promptText, but for a single positive integer — used by
 * the sequence-diagram message "Set sequence number..." action.
 * @returns {Promise<number|null>} the entered integer, or null if cancelled. */
export function promptNumber({ title = 'Enter a number', label = '', defaultValue = 1, min = 1, confirmLabel = 'Save' }) {
  return new Promise((resolve) => {
    let resolved = false;
    let value = defaultValue;
    const api = openModal({
      title,
      className: 'prompt-modal',
      render: (body) => {
        const form = el('form', {
          class: 'modal-form',
          onSubmit: (e) => {
            e.preventDefault();
            if (!Number.isFinite(value) || value < min) { input.focus(); return; }
            resolved = true;
            resolve(Math.round(value));
            api.close();
          },
        });
        const input = numberInput(value, min, undefined, 1, (v) => { value = v; }, { required: true });
        form.appendChild(field(label || 'Number', input));

        const actions = el('div', { class: 'modal-actions' });
        const buttons = el('div', { class: 'modal-actions-primary' });
        buttons.appendChild(el('button', {
          class: 'btn',
          type: 'button',
          text: 'Cancel',
          onClick: () => { resolved = true; resolve(null); api.close(); },
        }));
        buttons.appendChild(el('button', { class: 'btn btn-primary', type: 'submit', text: confirmLabel }));
        actions.appendChild(buttons);
        form.appendChild(actions);
        body.appendChild(form);
        setTimeout(() => { input.focus(); input.select(); }, 0);
      },
      onClose: () => { if (!resolved) resolve(null); },
    });
  });
}
