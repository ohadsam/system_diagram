// A small "want a walkthrough animation of what was just generated?"
// confirmation, offered right after any AI-generation flow (Generate
// Design from Spec, AI Quick Start, Import from Image) loads a fresh
// project — reveals every component/connector in the order the AI
// listed them (core/animationAutoBuild.js), which reads as a narrated
// tour of the design. Purely a convenience: skipping it leaves the
// diagram exactly as generated, and the same "🎞️ Diagram Animation"
// toolbar button can always build one by hand afterwards anyway.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { setAnimations } from '../canvas/canvas.js';
import { buildAutoWalkthroughAnimation, AUTO_ANIMATION_DEFAULT_DELAY_MS, AUTO_ANIMATION_MIN_DELAY_MS, AUTO_ANIMATION_MAX_DELAY_MS } from '../core/animationAutoBuild.js';
import { toggleAnimationPanel } from '../panel/animationPanel.js';
import { showToast } from '../utils/toast.js';

/** Call right after `store.loadProject(project)` (or equivalent) succeeds
 * for an AI-generated diagram with at least 2 components — a single node
 * has nothing to "walk through". */
export function offerAutoWalkthroughAnimation() {
  const project = store.getState();
  if ((project.nodes?.length || 0) < 2) return;

  let revealMode = 'auto';
  let delaySeconds = AUTO_ANIMATION_DEFAULT_DELAY_MS / 1000;

  openModal({
    title: '🎬 Add a walkthrough animation?',
    className: 'auto-animation-modal',
    render: (body, api) => {
      body.appendChild(el('p', { class: 'modal-hint', text: "Reveal each component and connection one at a time, in the order they were generated — a quick way to present or explain this design. You can edit or delete it afterwards like any other animation." }));

      const wrap = el('div', { class: 'auto-animation-options' });

      const autoRow = el('label', { class: 'auto-animation-option' });
      const autoRadio = el('input', { type: 'radio', name: 'auto-animation-mode', checked: true, onChange: () => { revealMode = 'auto'; renderDelayState(); } });
      autoRow.appendChild(autoRadio);
      autoRow.appendChild(el('span', { text: 'Auto-advance every' }));
      const delayInput = el('input', {
        type: 'number', class: 'auto-animation-delay', min: AUTO_ANIMATION_MIN_DELAY_MS / 1000, max: AUTO_ANIMATION_MAX_DELAY_MS / 1000, step: 1,
        onInput: (e) => { delaySeconds = Number(e.target.value) || AUTO_ANIMATION_DEFAULT_DELAY_MS / 1000; },
      });
      delayInput.value = String(delaySeconds);
      autoRow.appendChild(delayInput);
      autoRow.appendChild(el('span', { text: 'seconds' }));
      wrap.appendChild(autoRow);

      const clickRow = el('label', { class: 'auto-animation-option' });
      clickRow.appendChild(el('input', { type: 'radio', name: 'auto-animation-mode', onChange: () => { revealMode = 'click'; renderDelayState(); } }));
      clickRow.appendChild(el('span', { text: 'Advance only on click' }));
      wrap.appendChild(clickRow);

      body.appendChild(wrap);

      function renderDelayState() {
        delayInput.disabled = revealMode !== 'auto';
      }
      renderDelayState();

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Skip', onClick: () => api.close() }));
      actions.appendChild(el('button', {
        type: 'button', class: 'btn btn-primary', text: '🎬 Create Animation',
        onClick: () => {
          const animation = buildAutoWalkthroughAnimation(store.getState(), {
            revealMode,
            delayMs: revealMode === 'auto' ? Math.round(delaySeconds * 1000) : undefined,
          });
          setAnimations([animation], animation.id);
          showToast('Walkthrough animation created — open "🎞️ Diagram Animation" to view, edit, or play it.', 'success', 3200);
          api.close();
          toggleAnimationPanel();
        },
      }));
      body.appendChild(actions);
    },
  });
}
