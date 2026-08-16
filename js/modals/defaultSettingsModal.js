// "Default Settings" modal: global new-component defaults (background,
// icon, text position, sub-components display). Always overridable per
// component afterwards via the toolbar / details panel — see
// docs/SPEC.md 4.2.5.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, checkbox, selectInput } from '../utils/formControls.js';
import { TEXT_POSITIONS, SUBCOMPONENTS_DISPLAY_MODES } from '../core/project.js';
import { getNodeDefaults, saveNodeDefaults } from '../io/nodeDefaults.js';
import { getLibrarySettings, saveLibrarySettings } from '../io/librarySettings.js';
import { getUiPrefs, saveUiPrefs, CONTEXT_ROW_MODES } from '../io/uiPrefs.js';
import * as store from '../core/store.js';
import { showToast } from '../utils/toast.js';

const CONTEXT_ROW_MODE_LABELS = {
  floating: 'Floating — pops up next to whatever\'s selected',
  'pinned-top': 'Pinned to top of the screen',
  'pinned-bottom': 'Pinned to bottom of the screen',
};

const TEXT_POSITION_LABELS = {
  center: 'Center (inside)',
  top: 'Top (inside)',
  bottom: 'Bottom (inside)',
  above: 'Above the shape',
  below: 'Below the shape',
};
const SUBCOMPONENTS_DISPLAY_LABELS = {
  chips: 'Compact chips',
  full: 'Full list',
};

export function openDefaultSettingsModal() {
  const model = { ...getNodeDefaults() };
  const libraryModel = { ...getLibrarySettings() };
  const uiPrefsModel = { ...getUiPrefs() };

  openModal({
    title: 'Default component settings',
    className: 'default-settings-modal',
    render: (body, api) => {
      const form = el('div', { class: 'modal-form' });
      form.appendChild(el('p', { class: 'modal-hint', text: 'These apply to newly added components. Any single component can still be styled differently at any time.' }));

      form.appendChild(checkbox(model.transparentFill, (v) => { model.transparentFill = v; }, 'No background color (transparent fill)'));
      form.appendChild(checkbox(model.showIcon, (v) => { model.showIcon = v; }, 'Show icon'));
      form.appendChild(field('Text position', selectInput(TEXT_POSITIONS, model.textPosition, (v) => { model.textPosition = v; }, TEXT_POSITION_LABELS)));
      form.appendChild(field('Sub-components display', selectInput(SUBCOMPONENTS_DISPLAY_MODES, model.subComponentsDisplay, (v) => { model.subComponentsDisplay = v; }, SUBCOMPONENTS_DISPLAY_LABELS)));

      form.appendChild(el('h3', { class: 'modal-subheading', text: 'Style editor' }));
      form.appendChild(field('When a component/connector is selected, show its style editor', selectInput(
        CONTEXT_ROW_MODES,
        uiPrefsModel.contextRowMode,
        (v) => { uiPrefsModel.contextRowMode = v; saveUiPrefs(uiPrefsModel); },
        CONTEXT_ROW_MODE_LABELS,
      )));

      form.appendChild(el('h3', { class: 'modal-subheading', text: 'Component library' }));
      form.appendChild(checkbox(libraryModel.hideStateMachines, (v) => { libraryModel.hideStateMachines = v; saveLibrarySettings(libraryModel); }, 'Hide "State Machines" components & templates from the sidebar'));
      form.appendChild(checkbox(
        libraryModel.suggestionsEnabled,
        (v) => { libraryModel.suggestionsEnabled = v; saveLibrarySettings(libraryModel); },
        'Show "Smart Suggestions" (companion components) after placing a component',
      ));

      const actions = el('div', { class: 'modal-actions' });
      const secondary = el('div', { class: 'modal-actions-secondary' });
      secondary.appendChild(el('button', {
        type: 'button',
        class: 'btn-link',
        text: 'Apply to all existing components now',
        title: 'Also updates every component already on this canvas to match (one undo step)',
        onClick: () => {
          saveNodeDefaults(model);
          const count = applyDefaultsToAllNodes(model);
          showToast(`Saved defaults and updated ${count} existing component${count === 1 ? '' : 's'}.`, 'success');
          api.close();
        },
      }));
      actions.appendChild(secondary);

      const primary = el('div', { class: 'modal-actions-primary' });
      primary.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      primary.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: 'Save',
        onClick: () => {
          saveNodeDefaults(model);
          showToast('Default settings saved. New components will use them.', 'success');
          api.close();
        },
      }));
      actions.appendChild(primary);
      form.appendChild(actions);

      body.appendChild(form);
    },
  });
}

function applyDefaultsToAllNodes(defaults) {
  const state = store.getState();
  const count = state.nodes.length;
  store.dispatch((draft) => {
    for (const n of draft.nodes) {
      n.fill = defaults.transparentFill ? 'transparent' : (n.fill === 'transparent' ? '#FFFFFF' : n.fill);
      n.iconVisible = !!defaults.showIcon;
      n.textPosition = defaults.textPosition;
      n.subComponentsDisplay = defaults.subComponentsDisplay;
    }
  });
  return count;
}
