// "Save selection as custom component" — turns 2+ selected components (plus
// their connectors) into one reusable "My Components" item, with or without
// a prior Group action. See canvas.js#buildGroupSnapshotFromSelection for
// how the selection's exact styling/positions/connectors are captured, and
// instantiatePattern for how it's rebuilt on drop. A single-node selection
// instead reuses the richer, editable customComponentModal.js flow — see
// toolbar.js's dispatcher.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, textInput } from '../utils/formControls.js';
import { saveCustomComponent } from '../io/customComponents.js';
import { showToast } from '../utils/toast.js';
import { buildGroupSnapshotFromSelection } from '../canvas/canvas.js';
import { FOLDER_DATALIST_ID, ensureFolderDatalist } from '../utils/folderDatalist.js';

export function openSaveComponentGroupModal() {
  const snapshot = buildGroupSnapshotFromSelection();
  if (!snapshot) {
    showToast('Select at least one component first.', 'error');
    return;
  }
  const model = { name: '', icon: '🧩', folder: '', tags: [] };
  ensureFolderDatalist();

  openModal({
    title: 'Save selection as custom component',
    className: 'custom-component-modal',
    render: (body, api) => {
      const form = el('div', { class: 'modal-form' });
      const countLabel = `${snapshot.nodeCount} component${snapshot.nodeCount === 1 ? '' : 's'}`;
      form.appendChild(el('p', {
        class: 'modal-hint',
        text: `Saves the selected ${countLabel} — with their exact styling and connectors — as one reusable item in "My Components". Drop it again anywhere to recreate the whole group at once.`,
      }));

      const row1 = el('div', { class: 'field-row' });
      row1.appendChild(field('Icon (emoji)', textInput(model.icon, (v) => { model.icon = v; }, { maxLength: 4 })));
      row1.appendChild(field('Name', textInput(model.name, (v) => { model.name = v; }, { placeholder: 'My Component Group', required: true })));
      form.appendChild(row1);

      form.appendChild(field('Folder (optional)', textInput(model.folder, (v) => { model.folder = v; }, { placeholder: 'e.g. "AWS", "Backend"…', list: FOLDER_DATALIST_ID })));
      form.appendChild(field('Tags (comma separated, helps search)', textInput('', (v) => { model.tags = v.split(',').map((t) => t.trim()).filter(Boolean); })));

      const actions = el('div', { class: 'modal-actions' });
      const buttons = el('div', { class: 'modal-actions-primary' });
      buttons.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      buttons.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: 'Save to My Components',
        onClick: () => {
          if (!model.name.trim()) { showToast('Please enter a name.', 'error'); return; }
          saveCustomComponent({
            name: model.name.trim(),
            icon: model.icon || '🧩',
            kind: 'pattern',
            shape: 'rounded',
            color: '#0F766E',
            fill: '#F0FDFA',
            description: `Saved group of ${countLabel}.`,
            folder: model.folder,
            tags: model.tags,
            subComponents: [],
            defaultSize: { w: 1, h: 1 },
            pattern: snapshot.pattern,
            groupOnInstantiate: snapshot.nodeCount > 1,
            ...(snapshot.startShrunk ? { startShrunk: true, shrinkAnchorKey: snapshot.shrinkAnchorKey } : {}),
          });
          showToast(`Saved "${model.name.trim()}" to My Components.`, 'success');
          api.close();
        },
      }));
      actions.appendChild(buttons);
      form.appendChild(actions);

      body.appendChild(form);
    },
  });
}
