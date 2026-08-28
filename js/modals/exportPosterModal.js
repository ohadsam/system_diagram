// "🧩 Export PDF (Poster)" — picks a page size, then tiles the diagram
// across that many same-size pages for printing and physically assembling
// into one big poster (see io/exportPdf.js#exportPdfTiled). A small, single-
// choice modal rather than a toolbar one-click button (unlike the plain PNG/
// PDF/SVG exports) because a page size actually needs picking first.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { exportPdfTiled, POSTER_PAGE_SIZES } from '../io/exportPdf.js';
import { showToast } from '../utils/toast.js';

export function openExportPosterModal() {
  let pageFormat = 'a4';

  openModal({
    title: '🧩 Export PDF (Poster)',
    className: 'export-poster-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Splits the diagram across several same-size pages, each with its page number and grid position printed in the corner — print them and tape/glue the edges together for a wall-size poster of a large diagram.',
      }));

      const select = el('select', { class: 'export-poster-select' },
        Object.entries(POSTER_PAGE_SIZES).map(([id, size]) => el('option', { value: id, text: size.label })));
      select.value = pageFormat;
      select.addEventListener('change', () => { pageFormat = select.value; });
      body.appendChild(select);

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', {
        type: 'button', class: 'btn', text: '⬇️ Export',
        onClick: async () => {
          showToast('Rendering poster pages…', 'info', 1800);
          const result = await exportPdfTiled(store.getState().name, pageFormat);
          if (!result.ok) { showToast(result.error, 'error'); return; }
          showToast(`Exported ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}.`, 'success', 2600);
          api.close();
        },
      }));
      body.appendChild(actions);
    },
  });
}
