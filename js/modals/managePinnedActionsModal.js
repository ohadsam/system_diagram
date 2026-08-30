// "📌 Manage Pinned Toolbar Actions" — lets a user promote their most-used
// actions (the exact same list modals/commandPaletteModal.js#buildAppCommands
// already indexes for ⌘K) into an always-visible toolbar row
// (toolbar/pinnedActionsBar.js), instead of digging through a dropdown or
// the palette every single time. Takes that command list as a parameter
// rather than importing commandPaletteModal.js directly — that module
// already imports *this* one (for its own "Manage Pinned..." palette entry),
// so a back-import here would create a cycle; pinnedActionsBar.js (the
// other caller) passes its own copy of the same list for the same reason.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { getUiPrefs, saveUiPrefs } from '../io/uiPrefs.js';

const MAX_RESULTS = 60;

export function openManagePinnedActionsModal(commands) {
  let query = '';

  openModal({
    title: '📌 Manage Pinned Toolbar Actions',
    className: 'manage-pinned-actions-modal',
    render: (body) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Pin your most-used actions as always-visible toolbar buttons, in whatever order you like — this is the exact same list Ctrl/Cmd+K already searches.',
      }));

      body.appendChild(el('h3', { class: 'modal-subheading', text: 'Pinned' }));
      const pinnedContainer = el('div', { class: 'pinned-actions-list' });
      body.appendChild(pinnedContainer);

      body.appendChild(el('h3', { class: 'modal-subheading', text: 'All actions' }));
      const searchInput = el('input', {
        type: 'text', class: 'pinned-actions-search', placeholder: 'Search actions...',
        onInput: (e) => { query = e.target.value; renderResults(); },
      });
      body.appendChild(searchInput);
      const resultsContainer = el('div', { class: 'pinned-actions-list pinned-actions-all' });
      body.appendChild(resultsContainer);

      function setPinned(id, pinned) {
        const current = getUiPrefs().pinnedActionIds;
        const next = pinned ? [...current, id] : current.filter((x) => x !== id);
        saveUiPrefs({ pinnedActionIds: next });
        renderPinned();
        renderResults();
      }

      function reorder(index, delta) {
        const current = [...getUiPrefs().pinnedActionIds];
        const target = index + delta;
        if (target < 0 || target >= current.length) return;
        [current[index], current[target]] = [current[target], current[index]];
        saveUiPrefs({ pinnedActionIds: current });
        renderPinned();
      }

      function renderPinned() {
        clear(pinnedContainer);
        const pinnedIds = getUiPrefs().pinnedActionIds;
        if (!pinnedIds.length) {
          pinnedContainer.appendChild(el('p', { class: 'pinned-actions-empty', text: 'Nothing pinned yet — check off anything below.' }));
          return;
        }
        pinnedIds.forEach((id, index) => {
          const command = commands.find((c) => c.id === id);
          if (!command) return;
          const row = el('div', { class: 'pinned-actions-row' });
          row.appendChild(el('span', { class: 'pinned-actions-label', text: command.label }));
          const controls = el('div', { class: 'pinned-actions-row-controls' });
          controls.appendChild(el('button', {
            type: 'button', class: 'btn btn-icon', text: '▲', title: 'Move up', 'aria-label': `Move ${command.label} up`, disabled: index === 0,
            onClick: () => reorder(index, -1),
          }));
          controls.appendChild(el('button', {
            type: 'button', class: 'btn btn-icon', text: '▼', title: 'Move down', 'aria-label': `Move ${command.label} down`, disabled: index === pinnedIds.length - 1,
            onClick: () => reorder(index, 1),
          }));
          controls.appendChild(el('button', {
            type: 'button', class: 'btn btn-icon', text: '✕', title: 'Unpin', 'aria-label': `Unpin ${command.label}`,
            onClick: () => setPinned(id, false),
          }));
          row.appendChild(controls);
          pinnedContainer.appendChild(row);
        });
      }

      function renderResults() {
        clear(resultsContainer);
        const q = query.trim().toLowerCase();
        const matches = q
          ? commands.filter((c) => c.label.toLowerCase().includes(q) || (c.keywords || []).some((k) => k.toLowerCase().includes(q)))
          : commands;
        const pinnedIds = getUiPrefs().pinnedActionIds;
        for (const command of matches.slice(0, MAX_RESULTS)) {
          const row = el('label', { class: 'pinned-actions-row pinned-actions-checkbox-row' });
          row.appendChild(el('input', {
            type: 'checkbox', checked: pinnedIds.includes(command.id),
            onChange: (e) => setPinned(command.id, e.target.checked),
          }));
          row.appendChild(el('span', { text: command.label }));
          resultsContainer.appendChild(row);
        }
        if (!matches.length) resultsContainer.appendChild(el('p', { class: 'pinned-actions-empty', text: 'No matching actions.' }));
      }

      renderPinned();
      renderResults();
    },
  });
}
