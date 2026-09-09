// The on-canvas suggestion io/crowdingWatcher.js surfaces the moment a
// settled edit leaves the diagram looking crowded/overlapping/unevenly
// spaced — exactly two actions, per this feature's own brief: run the fix,
// or dismiss and leave the diagram exactly as it is. Structurally mirrors
// hints/featureSuggestionBanner.js (a fixed-position card built with
// utils/dom.js#el, appended straight to document.body) but trimmed to just
// those two buttons — no separate ✕ close icon, since "Dismiss" already
// covers exactly that.
import { el } from '../utils/dom.js';

let cardEl = null;

/** @param {() => void} onFix @param {() => void} onDismiss */
export function showCrowdingSuggestionBanner(onFix, onDismiss) {
  cardEl?.remove();
  const card = el('div', { class: 'crowding-suggestion-banner' });
  card.appendChild(el('p', {
    class: 'crowding-suggestion-text',
    text: '📐 This part of the diagram looks crowded or unevenly spaced. Want to space it out automatically?',
  }));
  const actions = el('div', { class: 'crowding-suggestion-actions' });
  actions.appendChild(el('button', {
    type: 'button', class: 'btn-link', text: 'Dismiss',
    onClick: () => { card.remove(); if (cardEl === card) cardEl = null; onDismiss(); },
  }));
  actions.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary btn-sm', text: '📐 Auto-arrange',
    onClick: () => { card.remove(); if (cardEl === card) cardEl = null; onFix(); },
  }));
  card.appendChild(actions);
  document.body.appendChild(card);
  cardEl = card;
  avoidCollisions(card);
}

/** hints/onboardingChecklistWidget.js's bottom-left card shifts right at
 * desktop widths to clear the sidebar (`calc(var(--sidebar-width) + 16px)`
 * — see css/hints.css), and hints/featureSuggestionBanner.js's own card can
 * appear independently at bottom-right — either can end up horizontally
 * under this bottom-center one depending on viewport width and the
 * sidebar's own current width, so a single guessed `bottom` offset in CSS
 * would eventually collide with one of them (see docs/AI_AGENT_GUIDE.md's
 * "guessed pixel offset from a sibling" pitfall). Measured live instead:
 * push this card up just far enough to clear whichever already-on-screen
 * sibling actually overlaps it horizontally, rather than assuming a fixed
 * corner is always free. */
function avoidCollisions(card) {
  const others = ['.onboarding-checklist-card', '.feature-suggestion-banner']
    .map((sel) => document.querySelector(sel))
    .filter((el) => el && el !== card)
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  if (!others.length) return;
  const cardRect = card.getBoundingClientRect();
  let bottom = 16;
  for (const r of others) {
    const overlapsHorizontally = cardRect.left < r.right && cardRect.right > r.left;
    if (!overlapsHorizontally) continue;
    const neededBottom = (window.innerHeight - r.top) + 16;
    if (neededBottom > bottom) bottom = neededBottom;
  }
  card.style.bottom = `${bottom}px`;
}

export function hideCrowdingSuggestionBanner() {
  cardEl?.remove();
  cardEl = null;
}
