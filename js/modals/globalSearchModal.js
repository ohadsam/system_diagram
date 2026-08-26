// "Search All Projects" — reaches into every SAVED project (not just the
// one currently open), unlike the sidebar's search (the component library)
// or the toolbar's "Find on canvas" (this diagram only). See
// io/globalProjectSearch.js for the actual matching logic.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { getRawSavedProjects, loadNamedProject } from '../io/projects.js';
import { searchSavedProjects, MATCH_LABEL } from '../io/globalProjectSearch.js';
import { showToast } from '../utils/toast.js';

const MAX_SNIPPETS_PER_PROJECT = 4;

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

export function openGlobalSearchModal() {
  let query = '';

  openModal({
    title: '🔎 Search All Projects',
    className: 'global-search-modal',
    render: (body, api) => {
      const input = el('input', {
        type: 'search',
        class: 'global-search-input',
        placeholder: 'Search component names, notes, connector labels, comments…',
        onInput: (e) => { query = e.target.value; renderResults(); },
      });
      body.appendChild(input);
      setTimeout(() => input.focus(), 0);

      const results = el('div', { class: 'global-search-results' });
      body.appendChild(results);

      const renderResults = () => {
        clear(results);
        const trimmed = query.trim();
        if (!trimmed) {
          results.appendChild(el('p', { class: 'sidebar-empty', text: 'Type to search across every saved project in this browser (not just the one currently open).' }));
          return;
        }
        const matches = searchSavedProjects(getRawSavedProjects(), trimmed);
        if (!matches.length) {
          results.appendChild(el('p', { class: 'sidebar-empty', text: `No saved projects match "${trimmed}".` }));
          return;
        }
        for (const project of matches) {
          const row = el('div', { class: 'global-search-row' });
          const info = el('div', { class: 'global-search-info' });
          info.appendChild(el('span', { class: 'global-search-name', text: project.name }));
          info.appendChild(el('span', { class: 'global-search-meta', text: `${project.matches.length} match${project.matches.length === 1 ? '' : 'es'} · ${formatDate(project.updatedAt)}` }));

          const snippets = el('div', { class: 'global-search-snippets' });
          for (const m of project.matches.slice(0, MAX_SNIPPETS_PER_PROJECT)) {
            snippets.appendChild(el('span', { class: 'global-search-snippet', text: `${MATCH_LABEL[m.kind] || m.kind}: "${m.text}"` }));
          }
          if (project.matches.length > MAX_SNIPPETS_PER_PROJECT) {
            snippets.appendChild(el('span', { class: 'global-search-snippet global-search-snippet-more', text: `+${project.matches.length - MAX_SNIPPETS_PER_PROJECT} more` }));
          }
          info.appendChild(snippets);
          row.appendChild(info);

          row.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary btn-sm', text: 'Load',
            onClick: () => {
              const result = loadNamedProject(project.id);
              if (!result.ok) { showToast(result.error, 'error'); return; }
              store.loadProject(result.project);
              showToast(`Loaded "${result.project.name}".`, 'success');
              api.close();
            },
          }));
          results.appendChild(row);
        }
      };

      renderResults();
    },
  });
}
