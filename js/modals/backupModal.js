// "Backup & Restore" modal: one place to export/import everything (full
// backup), or just the My Components library, or just the saved-projects
// library — each with its own collision-handling rules (see their io/*.js).
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { pickJSONFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import { exportFullBackup, importFullBackupFile } from '../io/fullBackup.js';
import { exportCustomComponents, importCustomComponents } from '../io/customComponents.js';
import { exportAllSavedProjects, importSavedProjectsBundle } from '../io/projects.js';
import { getStorageBackend, switchStorageBackend, STORAGE_BACKENDS } from '../io/storage.js';

const BACKEND_LABEL = { localStorage: 'localStorage (default)', indexeddb: 'IndexedDB' };

function storageBackendSection() {
  const wrap = el('div', { class: 'backup-section' });
  wrap.appendChild(el('h3', { class: 'modal-subheading', text: '💽 Storage backend' }));
  wrap.appendChild(el('p', {
    class: 'backup-section-desc',
    text: 'Where everything above — saved projects, backups, My Components, and every other setting — actually lives in this browser. localStorage needs no setup but is usually capped around 5-10MB; IndexedDB has a much larger quota, useful if you keep many or large saved projects. Switching copies everything from the current backend into the new one first — nothing is deleted from the old one, so you can always switch back.',
  }));

  const select = el('select', { class: 'storage-backend-select' },
    STORAGE_BACKENDS.map((b) => el('option', { value: b, text: BACKEND_LABEL[b], selected: b === getStorageBackend() || undefined })));

  const status = el('p', { class: 'backup-section-desc storage-backend-status', text: `Currently active: ${BACKEND_LABEL[getStorageBackend()]}.` });

  const switchBtn = el('button', {
    type: 'button', class: 'btn btn-secondary', text: 'Switch & copy data…',
    onClick: async () => {
      const next = select.value;
      const current = getStorageBackend();
      if (next === current) { showToast(`Already using ${BACKEND_LABEL[current]}.`, 'info'); return; }
      const ok = await confirmAction({
        title: `Switch to ${BACKEND_LABEL[next]}?`,
        message: `This copies everything currently stored in ${BACKEND_LABEL[current]} into ${BACKEND_LABEL[next]} and makes it the active backend. Nothing is deleted from ${BACKEND_LABEL[current]} — you can switch back the same way at any time. The page will reload afterward.`,
        confirmLabel: 'Switch',
      });
      if (!ok) return;
      switchBtn.disabled = true;
      const result = await switchStorageBackend(next);
      if (!result.ok) {
        switchBtn.disabled = false;
        showToast(result.error, 'error');
        return;
      }
      showToast(`Switched to ${BACKEND_LABEL[next]} (copied ${result.movedCount} item(s)). Reloading…`, 'success', 2400);
      setTimeout(() => window.location.reload(), 900);
    },
  });

  const row = el('div', { class: 'field-row storage-backend-row' }, [select, switchBtn]);
  wrap.appendChild(row);
  wrap.appendChild(status);
  return wrap;
}

function section(title, description, exportBtn, importBtn) {
  const wrap = el('div', { class: 'backup-section' });
  wrap.appendChild(el('h3', { class: 'modal-subheading', text: title }));
  wrap.appendChild(el('p', { class: 'backup-section-desc', text: description }));
  const actions = el('div', { class: 'modal-actions-secondary' });
  actions.appendChild(exportBtn);
  actions.appendChild(importBtn);
  wrap.appendChild(actions);
  return wrap;
}

export function openBackupModal() {
  openModal({
    title: 'Backup & Storage',
    className: 'backup-modal',
    render: (body) => {
      body.appendChild(section(
        '📦 Full backup',
        'Everything: the current canvas, default settings, My Components and every saved project, in one file.',
        el('button', { type: 'button', class: 'btn btn-secondary', text: 'Export full backup…', onClick: exportFullBackup }),
        el('button', {
          type: 'button', class: 'btn btn-secondary', text: 'Restore full backup…',
          onClick: async () => {
            const text = await pickJSONFile();
            if (!text) return;
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              showToast('Invalid JSON file.', 'error');
              return;
            }
            const ok = await confirmAction({
              title: 'Restore full backup?',
              message: 'This replaces the current canvas and default settings, and merges the backup\'s My Components, saved projects, and Favorites into your library. This cannot be undone.',
              confirmLabel: 'Restore',
              danger: true,
            });
            if (!ok) return;
            const result = importFullBackupFile(parsed);
            if (!result.ok) { showToast(result.error, 'error'); return; }
            showToast(`Restored backup: ${result.importedComponents} component(s), ${result.importedProjects} project(s), ${result.importedFavorites} favorite(s).`, 'success');
          },
        }),
      ));

      body.appendChild(section(
        '✨ My Components only',
        'Just your custom component library.',
        el('button', { type: 'button', class: 'btn btn-secondary', text: 'Export…', onClick: exportCustomComponents }),
        el('button', {
          type: 'button', class: 'btn btn-secondary', text: 'Import…',
          onClick: async () => {
            const text = await pickJSONFile();
            if (!text) return;
            try {
              const result = importCustomComponents(JSON.parse(text));
              if (result.ok) showToast(`Imported ${result.imported} component(s).`, 'success');
              else showToast(result.error, 'error');
            } catch {
              showToast('Invalid JSON file.', 'error');
            }
          },
        }),
      ));

      body.appendChild(section(
        '📂 Saved projects only',
        'Every project saved via "Save As", all together.',
        el('button', { type: 'button', class: 'btn btn-secondary', text: 'Export all…', onClick: exportAllSavedProjects }),
        el('button', {
          type: 'button', class: 'btn btn-secondary', text: 'Import all…',
          onClick: async () => {
            const text = await pickJSONFile();
            if (!text) return;
            try {
              const result = importSavedProjectsBundle(JSON.parse(text));
              if (result.ok) showToast(`Imported ${result.imported} project(s).`, 'success');
              else showToast(result.error, 'error');
            } catch {
              showToast('Invalid JSON file.', 'error');
            }
          },
        }),
      ));

      body.appendChild(storageBackendSection());
    },
  });
}
