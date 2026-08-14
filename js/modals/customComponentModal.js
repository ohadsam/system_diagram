// "New Component" modal: build a custom styled component (optionally
// seeded from the current selection) and save it into "My Components".
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { field, colorInput, textInput, selectInput } from '../utils/formControls.js';
import { SHAPES } from '../core/project.js';
import { saveCustomComponent, exportCustomComponents, importCustomComponents } from '../io/customComponents.js';
import { pickJSONFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';
import { LAYER_DATALIST_ID, ensureLayerDatalist, findLayerByName } from '../utils/layerDatalist.js';

const SHAPE_LABELS = {
  rect: 'Rectangle', rounded: 'Rounded rectangle', circle: 'Circle', diamond: 'Diamond',
  cylinder: 'Cylinder (DB)', hexagon: 'Hexagon', cloud: 'Cloud', note: 'Sticky note', rows: 'Server with rows',
};

export function openCustomComponentModal({ editDef = null, seedFromNode = null } = {}) {
  const model = editDef
    ? { ...editDef, tags: [...(editDef.tags || [])], subComponents: (editDef.subComponents || []).map((s) => ({ ...s })) }
    : {
        id: null,
        name: seedFromNode?.text || '',
        icon: seedFromNode?.icon || '⬛',
        shape: seedFromNode?.shape || 'rounded',
        color: seedFromNode?.stroke || '#4F46E5',
        fill: seedFromNode?.fill || '#EEF2FF',
        description: '',
        tags: [],
        subComponents: (seedFromNode?.subComponents || []).map((s) => ({ name: s.name, icon: s.icon })),
        defaultSize: seedFromNode ? { w: seedFromNode.w, h: seedFromNode.h } : { w: 160, h: 84 },
      };

  openModal({
    title: editDef ? 'Edit component' : 'New component',
    className: 'custom-component-modal',
    render: (body, api) => {
      const form = el('div', { class: 'modal-form' });

      const row1 = el('div', { class: 'field-row' });
      row1.appendChild(field('Icon (emoji)', textInput(model.icon, (v) => { model.icon = v; }, { maxLength: 4 })));
      row1.appendChild(field('Name', textInput(model.name, (v) => { model.name = v; }, { placeholder: 'My Component', required: true })));
      form.appendChild(row1);

      const row2 = el('div', { class: 'field-row' });
      row2.appendChild(field('Fill color', colorInput(model.fill, (v) => { model.fill = v; })));
      row2.appendChild(field('Border color', colorInput(model.color, (v) => { model.color = v; })));
      row2.appendChild(field('Shape', selectInput(SHAPES, model.shape, (v) => { model.shape = v; }, SHAPE_LABELS)));
      form.appendChild(row2);

      form.appendChild(field('Description', textInput(model.description, (v) => { model.description = v; }, { placeholder: 'Shown as a tooltip in the sidebar' })));
      form.appendChild(field('Tags (comma separated, helps search)', textInput(model.tags.join(', '), (v) => { model.tags = v.split(',').map((t) => t.trim()).filter(Boolean); })));

      form.appendChild(el('h3', { class: 'modal-subheading', text: 'Default sub-components' }));
      const subList = el('div', { class: 'subcomponent-editor' });
      const renderSubs = () => {
        clear(subList);
        model.subComponents.forEach((sc, idx) => {
          const row = el('div', { class: 'field-row subcomponent-row' });
          row.appendChild(textInput(sc.icon, (v) => { sc.icon = v; }, { maxLength: 4, class: 'sub-icon-input', placeholder: '🔧' }));
          const nameInput = textInput(sc.name, (v) => { sc.name = v; }, { placeholder: 'Name — try "Controller", "DAL"…', list: LAYER_DATALIST_ID });
          nameInput.addEventListener('change', () => {
            const match = findLayerByName(nameInput.value);
            if (match && !sc.icon) { sc.icon = match.icon; renderSubs(); }
          });
          row.appendChild(nameInput);
          row.appendChild(el('button', {
            type: 'button', class: 'btn btn-icon', text: '×', 'aria-label': 'Remove',
            onClick: () => { model.subComponents.splice(idx, 1); renderSubs(); },
          }));
          subList.appendChild(row);
        });
      };
      renderSubs();
      form.appendChild(subList);
      form.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary', text: '+ Add sub-component',
        onClick: () => { model.subComponents.push({ name: '', icon: '' }); renderSubs(); },
      }));

      const actions = el('div', { class: 'modal-actions' });
      const libraryActions = el('div', { class: 'modal-actions-secondary' });
      libraryActions.appendChild(el('button', { type: 'button', class: 'btn-link', text: 'Export My Components…', onClick: exportCustomComponents }));
      libraryActions.appendChild(el('button', {
        type: 'button', class: 'btn-link', text: 'Import My Components…',
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
      }));
      actions.appendChild(libraryActions);

      const buttons = el('div', { class: 'modal-actions-primary' });
      buttons.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      buttons.appendChild(el('button', {
        type: 'button', class: 'btn btn-primary', text: editDef ? 'Save changes' : 'Save to My Components',
        onClick: () => {
          if (!model.name.trim()) { showToast('Please enter a name.', 'error'); return; }
          model.subComponents = model.subComponents.filter((s) => s.name.trim());
          saveCustomComponent(model);
          showToast(`Saved "${model.name}" to My Components.`, 'success');
          api.close();
        },
      }));
      actions.appendChild(buttons);
      form.appendChild(actions);

      body.appendChild(form);
    },
  });
}
