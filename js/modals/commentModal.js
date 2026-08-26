// Pinned-comment editor (see canvas/commentPins.js and
// core/project.js#createComment) — opened either right after a fresh pin is
// dropped (canvas.js#addCommentAt/#addCommentAtCenter) or by clicking an
// existing pin, via the same `sdb:open-*` window-event convention every
// other canvas-triggered modal in this app uses.
import { openModal } from './modal.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import { field, checkbox } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { updateCommentText, toggleCommentResolved, deleteComment, addCommentReply, deleteCommentReply } from '../canvas/canvas.js';
import { confirmAction } from './confirmModal.js';
import { splitMentions } from '../core/mentions.js';

/** Appends `text` into `container` as plain text nodes, except an
 * `@handle`-shaped segment (see core/mentions.js) which becomes a small
 * highlighted <span> — no innerHTML anywhere, per this app's security rule. */
function appendTextWithMentions(container, text) {
  for (const segment of splitMentions(text)) {
    if (segment.mention) container.appendChild(el('span', { class: 'mention-chip', text: segment.text }));
    else container.appendChild(document.createTextNode(segment.text));
  }
}

window.addEventListener('sdb:open-comment', (e) => openCommentModal(e.detail.commentId));

export function openCommentModal(commentId) {
  let unsubscribe = null;

  openModal({
    title: 'Comment',
    className: 'comment-modal',
    render: (body, api) => {
      const buildContents = () => {
        clear(body);
        const comment = store.getState().comments.find((c) => c.id === commentId);
        if (!comment) { api.close(); return; }

        const textarea = el('textarea', {
          class: 'comment-modal-text',
          placeholder: 'Leave a note about this part of the diagram…',
          rows: 4,
          'data-focus-key': 'comment-text',
          onInput: (e) => updateCommentText(commentId, e.target.value),
        });
        textarea.value = comment.text;
        body.appendChild(field('Note', textarea));

        body.appendChild(checkbox(comment.resolved, () => toggleCommentResolved(commentId), 'Mark as resolved'));

        if (comment.replies.length) {
          const thread = el('div', { class: 'comment-thread' });
          for (const reply of comment.replies) {
            const row = el('div', { class: 'comment-reply' });
            const replyTextEl = el('span', { class: 'comment-reply-text' });
            appendTextWithMentions(replyTextEl, reply.text);
            row.appendChild(replyTextEl);
            row.appendChild(el('button', {
              type: 'button', class: 'comment-reply-remove', 'aria-label': 'Delete reply', title: 'Delete reply', text: '✕',
              onClick: () => deleteCommentReply(commentId, reply.id),
            }));
            thread.appendChild(row);
          }
          body.appendChild(thread);
        }

        const replyInput = el('input', {
          type: 'text',
          class: 'comment-reply-input',
          placeholder: 'Add a reply…',
          'data-focus-key': 'comment-reply-input',
          onKeydown: (e) => {
            if (e.key !== 'Enter' || !e.target.value.trim()) return;
            addCommentReply(commentId, e.target.value);
            e.target.value = '';
          },
        });
        body.appendChild(field('Reply', replyInput));

        const actions = el('div', { class: 'modal-actions' });
        actions.appendChild(el('button', {
          type: 'button',
          class: 'btn btn-danger',
          text: '🗑️ Delete',
          onClick: async () => {
            const ok = await confirmAction({ title: 'Delete comment?', message: 'This removes the pin, its note, and every reply. This can be undone with Ctrl+Z.' });
            if (!ok) return;
            deleteComment(commentId);
            api.close();
          },
        }));
        actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Done', onClick: () => api.close() }));
        body.appendChild(actions);
      };

      buildContents();
      unsubscribe = store.subscribe('change', () => rerenderPreservingUiState(body, buildContents, '.comment-reply-input'));
    },
    onClose: () => unsubscribe?.(),
  });
}
