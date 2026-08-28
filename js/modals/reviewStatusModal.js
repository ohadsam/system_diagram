// "📝 Review Status" — a lightweight draft/in-review/approved label for
// team workflows (core/project.js's REVIEW_STATUSES), with a free-text
// "set by" name and timestamp — explicitly not a real permissions/approval
// system (this app has no accounts to enforce one), the same honesty this
// app already applies to version branching being an explicit copy rather
// than a real structural merge.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { REVIEW_STATUSES } from '../core/project.js';
import { setReviewStatus } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';

const STATUS_LABELS = { draft: '📝 Draft', 'in-review': '👀 In Review', approved: '✅ Approved' };

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function openReviewStatusModal() {
  openModal({
    title: '📝 Review Status',
    className: 'review-status-modal',
    render: (body, api) => {
      const renderBody = () => {
        clear(body);
        const state = store.getState();
        body.appendChild(el('p', {
          class: 'modal-hint',
          text: 'A shared status label for this diagram — not an access-control system, just a note for whoever else opens it.',
        }));

        if (state.reviewedBy || state.reviewedAt) {
          body.appendChild(el('p', {
            class: 'review-status-meta',
            text: `Currently "${STATUS_LABELS[state.reviewStatus] || state.reviewStatus}"${state.reviewedBy ? ` — set by ${state.reviewedBy}` : ''}${state.reviewedAt ? ` on ${formatWhen(state.reviewedAt)}` : ''}.`,
          }));
        }

        let nameValue = state.reviewedBy || '';
        const nameInput = el('input', {
          type: 'text', class: 'review-status-name-input', placeholder: 'Your name (optional)',
          value: nameValue,
          onInput: (e) => { nameValue = e.target.value; },
        });
        body.appendChild(nameInput);

        const buttons = el('div', { class: 'review-status-buttons' });
        for (const status of REVIEW_STATUSES) {
          buttons.appendChild(el('button', {
            type: 'button',
            class: `btn review-status-btn review-status-${status}${state.reviewStatus === status ? ' is-active' : ''}`,
            text: STATUS_LABELS[status],
            onClick: () => {
              setReviewStatus(status, nameValue);
              showToast(`Marked "${STATUS_LABELS[status]}".`, 'success', 2000);
              renderBody();
            },
          }));
        }
        body.appendChild(buttons);
      };

      renderBody();
    },
  });
}
