// "🕘 Undo History" — a visual timeline of every undo/redo step, each with
// an auto-generated label (core/historyLabels.js), click any entry to jump
// straight to it instead of pressing Ctrl/Cmd+Z repeatedly. See
// core/history.js#getTimeline/#jumpTo and docs/ARCHITECTURE.md.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { describeHistoryStep } from '../core/historyLabels.js';

export function openHistoryTimelineModal() {
  let render;
  let unsubscribe;

  const api = openModal({
    title: 'Undo History',
    className: 'history-timeline-modal',
    onClose: () => unsubscribe?.(),
    render: (body) => {
      render = () => renderBody(body);
      // Live: jumping from elsewhere (Ctrl/Cmd+Z, the toolbar's own undo/redo
      // buttons) while this modal is open should move the highlighted "you
      // are here" row too, not just a jump made from inside the modal itself.
      unsubscribe = store.subscribe('change', render);
      render();
    },
  });

  function renderBody(body) {
    clear(body);
    body.appendChild(el('p', {
      class: 'modal-hint',
      text: 'Every undo/redo step, oldest first — click any entry to jump straight to it. Labels are auto-generated from what actually changed.',
    }));

    const { entries, currentIndex } = store.getHistoryTimeline();
    const list = el('div', { class: 'history-timeline-list' });
    for (let i = 0; i < entries.length; i++) {
      const isCurrent = i === currentIndex;
      const label = i === 0 ? 'Start' : describeHistoryStep(entries[i - 1], entries[i]);
      const row = el('button', {
        type: 'button',
        class: `history-timeline-row${isCurrent ? ' current' : ''}`,
        disabled: isCurrent,
        onClick: () => {
          store.jumpToHistoryIndex(i);
          api.close();
        },
      });
      row.appendChild(el('span', { class: 'history-timeline-index', text: String(i) }));
      row.appendChild(el('span', { class: 'history-timeline-label', text: label }));
      if (isCurrent) row.appendChild(el('span', { class: 'history-timeline-here', text: 'You are here' }));
      list.appendChild(row);
    }
    body.appendChild(list);
  }
}
