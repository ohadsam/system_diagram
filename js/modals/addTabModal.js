// "+" on the project tab strip — pick an existing saved project to open as
// an additional tab, or start a brand-new blank one. See
// io/projectTabs.js/toolbar/projectTabsBar.js for the rest of the feature.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { listSavedProjects } from '../io/projects.js';
import { getOpenTabIds, switchToProjectTab, openNewProjectTab } from '../io/projectTabs.js';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function openAddTabModal() {
  openModal({
    title: 'Open in New Tab',
    className: 'add-tab-modal',
    render: (body, api) => {
      body.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '🆕 New blank diagram',
        onClick: () => {
          openNewProjectTab();
          api.close();
        },
      }));

      const openIds = new Set(getOpenTabIds());
      const candidates = listSavedProjects().filter((p) => !openIds.has(p.id));

      body.appendChild(el('h3', { class: 'modal-subheading', text: 'Or open a saved project' }));
      if (!candidates.length) {
        body.appendChild(el('p', { class: 'sidebar-empty', text: 'No other saved projects to open — every saved project is already open in a tab.' }));
        return;
      }

      const list = el('div', { class: 'saved-project-list' });
      for (const p of candidates) {
        const row = el('div', { class: 'saved-project-row' });
        const info = el('div', { class: 'saved-project-info' });
        info.appendChild(el('span', { class: 'saved-project-name', text: p.name }));
        info.appendChild(el('span', { class: 'saved-project-meta', text: `${p.nodeCount} component${p.nodeCount === 1 ? '' : 's'} · ${formatDate(p.updatedAt)}` }));
        row.appendChild(info);
        row.appendChild(el('button', {
          type: 'button',
          class: 'btn btn-primary btn-sm',
          text: 'Open',
          onClick: () => {
            switchToProjectTab(p.id);
            api.close();
          },
        }));
        list.appendChild(row);
      }
      body.appendChild(list);
    },
  });
}
