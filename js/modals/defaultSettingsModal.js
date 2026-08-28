// "Default Settings" modal: global new-component defaults (background,
// icon, text position, sub-components display), plus a few other
// app-wide preferences that belong in one settings surface rather than
// scattered toolbar toggles — see docs/SPEC.md 4.2.5.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { field, checkbox, selectInput, textInput, numberInput } from '../utils/formControls.js';
import { TEXT_POSITIONS, SUBCOMPONENTS_DISPLAY_MODES } from '../core/project.js';
import { getNodeDefaults, saveNodeDefaults } from '../io/nodeDefaults.js';
import { getLibrarySettings, saveLibrarySettings } from '../io/librarySettings.js';
import { getUiPrefs, saveUiPrefs, CONTEXT_ROW_MODES } from '../io/uiPrefs.js';
import {
  AI_SEND_MODES, DIRECT_CAPABLE_PROVIDERS, LOCAL_MODEL_CHOICES, getAiProviderSettings, setAiSendMode,
  setProviderCredentials, addCustomProvider, updateCustomProvider, removeCustomProvider,
  clearAllAiProviderKeys, setLocalModel, setAutoSuggestConfig, isAutomaticSendConfigured,
} from '../io/aiProviderKeys.js';
import { isWebGpuSupported, preloadLocalModel } from '../io/webllmEngine.js';
import * as store from '../core/store.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import { FEATURE_MODES, FEATURE_PACKS } from '../core/featureLevels.js';
import { getFeatureLevelPrefs, saveFeatureLevelPrefs } from '../io/featureLevelPrefs.js';

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
  local: 'Local AI in your browser (no key, no account — see below)',
};

const FEATURE_MODE_LABELS = {
  basic: '🌱 Basic — hide advanced/power-user tools (recommended for new users)',
  advanced: '🚀 Advanced — show every tool',
  custom: '🎛️ Custom — choose exactly which tool groups to show',
};

export function openDefaultSettingsModal({ scrollToAiProviders = false, scrollToFeatureLevel = false } = {}) {
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
        form.appendChild(checkbox(
          libraryModel.compactSidebar,
          (v) => { libraryModel.compactSidebar = v; saveLibrarySettings(libraryModel); },
          'Compact sidebar: show only Favorites, Recently Used and My Components by default (same toggle as the sidebar\'s own 🗂️ button)',
        ));

        form.appendChild(buildFeatureLevelSection(renderForm));

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
        if (scrollToAiProviders) {
          // One-shot: only the modal's very first open (e.g. from Quick
          // Start's "⚙️ Set up AI now" link) should jump straight to this
          // section — a later re-render from within the same modal (any
          // field's onChange calls renderForm()) shouldn't re-scroll out
          // from under someone who has since scrolled elsewhere.
          scrollToAiProviders = false;
          requestAnimationFrame(() => form.querySelector('.ai-provider-settings')?.scrollIntoView({ block: 'start' }));
        }
        if (scrollToFeatureLevel) {
          // Same one-shot pattern as scrollToAiProviders just above — e.g.
          // the progressive-unlock suggestion banner's "⚙️ Show me" link
          // (hints/featureSuggestionBanner.js) and the Command Palette's
          // own "Feature Level Settings" entry both jump straight here.
          scrollToFeatureLevel = false;
          requestAnimationFrame(() => form.querySelector('.feature-level-settings')?.scrollIntoView({ block: 'start' }));
        }
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

/** "🧩 Feature Level" section — the Basic/Advanced/Custom toggle from
 * core/featureLevels.js. This app has accumulated a very large number of
 * toolbar actions across many batches; Basic mode hides everything but a
 * small always-visible core, Advanced shows everything (this app's
 * original, pre-this-feature behavior), and Custom lets someone pick
 * exactly which packs they want. Every field here saves immediately (same
 * convention as the Component library checkboxes above), and toolbar.js
 * reacts live via io/featureLevelPrefs.js's onFeatureLevelChange — no
 * reload needed, unlike the Language toggle elsewhere in this modal. */
function buildFeatureLevelSection(renderForm) {
  const prefs = getFeatureLevelPrefs();
  const wrap = el('div', { class: 'feature-level-settings' });
  wrap.appendChild(el('h3', { class: 'modal-subheading', text: '🧩 Feature Level' }));
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'This app has a lot of tools across the Create and Tools menus — pick how many of them show up. Nothing here removes or changes any diagram; it only changes what\'s visible in the toolbar. Every action stays reachable through ⌘/Ctrl+K Quick Actions regardless of this setting.' }));

  wrap.appendChild(field('Show', selectInput(FEATURE_MODES, prefs.featureMode, (next) => {
    saveFeatureLevelPrefs({ featureMode: next });
    renderForm();
  }, FEATURE_MODE_LABELS)));

  if (prefs.featureMode === 'custom') {
    const list = el('div', { class: 'feature-pack-list' });
    for (const pack of FEATURE_PACKS) {
      const checked = prefs.enabledPacks.includes(pack.id);
      const row = checkbox(checked, (v) => {
        const nextPacks = v ? [...prefs.enabledPacks, pack.id] : prefs.enabledPacks.filter((id) => id !== pack.id);
        saveFeatureLevelPrefs({ enabledPacks: nextPacks });
        renderForm();
      }, `${pack.icon} ${pack.label}`);
      row.title = pack.description;
      row.classList.add('feature-pack-row');
      list.appendChild(row);
    }
    wrap.appendChild(list);
  }

  return wrap;
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
    showToast(next === 'direct' ? 'Direct API calls enabled.' : next === 'local' ? 'Local AI (in-browser) enabled.' : 'Switched to Copy/Paste — every saved API key was deleted.', 'success');
    renderForm();
  }, AI_SEND_MODE_LABELS)));

  wrap.appendChild(buildLocalAiSection(settings, renderForm));

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

  wrap.appendChild(buildAutoSuggestSection(settings, renderForm));

  return wrap;
}

/** "🔁 Auto-suggest" sub-section of "🤖 AI Providers" — configures
 * io/autoSuggestWatcher.js: runs the "💡 Suggestions" flow (AI Design
 * Review) in the background, with no panel open, once enough distinct
 * diagram edits pile up. Deliberately not a timer — see
 * io/aiProviderKeys.js#DEFAULTS.autoSuggest's header comment — and off by
 * default since an unattended trigger can incur real cost in Direct API
 * mode. Only actually fires once Direct API mode or Local AI mode is
 * configured (io/aiProviderKeys.js#isAutomaticSendConfigured), but the
 * toggle/count stay editable regardless, same as `localModel` above, so
 * turning it on ahead of configuring a provider isn't lost. */
function buildAutoSuggestSection(settings, renderForm) {
  const wrap = el('div', { class: 'ai-auto-suggest-settings' });
  wrap.appendChild(el('h4', { class: 'modal-subheading', text: '🔁 Auto-suggest' }));
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'Runs "💡 Suggestions" (AI Design Review) on its own in the background after this many diagram edits pile up — not on a timer, so idle time never triggers it. A "💡" badge appears on the AI Design Review toolbar button once a background check finds something; click it to view.' }));

  if (!isAutomaticSendConfigured()) {
    wrap.appendChild(el('p', { class: 'ai-auto-suggest-warning' }, [
      el('span', { text: '⚠️ Has no effect yet — needs Direct API mode (with a configured provider) or Local AI mode above.' }),
    ]));
  }

  wrap.appendChild(checkbox(settings.autoSuggest.enabled, (checked) => {
    setAutoSuggestConfig({ enabled: checked });
    renderForm();
  }, 'Enabled'));

  wrap.appendChild(field('Run after every N edits', numberInput(settings.autoSuggest.everyNChanges, 1, 50, 1, (value) => {
    setAutoSuggestConfig({ everyNChanges: value });
  })));

  return wrap;
}

/** "🧩 Local AI (in-browser)" sub-section of "🤖 AI Providers" above —
 * configures Local AI mode (io/webllmEngine.js): runs an open model
 * entirely inside this browser via WebGPU, the one sending mode with no
 * key/account/server at all. Shown regardless of which mode is currently
 * selected (same as the provider key rows above it), so the model choice
 * and an optional preload survive switching modes back and forth. */
function buildLocalAiSection(settings, renderForm) {
  const wrap = el('div', { class: 'ai-local-settings' });
  wrap.appendChild(el('h4', { class: 'modal-subheading', text: '🧩 Local AI (in-browser)' }));
  wrap.appendChild(el('p', { class: 'modal-hint', text: 'Runs a small open model (Llama/Qwen) entirely inside this browser tab via WebGPU — no key, no account, and nothing ever leaves your device. The model itself (1.5-2.5 GB, picked below) downloads once on first use and is cached by the browser after that; text only — the diagram image isn\'t sent to it.' }));

  if (!isWebGpuSupported()) {
    wrap.appendChild(el('p', { class: 'ai-provider-settings-warning' }, [
      el('strong', { text: '⚠️ Not available here: ' }),
      el('span', { text: 'this browser doesn\'t support WebGPU. Try Chrome or Edge on desktop, or use Copy/Paste or Direct API mode instead.' }),
    ]));
  }

  const progressEl = el('span', { class: 'ai-local-progress' });
  const preloadBtn = el('button', {
    type: 'button', class: 'btn btn-secondary', text: '⬇️ Preload model',
    disabled: !isWebGpuSupported(),
    title: 'Downloads and initializes the model now, so the first real "Send" isn\'t a surprise multi-GB wait',
    onClick: async () => {
      preloadBtn.disabled = true;
      preloadBtn.textContent = 'Loading…';
      const result = await preloadLocalModel(settings.localModel, (report) => {
        progressEl.textContent = report?.text
          || (typeof report?.progress === 'number' ? `${Math.round(report.progress * 100)}%` : '');
      });
      preloadBtn.disabled = false;
      preloadBtn.textContent = '⬇️ Preload model';
      progressEl.textContent = '';
      if (!result.ok) { showToast(result.error, 'error', 5000); return; }
      showToast('Model loaded and ready.', 'success', 2200);
    },
  });

  wrap.appendChild(field('Model', selectInput(
    LOCAL_MODEL_CHOICES.map((m) => m.id),
    settings.localModel,
    (next) => { setLocalModel(next); renderForm(); },
    Object.fromEntries(LOCAL_MODEL_CHOICES.map((m) => [m.id, `${m.name} (${m.sizeLabel})`])),
  )));
  wrap.appendChild(el('div', { class: 'field-row' }, [preloadBtn, progressEl]));

  return wrap;
}
