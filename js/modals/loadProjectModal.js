import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { listSavedProjects, loadNamedProject, deleteNamedProject } from '../io/projects.js';
import { pickJSONFile, parseProjectFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';

export function openLoadProjectModal() {
  openModal({
    title: 'Load project',
    className: 'load-project-modal',
    render: (body, api) => {
      const fromFileBtn = el('button', {
        type: 'button',
        class: 'btn btn-secondary',
        text: '📁 Load from JSON file…',
        onClick: async () => {
          const text = await pickJSONFile();
          if (!text) return;
          const result = parseProjectFile(text);
          if (!result.ok) { showToast(`Could not load file: ${result.error}`, 'error'); return; }
          store.loadProject(result.project);
          showToast(`Loaded "${result.project.name}".`, 'success');
          api.close();
        },
      });
      body.appendChild(fromFileBtn);

      body.appendChild(el('h3', { class: 'modal-subheading', text: 'Saved in this browser' }));
      const list = el('div', { class: 'saved-project-list' });
      body.appendChild(list);

      const renderList = () => {
        clear(list);
        const projects = listSavedProjects();
        if (!projects.length) {
          list.appendChild(el('p', { class: 'sidebar-empty', text: 'No saved projects yet — use "Save As" first.' }));
          return;
        }
        for (const p of projects) {
          const row = el('div', { class: 'saved-project-row' });
          const info = el('div', { class: 'saved-project-info' });
          info.appendChild(el('span', { class: 'saved-project-name', text: p.name }));
          info.appendChild(el('span', { class: 'saved-project-meta', text: `${p.nodeCount} component${p.nodeCount === 1 ? '' : 's'} · ${formatDate(p.updatedAt)}` }));
          row.appendChild(info);

          const actions = el('div', { class: 'saved-project-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary btn-sm', text: 'Load',
            onClick: () => {
              const result = loadNamedProject(p.id);
              if (!result.ok) { showToast(result.error, 'error'); return; }
              store.loadProject(result.project);
              showToast(`Loaded "${result.project.name}".`, 'success');
              api.close();
            },
          }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-danger btn-sm', text: 'Delete',
            onClick: async () => {
              const ok = await confirmAction({ title: 'Delete saved project', message: `Delete "${p.name}"? This cannot be undone.` });
              if (ok) { deleteNamedProject(p.id); renderList(); }
            },
          }));
          row.appendChild(actions);
          list.appendChild(row);
        }
      };
      renderList();
    },
  });
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
