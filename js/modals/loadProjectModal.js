import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import {
  listSavedProjects, loadNamedProject, deleteNamedProject, toggleFavorite,
  exportAllSavedProjects, importSavedProjectsBundle,
} from '../io/projects.js';
import { pickJSONFile, parseProjectFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';

let favoritesOnly = false;

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

      const subheadingRow = el('div', { class: 'saved-project-subheading-row' });
      subheadingRow.appendChild(el('h3', { class: 'modal-subheading', text: 'Saved in this browser' }));
      const bundleActions = el('div', { class: 'modal-actions-secondary' });
      bundleActions.appendChild(el('button', { type: 'button', class: 'btn-link', text: 'Export all…', onClick: exportAllSavedProjects }));
      bundleActions.appendChild(el('button', {
        type: 'button', class: 'btn-link', text: 'Import all…',
        onClick: async () => {
          const text = await pickJSONFile();
          if (!text) return;
          try {
            const result = importSavedProjectsBundle(JSON.parse(text));
            if (result.ok) { showToast(`Imported ${result.imported} project(s).`, 'success'); renderList(); }
            else showToast(result.error, 'error');
          } catch {
            showToast('Invalid JSON file.', 'error');
          }
        },
      }));
      subheadingRow.appendChild(bundleActions);
      body.appendChild(subheadingRow);

      const favFilter = el('label', { class: 'field field-checkbox saved-project-fav-filter' });
      const favFilterInput = el('input', {
        type: 'checkbox', checked: favoritesOnly,
        onChange: (e) => { favoritesOnly = e.target.checked; renderList(); },
      });
      favFilter.appendChild(favFilterInput);
      favFilter.appendChild(el('span', { text: '⭐ Favorites only' }));
      body.appendChild(favFilter);

      const list = el('div', { class: 'saved-project-list' });
      body.appendChild(list);

      const renderList = () => {
        clear(list);
        const allProjects = listSavedProjects();
        const projects = favoritesOnly ? allProjects.filter((p) => p.favorite) : allProjects;
        if (!allProjects.length) {
          list.appendChild(el('p', { class: 'sidebar-empty', text: 'No saved projects yet — use "Save As" first.' }));
          return;
        }
        if (!projects.length) {
          list.appendChild(el('p', { class: 'sidebar-empty', text: 'No favorite projects yet — click the star on a saved project.' }));
          return;
        }
        for (const p of projects) {
          const row = el('div', { class: 'saved-project-row' });
          const favBtn = el('button', {
            type: 'button',
            class: `btn btn-icon saved-project-fav-btn${p.favorite ? ' is-favorite' : ''}`,
            title: p.favorite ? 'Remove from favorites' : 'Add to favorites',
            'aria-label': p.favorite ? 'Remove from favorites' : 'Add to favorites',
            text: p.favorite ? '★' : '☆',
            onClick: () => { toggleFavorite(p.id); renderList(); },
          });
          row.appendChild(favBtn);

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
