// "🔗 Import from URL/Gist" — loads a diagram JSON hosted elsewhere (a raw
// GitHub file, a Gist, any static JSON URL), the counterpart to io/
// shareLink.js's URL-encoded link for when the file already lives
// somewhere public. Same confirm-before-replace pattern as every other
// "loads a whole new project" flow here (modals/quickStartModal.js,
// canvas.js#loadDemoProject).
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { fetchProjectFromUrl } from '../io/importFromUrl.js';
import { confirmAction } from './confirmModal.js';
import { showToast } from '../utils/toast.js';

export function openImportFromUrlModal() {
  let url = '';
  let loading = false;
  let error = '';

  openModal({
    title: '🔗 Import from URL/Gist',
    className: 'import-url-modal',
    render: (body, api) => {
      const renderBody = () => {
        clear(body);
        body.appendChild(el('p', {
          class: 'modal-hint',
          text: 'Paste a link to a diagram JSON file — a GitHub "raw" file link, a Gist (public, any file in it), or any URL that returns this app\'s JSON format directly.',
        }));

        const input = el('input', {
          type: 'text', class: 'import-url-input', placeholder: 'https://gist.github.com/... or https://.../diagram.json',
          value: url,
          onInput: (e) => { url = e.target.value; },
        });
        body.appendChild(input);

        if (error) body.appendChild(el('p', { class: 'import-url-error', text: error }));

        const actions = el('div', { class: 'modal-actions' });
        actions.appendChild(el('button', {
          type: 'button', class: 'btn', text: loading ? 'Fetching…' : '⬇️ Import',
          disabled: loading,
          onClick: async () => {
            if (!url.trim()) { error = 'Paste a URL first.'; renderBody(); return; }
            loading = true;
            error = '';
            renderBody();
            const result = await fetchProjectFromUrl(url);
            loading = false;
            if (!result.ok) {
              error = result.error;
              renderBody();
              return;
            }
            const currentHasContent = store.getState().nodes.length > 0;
            if (currentHasContent) {
              const proceed = await confirmAction({
                title: 'Replace the current canvas?',
                message: 'This loads the imported diagram in place of what\'s on the canvas now. If you want to keep your current diagram, use "Save As" first — undo (Ctrl/Cmd+Z) can also bring it right back.',
                confirmLabel: 'Replace',
                danger: false,
              });
              if (!proceed) { renderBody(); return; }
            }
            store.loadProject(result.project);
            showToast(`Imported "${result.project.name}" (${result.project.nodes.length} components).`, 'success', 2800);
            api.close();
          },
        }));
        body.appendChild(actions);
      };

      renderBody();
    },
  });
}
