// Pinned-comment editor (see canvas/commentPins.js and
// core/project.js#createComment) — opened either right after a fresh pin is
// dropped (canvas.js#addCommentAt/#addCommentAtCenter) or by clicking an
// existing pin, via the same `sdb:open-*` window-event convention every
// other canvas-triggered modal in this app uses.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, checkbox } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { updateCommentText, toggleCommentResolved, deleteComment } from '../canvas/canvas.js';
import { confirmAction } from './confirmModal.js';

window.addEventListener('sdb:open-comment', (e) => openCommentModal(e.detail.commentId));

export function openCommentModal(commentId) {
  const comment = store.getState().comments.find((c) => c.id === commentId);
  if (!comment) return;

  openModal({
    title: 'Comment',
    className: 'comment-modal',
    render: (body, api) => {
      const textarea = el('textarea', {
        class: 'comment-modal-text',
        placeholder: 'Leave a note about this part of the diagram…',
        rows: 4,
        'data-focus-key': 'comment-text',
        onInput: (e) => updateCommentText(commentId, e.target.value),
      });
      textarea.value = comment.text;
      body.appendChild(field('Note', textarea));

      body.appendChild(checkbox(comment.resolved, (v) => toggleCommentResolved(commentId), 'Mark as resolved'));

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-danger',
        text: '🗑️ Delete',
        onClick: async () => {
          const ok = await confirmAction({ title: 'Delete comment?', message: 'This removes the pin and its note. This can be undone with Ctrl+Z.' });
          if (!ok) return;
          deleteComment(commentId);
          api.close();
        },
      }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Done', onClick: () => api.close() }));
      body.appendChild(actions);
    },
  });
}
