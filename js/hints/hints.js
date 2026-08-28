// Sequential first-run "coach mark" hints: one small bubble at a time,
// pointing at the relevant UI, dismissible individually or all at once,
// persisted forever in localStorage. See docs/SPEC.md 4.9.
import { el } from '../utils/dom.js';
import { readJSON, writeJSON } from '../io/storage.js';
import { HINTS } from './hintData.js';
import { isPackEnabled } from '../core/featureLevels.js';
import { getFeatureLevelPrefs } from '../io/featureLevelPrefs.js';

const KEY = 'dismissedHints';
const ENABLED_KEY = 'hintsEnabled';
let queue = [];
let bubbleEl = null;
let currentTarget = null;

function getDismissed() {
  return new Set(readJSON(KEY, []));
}

function dismiss(id) {
  const set = getDismissed();
  set.add(id);
  writeJSON(KEY, [...set]);
}

/** Whether hint bubbles are allowed to show at all — a separate, persistent
 * on/off switch from the per-hint dismissed set: turning hints off doesn't
 * mark any of them as seen, so turning back on resumes exactly where the
 * tour left off. Defaults to on. */
export function areHintsEnabled() {
  return readJSON(ENABLED_KEY, true);
}

/** Toggles the on/off switch above. Turning on immediately shows the next
 * undismissed hint (if any); turning off immediately hides whichever
 * bubble is currently showing, without dismissing it. */
export function setHintsEnabled(enabled) {
  writeJSON(ENABLED_KEY, enabled);
  if (enabled) showNext();
  else removeBubble();
}

export function initHints() {
  // A hint tagged with `packId` (see hintData.js) points at a toolbar
  // button that only exists when that pack is enabled — see
  // core/featureLevels.js. Showing it anyway (e.g. to a Basic-mode
  // visitor) would describe a button that isn't there. This snapshot is
  // taken once here, not re-checked per showNext() call, so mid-tour is
  // never worse than "matches whatever the level was when the tour
  // started" — hints are low-stakes and dismissible either way.
  const prefs = getFeatureLevelPrefs();
  queue = HINTS.filter((h) => !getDismissed().has(h.id) && (!h.packId || isPackEnabled(prefs, h.packId)));
  if (areHintsEnabled()) showNext();
  window.addEventListener('resize', () => {
    if (bubbleEl && currentTarget) positionBubble(bubbleEl, currentTarget, bubbleEl.dataset.placement);
  });
}

export function resetHints() {
  writeJSON(KEY, []);
  // An explicit "show hints again" request implies the user wants hints
  // on, even if they'd previously turned the switch off — otherwise
  // clicking "restart tour" while hints are off would silently do nothing,
  // which would look like the button was broken.
  writeJSON(ENABLED_KEY, true);
  removeBubble();
  initHints();
}

function showNext() {
  removeBubble();
  while (queue.length) {
    const hint = queue[0];
    const target = document.querySelector(hint.target);
    if (target && isVisible(target)) {
      showBubble(hint, target);
      return;
    }
    queue.shift();
  }
}

function isVisible(elRef) {
  const rect = elRef.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function showBubble(hint, target) {
  currentTarget = target;
  bubbleEl = el('div', { class: 'hint-bubble', 'data-placement': hint.placement });
  bubbleEl.appendChild(el('p', { text: hint.text }));
  const actions = el('div', { class: 'hint-actions' });
  actions.appendChild(el('button', { type: 'button', class: 'btn-link', text: 'Skip all', onClick: skipAll }));
  actions.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-primary btn-sm',
    text: queue.length > 1 ? 'Next' : 'Got it',
    onClick: () => {
      dismiss(hint.id);
      queue.shift();
      showNext();
    },
  }));
  bubbleEl.appendChild(actions);
  document.body.appendChild(bubbleEl);
  positionBubble(bubbleEl, target, hint.placement);
}

function positionBubble(bubble, target, placement) {
  const rect = target.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();
  let top = rect.top;
  let left = rect.right + 12;
  if (placement === 'top') {
    top = rect.top - bubbleRect.height - 12;
    left = rect.left + rect.width / 2 - bubbleRect.width / 2;
  } else if (placement === 'bottom') {
    top = rect.bottom + 12;
    left = rect.left + rect.width / 2 - bubbleRect.width / 2;
  } else if (placement === 'right') {
    top = rect.top;
    left = rect.right + 12;
  }
  top = Math.max(8, Math.min(top, window.innerHeight - bubbleRect.height - 8));
  left = Math.max(8, Math.min(left, window.innerWidth - bubbleRect.width - 8));
  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
}

function skipAll() {
  for (const hint of queue) dismiss(hint.id);
  queue = [];
  removeBubble();
}

function removeBubble() {
  bubbleEl?.remove();
  bubbleEl = null;
  currentTarget = null;
}
