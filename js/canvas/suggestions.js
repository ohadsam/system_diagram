// "Smart Suggestions" — a small dismissible banner offering one-click
// companions for whatever component was just placed (e.g. dropping a Load
// Balancer suggests Nginx Web Server), based on each component's curated
// `related` ids, plus one-click sub-components to attach onto that exact
// node (e.g. dropping Express suggests attaching a Controller layer),
// based on `relatedLayers` (see data/schema.js#c). Deliberately a
// hand-curated, sparse mapping rather than an automatic/heuristic one —
// see docs/ARCHITECTURE.md "Smart Suggestions" for the design rationale,
// and docs/AI_AGENT_GUIDE.md "Add a predefined component" for how to
// extend it.
//
// No dependency on canvas.js (which calls into this module) — the actual
// "add this component"/"attach this layer" actions are passed in as
// callbacks from the caller, not imported here, to avoid a circular
// import.
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { getRelatedComponents, getRelatedLayers, getRelatedPatterns } from '../data/index.js';
import { getLibrarySettings } from '../io/librarySettings.js';

const AUTO_HIDE_MS = 9000;

let bannerEl = null;
let hideTimer = null;
const visibilityListeners = new Set();

/** Lets other floating UI (toolbar.js's contextual style row, in
 * 'floating' mode) know when this banner becomes visible/hidden, since
 * both are independently `position: fixed` and can otherwise end up
 * overlapping — the banner always sits bottom-center regardless of
 * anything else on screen. */
export function onSuggestionsVisibilityChange(fn) {
  visibilityListeners.add(fn);
  return () => visibilityListeners.delete(fn);
}

function notifyVisibilityChange(visible) {
  for (const fn of visibilityListeners) fn(visible);
}

/** Layer suggestions for `node` (curated via its def's `relatedLayers`)
 * that aren't already attached as one of its sub-components — the same
 * filter `showSuggestionsFor` uses for its "attach" row, but exposed
 * standalone so it can be re-checked any time later, not just right after
 * placement (see canvas/node.js's suggestion badge and
 * panel/detailsPanel.js's "Suggested sub-components" section, both of
 * which need this to still work on a node loaded from a saved project,
 * long after the placement-time banner is gone). Returns `[]` for a node
 * with no def (a bare custom shape) or no curated `relatedLayers`. */
export function getUnattachedLayerSuggestions(node) {
  if (!node.defId) return [];
  const existingSubNames = new Set((node.subComponents || []).map((sc) => sc.name));
  return getRelatedLayers(node.defId).filter((rel) => !existingSubNames.has(rel.name));
}

/** Curated "flow diagram" (sequence-diagram template) suggestions for
 * `node`, revisitable any time from the details panel the same way
 * `getUnattachedLayerSuggestions` is — e.g. selecting "Authorization"
 * suggests the RBAC/ABAC Authorization Check flows. Unlike a sub-component,
 * instantiating a template again isn't "already attached" (it just adds
 * another copy of the diagram nearby), so there's nothing to filter out —
 * every curated pattern always shows. Returns `[]` for a node with no def
 * or no curated `relatedPatterns`. */
export function getPatternSuggestionsForNode(node) {
  return node.defId ? getRelatedPatterns(node.defId) : [];
}

/** Whether `node` has anything at all to show in its persistent
 * suggestions surface (canvas/node.js's badge, panel/detailsPanel.js's
 * sections) — either kind counts, so a component with only curated
 * `relatedPatterns` and no `relatedLayers` (or vice versa) still gets the
 * badge. */
export function hasSuggestions(node) {
  return getUnattachedLayerSuggestions(node).length > 0 || getPatternSuggestionsForNode(node).length > 0;
}

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
  notifyVisibilityChange(false);
  setTimeout(() => {
    if (bannerEl) bannerEl.hidden = true;
  }, 200);
}

function buildRow(label, items, buildButton) {
  const row = el('div', { class: 'suggestion-banner-row' });
  row.appendChild(el('span', { class: 'suggestion-banner-label', text: label }));
  items.forEach((item, idx) => row.appendChild(buildButton(item, idx)));
  return row;
}

/**
 * Call right after a component is placed on the canvas. Shows a banner
 * with up to a few one-click suggestions: standalone companion components
 * curated via `related` (placed beside the new node), and/or sub-components
 * curated via `relatedLayers` (attached onto the new node itself, same
 * effect as dragging a "Layers & Roles" item onto it) — silently does
 * nothing if Smart Suggestions are turned off (Default Settings modal),
 * this component has no curated lists, or everything curated is already
 * present (a companion already somewhere on the canvas, or a sub-component
 * already attached to this exact node).
 * @param {object} def the just-placed component's definition
 * @param {object} node the just-created node — read for its already-attached
 *   `subComponents` so an already-present layer isn't re-suggested
 * @param {object} callbacks
 * @param {(relDefId: string, offsetIndex: number) => void} callbacks.onAddComponent
 *   called with the chosen companion component's id (and its position among
 *   the companions shown, for layout) when its button is clicked
 * @param {(layerDefId: string) => void} callbacks.onAddLayer called with the
 *   chosen layer's id when its "attach" button is clicked
 * @param {(patternDefId: string) => void} callbacks.onAddPattern called with
 *   the chosen sequence-diagram template's id when its button is clicked —
 *   instantiates the whole template next to this node (canvas.js
 *   #instantiatePatternNearNode), not attached as a sub-component the way
 *   a layer is.
 */
export function showSuggestionsFor(def, node, { onAddComponent, onAddLayer, onAddPattern }) {
  if (!getLibrarySettings().suggestionsEnabled) return;

  const existingDefIds = new Set(store.getState().nodes.map((n) => n.defId).filter(Boolean));
  const componentSuggestions = getRelatedComponents(def.id).filter((rel) => !existingDefIds.has(rel.id));

  const layerSuggestions = getUnattachedLayerSuggestions(node);
  const patternSuggestions = getRelatedPatterns(def.id);

  // A component with nothing curated to suggest must still hide whatever
  // banner is already up — otherwise placing e.g. Express (which has
  // suggestions) followed by a component with none leaves Express's banner
  // sitting on screen, stale and mislabeled for the wrong node, which reads
  // as "Smart Suggestions stopped working" since it never again reflects
  // whatever was actually just placed.
  if (!componentSuggestions.length && !layerSuggestions.length && !patternSuggestions.length) {
    hide();
    return;
  }

  const banner = ensureBanner();
  clear(banner);
  clearTimeout(hideTimer);

  if (componentSuggestions.length) {
    banner.appendChild(buildRow(`✨ Goes well with ${def.name}:`, componentSuggestions, (rel, idx) => el('button', {
      type: 'button',
      class: 'btn btn-sm suggestion-banner-btn',
      text: `${rel.icon} + ${rel.name}`,
      title: `Add ${rel.name} — commonly used alongside ${def.name}`,
      onClick: () => {
        onAddComponent(rel.id, idx);
        hide();
      },
    })));
  }

  if (layerSuggestions.length) {
    banner.appendChild(buildRow(`🧩 Common building blocks for ${def.name}:`, layerSuggestions, (rel) => el('button', {
      type: 'button',
      class: 'btn btn-sm suggestion-banner-btn suggestion-banner-btn-layer',
      text: `${rel.icon} ↳ ${rel.name}`,
      title: `Attach ${rel.name} as a sub-component of ${def.name}`,
      onClick: () => {
        onAddLayer(rel.id);
        hide();
      },
    })));
  }

  if (patternSuggestions.length) {
    banner.appendChild(buildRow(`🔀 Sequence diagrams for ${def.name}:`, patternSuggestions, (rel) => el('button', {
      type: 'button',
      class: 'btn btn-sm suggestion-banner-btn suggestion-banner-btn-pattern',
      text: `${rel.icon} ${rel.name}`,
      title: `Add the "${rel.name}" sequence diagram next to ${def.name}`,
      onClick: () => {
        onAddPattern(rel.id);
        hide();
      },
    })));
  }

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
  notifyVisibilityChange(true);
  hideTimer = setTimeout(hide, AUTO_HIDE_MS);
}
