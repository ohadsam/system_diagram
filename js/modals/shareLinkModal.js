// "Share Diagram" — generates a URL whose hash fragment carries the whole
// project (see io/shareLink.js). No backend, so this is genuinely just a
// self-contained URL; the modal explains the "local copy, not live-synced"
// nature so it isn't mistaken for a real collaborative share.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { buildShareUrl } from '../io/shareLink.js';
import { showToast } from '../utils/toast.js';

export function openShareLinkModal() {
  openModal({
    title: 'Share Diagram',
    className: 'share-link-modal',
    render: async (body) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'This link encodes the whole diagram directly in the URL — there\'s no backend, so nothing is uploaded anywhere. Opening it loads a local copy into the recipient\'s own browser; it won\'t stay in sync with further edits here.',
      }));

      const loading = el('p', { class: 'modal-hint', text: 'Generating link…' });
      body.appendChild(loading);

      let url;
      try {
        url = await buildShareUrl(store.getState());
      } catch {
        loading.textContent = 'Could not generate a share link in this browser.';
        return;
      }
      loading.remove();

      const row = el('div', { class: 'share-link-row' });
      const input = el('input', { type: 'text', class: 'share-link-input', readOnly: true, value: url });
      row.appendChild(input);
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '📋 Copy Link',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(url);
            showToast('Link copied to clipboard.', 'success', 2000);
          } catch {
            input.select();
            showToast('Could not copy automatically — the link is selected, copy it manually.', 'error');
          }
        },
      }));
      body.appendChild(row);
      setTimeout(() => input.select(), 0);
    },
  });
}
