// Small floating "getting started" progress card — see
// core/onboardingChecklist.js for what it tracks and why it's separate
// from the sequential hint bubbles (hints.js). Shown once automatically
// for a new visitor (nothing dismissed yet); reachable again afterward via
// the toolbar's Help menu "🚀 Getting Started" entry, same "show again"
// convention hints.js's own restart button already uses.
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { listSavedProjects } from '../io/projects.js';
import { computeOnboardingProgress } from '../core/onboardingChecklist.js';
import { isOnboardingChecklistDismissed, dismissOnboardingChecklist } from '../io/onboardingChecklist.js';

let cardEl = null;
let unsubscribe = null;

function currentContext() {
  const state = store.getState();
  return {
    nodeCount: state.nodes.length,
    edgeCount: state.edges.length,
    // A "Save As" doesn't itself dispatch a store 'change' (it copies the
    // current project elsewhere rather than mutating it), so this specific
    // step can lag until the next edit re-renders the card — an accepted
    // trade-off for not wiring a dedicated event through io/projects.js
    // just for this.
    savedProjectCount: listSavedProjects().length,
    commentCount: (state.comments || []).length,
  };
}

function buildCard() {
  const card = el('div', { class: 'onboarding-checklist-card' });
  card.appendChild(el('button', {
    type: 'button', class: 'onboarding-checklist-close', 'aria-label': 'Dismiss getting-started checklist', title: 'Dismiss',
    text: '✕',
    onClick: close,
  }));
  card.appendChild(el('h3', { class: 'onboarding-checklist-title', text: '🚀 Getting started' }));

  const list = el('ul', { class: 'onboarding-checklist-list' });
  card.appendChild(list);

  function render() {
    clear(list);
    const progress = computeOnboardingProgress(currentContext());
    for (const step of progress.steps) {
      list.appendChild(el('li', { class: `onboarding-checklist-item${step.done ? ' is-done' : ''}` }, [
        el('span', { class: 'onboarding-checklist-check', 'aria-hidden': 'true', text: step.done ? '✅' : '⬜' }),
        el('span', { text: step.label }),
      ]));
    }
    if (progress.allDone) {
      close();
    }
  }

  render();
  unsubscribe = store.subscribe('change', render);
  return card;
}

function close() {
  dismissOnboardingChecklist();
  unsubscribe?.();
  unsubscribe = null;
  cardEl?.remove();
  cardEl = null;
}

export function openOnboardingChecklistWidget() {
  if (cardEl) return;
  cardEl = buildCard();
  document.body.appendChild(cardEl);
}

/** Call once at startup — shows the card automatically unless it was
 * already dismissed (or the checklist is already fully complete, which
 * can happen for a visitor restoring an already-built diagram). */
export function initOnboardingChecklistWidget() {
  if (isOnboardingChecklistDismissed()) return;
  const progress = computeOnboardingProgress(currentContext());
  if (progress.allDone) return;
  openOnboardingChecklistWidget();
}

