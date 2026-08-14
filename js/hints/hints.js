// Sequential first-run "coach mark" hints: one small bubble at a time,
// pointing at the relevant UI, dismissible individually or all at once,
// persisted forever in localStorage. See docs/SPEC.md 4.9.
import { el } from '../utils/dom.js';
import { readJSON, writeJSON } from '../io/storage.js';
import { HINTS } from './hintData.js';

const KEY = 'dismissedHints';
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

export function initHints() {
  queue = HINTS.filter((h) => !getDismissed().has(h.id));
  showNext();
  window.addEventListener('resize', () => {
    if (bubbleEl && currentTarget) positionBubble(bubbleEl, currentTarget, bubbleEl.dataset.placement);
  });
}

export function resetHints() {
  writeJSON(KEY, []);
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
