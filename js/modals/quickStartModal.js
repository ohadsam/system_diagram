// "🪄 AI Quick Start" — a guided on-ramp for someone who doesn't yet know
// this app's component library: nudge them toward configuring an AI engine
// (optional, skippable), have them describe their system in plain words,
// get the AI to propose a starting diagram (io/aiGenerateDesign.js's
// buildQuickStartPrompt), load it, and — unlike Generate Design from Spec,
// which closes immediately on import — end on a "why" screen explaining
// the AI's reasoning for the overall shape and each component, since the
// whole point of this flow is teaching, not just producing a diagram.
//
// Reachable any time from the Create menu (not just first-run) — the
// nudge step itself only appears when no automatic AI send path
// (io/aiProviderKeys.js#isAutomaticSendConfigured) is currently configured,
// and can always be skipped without configuring anything, since every
// hand-off provider (copy prompt, open site, paste back) works regardless.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { validateProject } from '../core/project.js';
import { buildQuickStartPrompt, extractProjectJSON, autoArrangeIfNeeded } from '../io/aiGenerateDesign.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import { buildAiProviderActions } from '../utils/aiProviderActions.js';
import { isAutomaticSendConfigured } from '../io/aiProviderKeys.js';
import { openDefaultSettingsModal } from './defaultSettingsModal.js';
import { offerAutoWalkthroughAnimation } from './autoAnimationPrompt.js';

const STEP_TITLES = { setup: 'Set up AI (optional)', describe: 'Describe your system', prompt: 'Copy this prompt to your AI', paste: "Paste the AI's result", done: 'Your diagram' };

export function openQuickStartModal() {
  let step = isAutomaticSendConfigured() ? 'describe' : 'setup';
  let description = '';
  let promptOverride = null;
  let responseText = '';
  let pasteError = '';
  let createdProject = null;
  let rationale = null;

  function currentPrompt() {
    if (promptOverride !== null) return promptOverride;
    return buildQuickStartPrompt({ description });
  }

  async function copyPromptToClipboard() {
    try {
      await navigator.clipboard.writeText(currentPrompt());
      return true;
    } catch {
      showToast('Could not copy automatically — select the prompt text and copy it manually.', 'error');
      return false;
    }
  }

  async function openProvider(provider) {
    const copied = await copyPromptToClipboard();
    window.open(provider.url, '_blank', 'noopener');
    if (copied) showToast(`Prompt copied — opened ${provider.name}. Paste it in and send.`, 'success', 3000);
  }

  openModal({
    title: '🪄 AI Quick Start',
    className: 'generate-design-modal',
    render: (body, api) => {
      const renderStep = () => {
        clear(body);
        body.appendChild(el('p', { class: 'modal-step-indicator', text: STEP_TITLES[step] }));
        if (step === 'setup') renderSetup();
        else if (step === 'describe') renderDescribe();
        else if (step === 'prompt') renderPrompt();
        else if (step === 'paste') renderPaste();
        else renderDone();

        function renderSetup() {
          body.appendChild(el('p', { class: 'modal-hint', text: "This wizard describes your system in your own words and has an AI propose a starting diagram — components, connections, and an explanation of why. It works with any AI (copy a prompt, paste back the reply), but it's fastest with Direct API mode or Local AI set up first so it can run automatically." }));
          body.appendChild(el('p', { class: 'quick-start-warning' }, [
            el('span', { text: '⚙️ No AI engine configured yet — you can still use this wizard by copying the prompt to any AI yourself, or set one up now for a one-click send.' }),
          ]));
          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '⚙️ Set up AI now',
            onClick: () => openDefaultSettingsModal({ scrollToAiProviders: true }),
          }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Skip →',
            onClick: () => { step = 'describe'; renderStep(); },
          }));
          body.appendChild(actions);
        }

        function renderDescribe() {
          body.appendChild(el('p', { class: 'modal-hint', text: 'Describe your system in plain language — what it does, who uses it, and any pieces you already know you need. The more specific, the better the starting point.' }));
          const textarea = el('textarea', {
            class: 'ai-review-prompt quick-start-description',
            rows: 8,
            placeholder: 'e.g. "An online store where customers browse a product catalog, place orders, and pay by card. Orders need to survive a server restart, and payments go through a third-party processor."',
            onInput: (e) => { description = e.target.value; },
          });
          textarea.value = description;
          body.appendChild(textarea);

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Next →',
            onClick: () => {
              if (!description.trim()) { showToast('Describe your system first — a sentence or two is enough.', 'error'); return; }
              step = 'prompt';
              renderStep();
            },
          }));
          body.appendChild(actions);
        }

        function renderPrompt() {
          const promptArea = el('textarea', {
            class: 'ai-review-prompt',
            rows: 12,
            onInput: (e) => { promptOverride = e.target.value; },
          });
          promptArea.value = currentPrompt();
          body.appendChild(promptArea);

          const promptActions = el('div', { class: 'field-row' });
          promptActions.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '📋 Copy prompt',
            onClick: async () => { if (await copyPromptToClipboard()) showToast('Prompt copied to clipboard.', 'success', 1600); },
          }));
          promptActions.appendChild(el('button', {
            type: 'button', class: 'btn-link', text: 'Reset to auto-generated',
            onClick: () => { promptOverride = null; renderStep(); },
          }));
          body.appendChild(promptActions);

          body.appendChild(el('h3', { class: 'modal-subheading', text: 'Open your AI (copies the prompt and opens a new tab) — or send it directly' }));
          body.appendChild(buildAiProviderActions({
            openProvider,
            getPrompt: currentPrompt,
            onDirectResult: (text) => { responseText = text; pasteError = ''; step = 'paste'; renderStep(); },
          }));

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 'describe'; renderStep(); } }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Next →', onClick: () => { step = 'paste'; renderStep(); } }));
          body.appendChild(actions);
        }

        function renderPaste() {
          body.appendChild(el('p', { class: 'modal-hint', text: "Paste the AI's whole reply below — the JSON code block plus any surrounding text is fine, it'll be picked out automatically." }));
          const responseArea = el('textarea', {
            class: 'ai-review-response generate-design-response',
            rows: 12,
            placeholder: "Paste the AI's response here…",
            onInput: (e) => { responseText = e.target.value; pasteError = ''; },
          });
          responseArea.value = responseText;
          body.appendChild(responseArea);

          const errorEl = el('p', { class: 'generate-design-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: '← Back', onClick: () => { step = 'prompt'; renderStep(); } }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Create diagram',
            onClick: async () => {
              const extracted = extractProjectJSON(responseArea.value);
              if (!extracted.ok) { pasteError = extracted.error; renderStep(); return; }
              const validated = validateProject(extracted.data);
              if (!validated.ok || !validated.project.nodes.length) {
                pasteError = "That didn't look like a valid design — no components were found. Check the AI's reply matches the requested JSON shape, or try again.";
                renderStep();
                return;
              }
              const project = autoArrangeIfNeeded(validated.project);

              const currentHasContent = store.getState().nodes.length > 0;
              if (currentHasContent) {
                const proceed = await confirmAction({
                  title: 'Replace the current canvas?',
                  message: 'This loads the generated design in place of what\'s on the canvas now. If you want to keep your current diagram, use "Save As" first — undo (Ctrl/Cmd+Z) can also bring it right back.',
                  confirmLabel: 'Replace',
                  danger: false,
                });
                if (!proceed) return;
              }
              store.loadProject(project);
              createdProject = project;
              rationale = extracted.data && typeof extracted.data.rationale === 'object' ? extracted.data.rationale : null;
              showToast(`Generated a design with ${project.nodes.length} component${project.nodes.length === 1 ? '' : 's'}.`, 'success', 2600);
              step = 'done';
              renderStep();
            },
          }));
          body.appendChild(actions);
        }

        function renderDone() {
          body.appendChild(el('p', { class: 'modal-hint', text: `Your diagram is on the canvas — keep editing it, or use this as a starting point.` }));

          const overview = typeof rationale?.overview === 'string' ? rationale.overview.trim() : '';
          if (overview) {
            body.appendChild(el('h3', { class: 'modal-subheading', text: 'Why this shape' }));
            body.appendChild(el('p', { class: 'quick-start-overview', text: overview }));
          }

          const byId = new Map((createdProject?.nodes || []).map((n) => [n.id, n]));
          const componentReasons = Array.isArray(rationale?.components) ? rationale.components : [];
          const rows = componentReasons
            .map((c) => ({ node: byId.get(c?.id), why: typeof c?.why === 'string' ? c.why.trim() : '' }))
            .filter((r) => r.node && r.why);

          if (rows.length) {
            body.appendChild(el('h3', { class: 'modal-subheading', text: 'Why each component' }));
            const list = el('div', { class: 'quick-start-reasons' });
            for (const { node, why } of rows) {
              list.appendChild(el('div', { class: 'quick-start-reason-row' }, [
                el('span', { class: 'quick-start-reason-name', text: node.text || node.defId || 'Component' }),
                el('span', { class: 'quick-start-reason-why', text: why }),
              ]));
            }
            body.appendChild(list);
          } else if (!overview) {
            body.appendChild(el('p', { class: 'modal-hint', text: "The AI didn't include an explanation this time — feel free to ask it directly, or just start editing the diagram." }));
          }

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Done',
            onClick: () => { api.close(); offerAutoWalkthroughAnimation(); },
          }));
          body.appendChild(actions);
        }
      };

      renderStep();
    },
  });
}
