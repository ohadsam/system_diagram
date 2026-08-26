// "💬 Comments" — a searchable-by-eye list of every pinned comment on the
// current diagram (see canvas/commentPins.js and core/project.js#createComment),
// unresolved ones first, so a busy diagram's comments don't just get lost
// among the pins on the canvas. Mirrors panel/outlinePanel.js's
// select-and-center-on-click pattern, but as a modal (comments are usually
// few enough that a full side panel would be overkill).
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { checkbox } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { centerOn } from '../canvas/viewport.js';

function truncate(text, max = 80) {
  const str = (text || '').trim() || '(empty note)';
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

export function openCommentsListModal() {
  let showResolved = false;
  let unsubscribe = null;

  openModal({
    title: '💬 Comments',
    className: 'comments-list-modal',
    render: (body, api) => {
      body.appendChild(checkbox(showResolved, (checked) => { showResolved = checked; renderRows(); }, 'Show resolved comments too'));

      const list = el('div', { class: 'comments-list' });
      body.appendChild(list);

      const renderRows = () => {
        clear(list);
        const comments = store.getState().comments || [];
        const visible = (showResolved ? comments : comments.filter((c) => !c.resolved))
          .slice()
          .sort((a, b) => Number(a.resolved) - Number(b.resolved) || (b.createdAt || '').localeCompare(a.createdAt || ''));

        if (!comments.length) {
          list.appendChild(el('p', { class: 'sidebar-empty', text: 'No comments on this diagram yet — right-click empty canvas and choose "Add comment here".' }));
          return;
        }
        if (!visible.length) {
          list.appendChild(el('p', { class: 'sidebar-empty', text: 'No unresolved comments — check "Show resolved comments too" to see the rest.' }));
          return;
        }

        for (const comment of visible) {
          const row = el('div', { class: `comments-list-row${comment.resolved ? ' is-resolved' : ''}` });
          row.appendChild(el('span', { class: 'comments-list-status', 'aria-hidden': 'true', text: comment.resolved ? '✓' : '💬' }));
          const info = el('div', { class: 'comments-list-info' });
          info.appendChild(el('span', { class: 'comments-list-text', text: truncate(comment.text) }));
          const replyCount = (comment.replies || []).length;
          info.appendChild(el('span', { class: 'comments-list-meta', text: replyCount ? `${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : 'No replies' }));
          row.appendChild(info);
          row.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary btn-sm', text: 'Open',
            onClick: () => {
              centerOn(comment.x, comment.y);
              window.dispatchEvent(new CustomEvent('sdb:open-comment', { detail: { commentId: comment.id } }));
              api.close();
            },
          }));
          list.appendChild(row);
        }
      };

      renderRows();
      unsubscribe = store.subscribe('change', renderRows);
    },
    onClose: () => unsubscribe?.(),
  });
}
