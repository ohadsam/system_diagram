import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { t } from '../io/i18n.js';

/** @returns {Promise<boolean>} */
export function confirmAction({ title = 'Are you sure?', message = '', confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    let resolved = false;
    const api = openModal({
      title,
      className: 'confirm-modal',
      render: (body) => {
        body.appendChild(el('p', { text: message }));
        const actions = el('div', { class: 'modal-actions' });
        actions.appendChild(
          el('button', {
            class: 'btn',
            type: 'button',
            text: t('common.cancel'),
            onClick: () => {
              resolved = true;
              resolve(false);
              api.close();
            },
          }),
        );
        actions.appendChild(
          el('button', {
            class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
            type: 'button',
            text: confirmLabel,
            onClick: () => {
              resolved = true;
              resolve(true);
              api.close();
            },
          }),
        );
        body.appendChild(actions);
      },
      onClose: () => {
        if (!resolved) resolve(false);
      },
    });
  });
}
