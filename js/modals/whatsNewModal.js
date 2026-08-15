// "What's New" modal: shown automatically once after an update (see
// io/whatsNew.js), and reachable any time from the toolbar's 🆕 button.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { APP_VERSION, VERSION_HISTORY } from '../version.js';

export function openWhatsNewModal(entries = VERSION_HISTORY) {
  openModal({
    title: `What's new in v${APP_VERSION}`,
    className: 'whats-new-modal',
    render: (body, api) => {
      if (!entries.length) {
        body.appendChild(el('p', { class: 'sidebar-empty', text: "You're all caught up." }));
      }
      for (const entry of entries) {
        const section = el('div', { class: 'whats-new-entry' });
        section.appendChild(el('h3', { class: 'modal-subheading', text: `v${entry.version} — ${entry.date}` }));
        const list = el('ul', { class: 'whats-new-list' });
        for (const line of entry.highlights) list.appendChild(el('li', { text: line }));
        section.appendChild(list);
        body.appendChild(section);
      }
      const actions = el('div', { class: 'modal-actions', style: 'justify-content:flex-end' });
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Got it', onClick: () => api.close() }));
      body.appendChild(actions);
    },
  });
}
