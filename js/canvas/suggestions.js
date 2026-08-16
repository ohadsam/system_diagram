// "Smart Suggestions" — a small dismissible banner offering one-click
// companions for whatever component was just placed (e.g. dropping a Load
// Balancer suggests Nginx Web Server), based on each component's curated
// `related` ids (see data/schema.js#c). Deliberately a hand-curated, sparse
// mapping rather than an automatic/heuristic one — see
// docs/ARCHITECTURE.md "Smart Suggestions" for the design rationale, and
// docs/AI_AGENT_GUIDE.md "Add a predefined component" for how to extend it.
//
// No dependency on canvas.js (which calls into this module) — the actual
// "add this component" action is passed in as a callback from the caller,
// not imported here, to avoid a circular import.
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { getRelatedComponents } from '../data/index.js';
import { getLibrarySettings } from '../io/librarySettings.js';

const AUTO_HIDE_MS = 9000;

let bannerEl = null;
let hideTimer = null;

function ensureBanner() {
  if (bannerEl) return bannerEl;
  bannerEl = el('div', { class: 'suggestion-banner', hidden: true, role: 'status', 'aria-live': 'polite' });
  document.body.appendChild(bannerEl);
  return bannerEl;
}

function hide() {
  if (!bannerEl) return;
  clearTimeout(hideTimer);
  bannerEl.classList.remove('visible');
  setTimeout(() => {
    if (bannerEl) bannerEl.hidden = true;
  }, 200);
}

/**
 * Call right after a component is placed on the canvas. Shows a banner
 * with up to a few one-click suggestions for that component's curated
 * companions — silently does nothing if Smart Suggestions are turned off
 * (Default Settings modal), this component has no curated related list, or
 * every related component is already somewhere on the canvas.
 * @param {object} def the just-placed component's definition
 * @param {(relDefId: string, offsetIndex: number) => void} onAdd called with the chosen related component's id (and its position among the suggestions shown) when its button is clicked
 */
export function showSuggestionsFor(def, onAdd) {
  if (!getLibrarySettings().suggestionsEnabled) return;
  const existingDefIds = new Set(store.getState().nodes.map((n) => n.defId).filter(Boolean));
  const suggestions = getRelatedComponents(def.id).filter((rel) => !existingDefIds.has(rel.id));
  if (!suggestions.length) return;

  const banner = ensureBanner();
  clear(banner);
  clearTimeout(hideTimer);

  banner.appendChild(el('span', { class: 'suggestion-banner-label', text: `✨ Goes well with ${def.name}:` }));
  suggestions.forEach((rel, idx) => {
    banner.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-sm suggestion-banner-btn',
      text: `${rel.icon} + ${rel.name}`,
      title: `Add ${rel.name} — commonly used alongside ${def.name}`,
      onClick: () => {
        onAdd(rel.id, idx);
        hide();
      },
    }));
  });
  banner.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-icon suggestion-banner-close',
    text: '✕',
    title: 'Dismiss suggestions',
    'aria-label': 'Dismiss suggestions',
    onClick: hide,
  }));

  banner.hidden = false;
  requestAnimationFrame(() => banner.classList.add('visible'));
  hideTimer = setTimeout(hide, AUTO_HIDE_MS);
}
