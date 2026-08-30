// The "📌 pinned actions" row — a second toolbar row, hidden until the user
// has pinned at least one action (see modals/managePinnedActionsModal.js),
// same "hidden until relevant" convention as toolbar/projectTabsBar.js's own
// tabs row. Each pinned command is looked up fresh from
// modals/commandPaletteModal.js#buildAppCommands() on every render, so a
// button here always calls the exact same `run()` a Ctrl/Cmd+K search for
// that same action would — one list, two ways to reach it.
import { el, clear } from '../utils/dom.js';
import { getUiPrefs, onUiPrefsChange } from '../io/uiPrefs.js';
import { buildAppCommands } from '../modals/commandPaletteModal.js';
import { openManagePinnedActionsModal } from '../modals/managePinnedActionsModal.js';

export function initPinnedActionsBar(container) {
  function render() {
    clear(container);
    const pinnedIds = getUiPrefs().pinnedActionIds;
    if (!pinnedIds.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const commands = buildAppCommands();
    for (const id of pinnedIds) {
      const command = commands.find((c) => c.id === id);
      if (!command) continue;
      container.appendChild(el('button', {
        type: 'button', class: 'btn', title: command.label, text: command.label,
        onClick: command.run,
      }));
    }
    container.appendChild(el('button', {
      type: 'button', class: 'btn btn-icon pinned-actions-manage-btn', title: 'Manage pinned actions',
      'aria-label': 'Manage pinned actions', text: '📌',
      onClick: () => openManagePinnedActionsModal(commands),
    }));
  }

  render();
  onUiPrefsChange(render);
}
