// A toolbar button that reveals a small panel of related action buttons on
// click — keeps the always-visible toolbar row from growing unbounded as
// features are added (the mobile toolbar overflow this once caused is
// documented in docs/AI_AGENT_GUIDE.md). Distinct from canvas/contextMenu.js
// (the right-click menu): the panel here holds real <button> elements built
// the same way as any other toolbar button (so each keeps its own clear
// title/text), not a generic {label,onClick} item list.
//
// The panel is positioned with `position: fixed` and explicit pixel
// coordinates computed (and viewport-clamped) from the trigger's own
// getBoundingClientRect() — the same approach contextMenu.js already uses
// for the right-click menu — rather than CSS `position: absolute; top:
// 100%` relative to the trigger. That relative-positioning approach could
// still render partly off-screen on a narrow/mobile viewport (a trigger
// near the toolbar's row-wrapped edge, or the panel simply being wider
// than the remaining space); computing fixed viewport coordinates and
// clamping them is correct regardless of where the trigger ends up.
import { el } from '../utils/dom.js';

const EDGE_MARGIN = 8;

let openPanel = null; // { root, close } of the currently open dropdown, if any
const openChangeListeners = new Set();

/** Lets other floating UI (toolbar.js's contextual style row) know when any
 * dropdown panel is open, so it can get out of the way instead of risking
 * covering it (or being covered by it) on screen — see toolbar.js's
 * "dropdown-suppressed" handling. */
export function onDropdownOpenChange(fn) {
  openChangeListeners.add(fn);
  return () => openChangeListeners.delete(fn);
}

function notifyOpenChange() {
  const isOpen = !!openPanel;
  for (const fn of openChangeListeners) fn(isOpen);
}

function closeOpenPanel() {
  if (openPanel) {
    openPanel.close();
    openPanel = null;
    notifyOpenChange();
  }
}

document.addEventListener('pointerdown', (e) => {
  if (openPanel && !openPanel.root.contains(e.target)) closeOpenPanel();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOpenPanel();
});

/** Live-filters a searchable dropdown panel's buttons by visible text/title.
 * Individual `<button>`s get a `.search-hidden` class; a whole
 * `.toolbar-dropdown-pack-section` gets it too once none of its own buttons
 * match, so its label disappears along with them. A pack section already
 * hidden by feature-level gating (`[hidden]`) stays hidden regardless — this
 * only ever adds an *additional* reason to hide, never removes the real one.
 * A collapsed section's `.toolbar-dropdown-section-body` is force-opened
 * (`.search-force-open`, see css/toolbar.css) while it has a live match, so
 * a search can surface a result the user collapsed earlier, without
 * touching — and later losing — their actual persisted collapse choice. */
function filterDropdownPanel(panel, noResultsEl, query) {
  const q = query.trim().toLowerCase();
  const matchText = (btn) => `${btn.textContent} ${btn.title || ''}`.toLowerCase().includes(q);
  let anyVisible = false;
  for (const child of panel.children) {
    if (child.tagName !== 'BUTTON' || child.classList.contains('toolbar-dropdown-section-toggle')) continue;
    const match = !q || matchText(child);
    child.classList.toggle('search-hidden', !match);
    if (match) anyVisible = true;
  }
  panel.querySelectorAll('.toolbar-dropdown-pack-section').forEach((section) => {
    const body = section.querySelector('.toolbar-dropdown-section-body');
    const sectionButtons = body ? body.querySelectorAll('button') : [];
    let sectionMatch = false;
    sectionButtons.forEach((btn) => {
      const match = !q || matchText(btn);
      btn.classList.toggle('search-hidden', !match);
      if (match) sectionMatch = true;
    });
    section.classList.toggle('search-hidden', !!q && !sectionMatch);
    if (body) body.classList.toggle('search-force-open', !!q && sectionMatch);
    if (sectionMatch && !section.hidden) anyVisible = true;
  });
  if (noResultsEl) noResultsEl.hidden = !q || anyVisible;
}

/**
 * @param {string} label visible text on the trigger button
 * @param {string} icon a single emoji shown before the label
 * @param {string} title tooltip summarizing the group's contents
 * @param {HTMLElement[]} buttons already-built elements (buttons, and
 *   optionally `.toolbar-dropdown-section-label` header divs, or a
 *   `.toolbar-dropdown-pack-section` wrapper — see toolbar.js's
 *   `buildGatedButtonList`) to show in the panel
 * @param {{searchable?: boolean}} [opts] `searchable: true` prepends a
 *   "Search actions..." box that live-filters `buttons` — opt-in per
 *   dropdown rather than a blanket default, since it's only worth the
 *   extra chrome on this app's longest dropdown (Tools); see toolbar.js's
 *   `initToolbar`.
 */
export function buildToolbarDropdown(label, icon, title, buttons, opts = {}) {
  const { searchable = false } = opts;
  const root = el('div', { class: 'toolbar-dropdown' });
  const panel = el('div', { class: 'toolbar-dropdown-panel', role: 'menu', hidden: true });
  let searchInput = null;
  let noResultsEl = null;
  if (searchable) {
    searchInput = el('input', {
      type: 'search',
      class: 'toolbar-dropdown-search',
      placeholder: 'Search actions...',
      'aria-label': `Search ${label} actions`,
      onInput: (e) => filterDropdownPanel(panel, noResultsEl, e.target.value),
      // A plain <input> isn't a <button>, so the panel's own "close on
      // button click" listener below never fires for it — this just stops
      // the click from being treated as "outside the panel" by the
      // document-level pointerdown-closes-open-panel listener above, were
      // it ever attached higher up than `root`.
      onClick: (e) => e.stopPropagation(),
    });
    noResultsEl = el('div', { class: 'toolbar-dropdown-no-results', text: 'No matching actions.', hidden: true });
    panel.appendChild(searchInput);
    panel.appendChild(noResultsEl);
  }
  for (const b of buttons) panel.appendChild(b);
  // Close the panel once one of its own buttons has been used, so it
  // doesn't sit open over the canvas after the action already ran — except
  // a section-collapse toggle (`.toolbar-dropdown-section-toggle`), which a
  // user very plausibly clicks several times in a row while browsing.
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.toolbar-dropdown-section-toggle')) return;
    if (e.target.closest('button')) closeOpenPanel();
  });

  // Fixed viewport coordinates, clamped to stay fully on-screen — see the
  // module comment above for why this is more robust than CSS `position:
  // absolute` relative to the trigger. `top` alone being clamped isn't
  // enough once a group has grown long enough that the panel's own natural
  // height exceeds the viewport (this app's longest group, Tools, has
  // grown past two dozen buttons across many batches) — clamping only the
  // position still leaves its bottom rows genuinely unreachable, with no
  // page scroll to fall back on since the panel is `position: fixed`. So
  // `max-height`/`overflow-y` are set here too, sized to whatever space is
  // actually left below `top`, the same "clamp position AND cap size with
  // its own scrollbar" approach `.toolbar-row-context.floating` already
  // uses (css/toolbar.css) — just computed here since `top` is dynamic.
  function positionPanel() {
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const maxLeft = window.innerWidth - panelRect.width - EDGE_MARGIN;
    const left = Math.max(EDGE_MARGIN, Math.min(triggerRect.left, maxLeft));
    const maxTop = window.innerHeight - panelRect.height - EDGE_MARGIN;
    const top = Math.max(EDGE_MARGIN, Math.min(triggerRect.bottom + 4, maxTop));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${window.innerHeight - top - EDGE_MARGIN}px`;
    panel.style.overflowY = 'auto';
  }

  const trigger = el(
    'button',
    {
      type: 'button',
      class: 'btn toolbar-dropdown-trigger',
      title,
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      onClick: (e) => {
        e.stopPropagation();
        const willOpen = panel.hidden;
        closeOpenPanel();
        if (!willOpen) return;
        if (searchInput) {
          searchInput.value = '';
          filterDropdownPanel(panel, noResultsEl, '');
        }
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('active');
        positionPanel();
        if (searchInput) requestAnimationFrame(() => searchInput.focus());
        openPanel = {
          root,
          close: () => {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.classList.remove('active');
          },
        };
        notifyOpenChange();
      },
    },
    [
      el('span', { class: 'toolbar-dropdown-icon', text: icon, 'aria-hidden': 'true' }),
      el('span', { class: 'toolbar-dropdown-label', text: label }),
      el('span', { class: 'toolbar-dropdown-caret', text: '▾', 'aria-hidden': 'true' }),
    ],
  );

  root.appendChild(trigger);
  root.appendChild(panel);
  return root;
}
