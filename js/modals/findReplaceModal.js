// "Find & Replace" — renames a term across every component label/notes and
// connector label/notes in one pass, instead of clicking into each one by
// hand. Follows the same `sdb:open-*` window-event convention as
// scaleDiagramModal.js/replicationModal.js; the actual matching/replacing
// logic lives in core/findReplace.js so it's unit-testable without a DOM.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, textInput, checkbox } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { countMatches, applyReplace } from '../core/findReplace.js';
import { showToast } from '../utils/toast.js';

window.addEventListener('sdb:open-find-replace', () => openFindReplaceModal());

export function openFindReplaceModal() {
  let find = '';
  let replaceWith = '';
  let matchCase = false;
  let includeNotes = true;

  openModal({
    title: '🔎 Find & Replace',
    className: 'find-replace-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Replaces every occurrence in component labels and connector labels — and their notes fields too, unless you turn that off below — across the whole diagram in one undoable step.',
      }));

      const findInput = textInput(find, (v) => { find = v; updateCount(); }, { placeholder: 'Find...', 'data-focus-key': 'find-replace-find' });
      body.appendChild(field('Find', findInput));
      const replaceInput = textInput(replaceWith, (v) => { replaceWith = v; });
      body.appendChild(field('Replace with', replaceInput));

      const optionsRow = el('div', { class: 'field-row' });
      optionsRow.appendChild(checkbox(matchCase, (v) => { matchCase = v; updateCount(); }, 'Match case'));
      optionsRow.appendChild(checkbox(includeNotes, (v) => { includeNotes = v; updateCount(); }, 'Include notes'));
      body.appendChild(optionsRow);

      const countEl = el('p', { class: 'modal-hint find-replace-count' });
      body.appendChild(countEl);

      const updateCount = () => {
        const state = store.getState();
        const count = countMatches(state.nodes, state.edges, { find, matchCase, includeNotes });
        countEl.textContent = find
          ? (count ? `${count} label${count === 1 ? '' : 's'}/notes field${count === 1 ? '' : 's'} will change.` : 'No matches found.')
          : '';
      };
      updateCount();

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '🔎 Replace All',
        onClick: () => {
          if (!find) return;
          const state = store.getState();
          const { nodeUpdates, edgeUpdates } = applyReplace(state.nodes, state.edges, { find, replaceWith, matchCase, includeNotes });
          if (!nodeUpdates.length && !edgeUpdates.length) {
            showToast('No matches found.', 'info', 1800);
            return;
          }
          store.dispatch((draft) => {
            for (const update of nodeUpdates) {
              const node = draft.nodes.find((n) => n.id === update.id);
              if (!node) continue;
              if ('text' in update) node.text = update.text;
              if ('notes' in update) node.notes = update.notes;
            }
            for (const update of edgeUpdates) {
              const edge = draft.edges.find((e) => e.id === update.id);
              if (!edge) continue;
              if ('label' in update) edge.label = update.label;
              if ('notes' in update) edge.notes = update.notes;
            }
          });
          const total = nodeUpdates.length + edgeUpdates.length;
          showToast(`Replaced in ${total} place${total === 1 ? '' : 's'} — Ctrl/Cmd+Z to undo.`, 'success', 2400);
          api.close();
        },
      }));
      body.appendChild(actions);
    },
  });
}
