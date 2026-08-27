// "Default Settings" modal: global new-component defaults (background,
// icon, text position, sub-components display), plus a few other
// app-wide preferences that belong in one settings surface rather than
// scattered toolbar toggles — see docs/SPEC.md 4.2.5.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { field, checkbox, selectInput, textInput } from '../utils/formControls.js';
import { TEXT_POSITIONS, SUBCOMPONENTS_DISPLAY_MODES } from '../core/project.js';
import { getNodeDefaults, saveNodeDefaults } from '../io/nodeDefaults.js';
import { getLibrarySettings, saveLibrarySettings } from '../io/librarySettings.js';
import { getUiPrefs, saveUiPrefs, CONTEXT_ROW_MODES } from '../io/uiPrefs.js';
import {
  AI_SEND_MODES, DIRECT_CAPABLE_PROVIDERS, getAiProviderSettings, setAiSendMode,
  setProviderCredentials, addCustomProvider, updateCustomProvider, removeCustomProvider,
  clearAllAiProviderKeys,
} from '../io/aiProviderKeys.js';
import * as store from '../core/store.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';

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

const AI_SEND_MODE_LABELS = {
  handoff: 'Copy/Paste (default — no setup, no key ever leaves your clipboard)',
  direct: 'Direct API calls (uses the keys saved below)',
};

export function openDefaultSettingsModal() {
  const model = { ...getNodeDefaults() };
  const libraryModel = { ...getLibrarySettings() };
  const uiPrefsModel = { ...getUiPrefs() };

  openModal({
    title: 'Default component settings',
    className: 'default-settings-modal',
    render: (body, api) => {
      const renderForm = () => {
        clear(body);
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

        form.appendChild(buildAiProvidersSection(renderForm));

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
      };

      renderForm();
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

/** "🤖 AI Providers" section — configures Direct API mode (io/aiProviderKeys.js,
 * io/aiDirectCall.js), the opt-in alternative to this app's default
 * "copy a prompt, open the provider's website, paste the reply back"
 * hand-off flow used by AI Design Review / Generate Design from Spec /
 * Edit with AI. Every field here saves immediately (like the Style editor
 * and Component library sections above) rather than waiting for this
 * modal's own "Save" button — a credential is worth persisting the moment
 * it's typed, not lost if the user closes the modal a different way. */
function buildAiProvidersSection(renderForm) {
  const settings = getAiProviderSettings();
  const wrap = el('div', { class: 'ai-provider-settings' });
  wrap.appendChild(el('h3', { class: 'modal-subheading', text: '🤖 AI Providers' }));
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'Every AI-assisted feature defaults to Copy/Paste: it prepares a prompt (and, for AI Design Review, the diagram image) and opens the provider\'s own website for you to paste it into — no key, no setup, nothing ever leaves your clipboard. "Direct API calls" skips that for any provider you\'ve added a key for below; the Copy/Paste option stays available right alongside it either way, in case a direct call fails.' }));

  wrap.appendChild(el('p', { class: 'ai-provider-settings-warning' }, [
    el('strong', { text: '⚠️ Not fully secure: ' }),
    el('span', { text: 'an API key saved here is stored in this browser (like everything else in this app) so it can be sent with each request — it is not encrypted, and anyone with access to this browser profile or its developer tools could read it. Only save a key here on a device you trust, and prefer a key scoped to this specific use if your provider supports that.' }),
  ]));

  wrap.appendChild(field('Sending mode', selectInput(AI_SEND_MODES, settings.mode, async (next) => {
    if (next === 'handoff' && (Object.keys(settings.providers).length || settings.customProviders.length)) {
      const ok = await confirmAction({
        title: 'Switch to Copy/Paste mode?',
        message: 'This deletes every API key saved below (built-in and custom providers alike) — the whole point of switching back is to stop keeping them around. This can\'t be undone from here; you\'d need to re-enter them to switch back to Direct mode later.',
        confirmLabel: 'Switch & delete keys',
      });
      if (!ok) { renderForm(); return; }
    }
    setAiSendMode(next);
    showToast(next === 'direct' ? 'Direct API calls enabled.' : 'Switched to Copy/Paste — every saved API key was deleted.', 'success');
    renderForm();
  }, AI_SEND_MODE_LABELS)));

  for (const provider of DIRECT_CAPABLE_PROVIDERS) {
    const saved = settings.providers[provider.id];
    const row = el('div', { class: 'ai-provider-settings-row' });
    row.appendChild(el('span', { class: 'ai-provider-settings-name', text: provider.name }));
    const keyInput = textInput(saved?.apiKey || '', () => {}, {
      type: 'password', autocomplete: 'off', placeholder: 'API key',
      onBlur: (e) => { setProviderCredentials(provider.id, { apiKey: e.target.value, model: modelInput.value }); renderForm(); },
    });
    const modelInput = textInput(saved?.model || '', () => {}, {
      placeholder: provider.defaultModel,
      title: `Model to use (default: ${provider.defaultModel})`,
      onBlur: (e) => { setProviderCredentials(provider.id, { apiKey: keyInput.value, model: e.target.value }); renderForm(); },
    });
    row.appendChild(keyInput);
    row.appendChild(modelInput);
    wrap.appendChild(row);
  }

  if (settings.customProviders.length) {
    wrap.appendChild(el('p', { class: 'field-label', text: 'Custom providers (OpenAI-compatible)' }));
    for (const provider of settings.customProviders) {
      const row = el('div', { class: 'ai-provider-settings-row ai-provider-settings-custom' });
      row.appendChild(textInput(provider.name, (v) => updateCustomProvider(provider.id, { name: v }), { placeholder: 'Name' }));
      row.appendChild(textInput(provider.baseUrl, (v) => updateCustomProvider(provider.id, { baseUrl: v }), { placeholder: 'Full endpoint URL (…/chat/completions)' }));
      row.appendChild(textInput(provider.apiKey, (v) => updateCustomProvider(provider.id, { apiKey: v }), { type: 'password', autocomplete: 'off', placeholder: 'API key' }));
      row.appendChild(textInput(provider.model, (v) => updateCustomProvider(provider.id, { model: v }), { placeholder: 'Model' }));
      row.appendChild(el('button', {
        type: 'button', class: 'btn btn-icon', text: '×', 'aria-label': `Remove ${provider.name}`,
        onClick: () => { removeCustomProvider(provider.id); renderForm(); },
      }));
      wrap.appendChild(row);
    }
  }

  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-secondary', text: '+ Add custom provider…',
    title: 'Any provider that speaks the same request/response shape as OpenAI\'s chat completions API',
    onClick: () => { addCustomProvider({ name: 'Custom provider' }); renderForm(); },
  }));

  const hasAnyKeys = Object.keys(settings.providers).length > 0 || settings.customProviders.length > 0;
  wrap.appendChild(el('div', { class: 'field-row ai-provider-settings-clear-row' }, [
    el('button', {
      type: 'button', class: 'btn btn-danger', text: '🗑️ Clear API Keys', disabled: !hasAnyKeys,
      onClick: async () => {
        const ok = await confirmAction({
          title: 'Clear every saved API key?',
          message: 'Deletes every built-in and custom provider key saved here. This can\'t be undone.',
          confirmLabel: 'Clear keys',
        });
        if (!ok) return;
        clearAllAiProviderKeys();
        showToast('Every saved API key was deleted.', 'success');
        renderForm();
      },
    }),
  ]));

  return wrap;
}
