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
import { el, clear } from '../utils/dom.js';
import { getUiPrefs, onUiPrefsChange } from '../io/uiPrefs.js';
import { getRecentItemIds, recordItemUsed } from '../io/recentItems.js';

const EDGE_MARGIN = 8;

/** Toggled by toolbar.js's "📖 Show Descriptions" button (default off — the
 * native `title` tooltip is still there either way, this just also renders
 * it inline for anyone who'd rather not hover-and-wait one button at a time
 * to see what each one does). Appends/removes a `.toolbar-dropdown-btn-desc`
 * span rather than touching a button's existing text/content, since several
 * buttons here already carry their own child elements (e.g. toolbar.js's
 * `lintBtn` has a count badge) that a naive `textContent =` rewrite would
 * silently destroy. */
function updateButtonDescription(btn, enabled) {
  if (btn.classList.contains('toolbar-dropdown-section-toggle')) return;
  const existing = btn.querySelector(':scope > .toolbar-dropdown-btn-desc');
  const title = btn.getAttribute('title');
  if (enabled && title) {
    if (existing) existing.textContent = title;
    else {
      btn.appendChild(el('span', { class: 'toolbar-dropdown-btn-desc', text: title }));
      btn.classList.add('has-desc');
    }
  } else if (existing) {
    existing.remove();
    btn.classList.remove('has-desc');
  }
}

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
  // "Recently Used" section (toolbarDropdown.js's `recentScopeId` option) —
  // its buttons are ordinary top-level buttons, just nested one level inside
  // `.toolbar-dropdown-recent-wrap` instead of being direct children of
  // `panel`, so they need the same per-button matching as the loop above
  // rather than the pack-section treatment (there's no
  // `.toolbar-dropdown-section-body` wrapper here).
  const recentWrap = panel.querySelector('.toolbar-dropdown-recent-wrap');
  if (recentWrap && !recentWrap.hidden) {
    let recentMatch = false;
    recentWrap.querySelectorAll('button').forEach((btn) => {
      const match = !q || matchText(btn);
      btn.classList.toggle('search-hidden', !match);
      if (match) recentMatch = true;
    });
    recentWrap.classList.toggle('search-hidden', !!q && !recentMatch);
    if (recentMatch) anyVisible = true;
  }
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
 * @param {{searchable?: boolean, recentScopeId?: string}} [opts]
 *   `searchable: true` prepends a "Search actions..." box that live-filters
 *   `buttons` — opt-in per dropdown rather than a blanket default, since
 *   it's only worth the extra chrome on this app's longest dropdown
 *   (Tools); see toolbar.js's `initToolbar`. `recentScopeId` (an
 *   io/recentItems.js scope id) adds a "🕐 Recently Used" section + a
 *   separator above everything else, rebuilt fresh each time the panel
 *   opens from whichever of this panel's own buttons were most recently
 *   clicked — see buildRecentSection below for how a button is identified
 *   without every call site needing its own explicit id, and why it MOVES
 *   the real button rather than cloning it.
 */
export function buildToolbarDropdown(label, icon, title, buttons, opts = {}) {
  const { searchable = false, recentScopeId = null } = opts;
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
  // Placeholder for buildRecentSection() to fill in on each open, sitting
  // above every real button — see its own comment for why it's rebuilt on
  // open rather than kept live.
  const recentWrap = recentScopeId ? el('div', { class: 'toolbar-dropdown-recent-wrap', hidden: true }) : null;
  if (recentWrap) panel.appendChild(recentWrap);
  for (const b of buttons) panel.appendChild(b);
  // Recently-Used bookkeeping: capture each real action button's *original*
  // position (parent + next-sibling, so it can be put back exactly where it
  // came from) and a stable identity key, once, right now — before anything
  // in this panel has ever been clicked or moved. The key is the button's
  // *current* title/text, snapshotted before it can change: several buttons
  // here (e.g. the Theme/Language toggles in Tools) rewrite their own
  // `.title`/text on every click to reflect new state, so recording/looking
  // a button up by whatever its title happens to be *right now* would
  // silently disagree the moment that title changed — see
  // docs/AI_AGENT_GUIDE.md's pitfall entry. An explicit per-button id at
  // every one of the ~70 call sites across File/Create/Tools/Help would be
  // more precise but is a lot of surface area to keep in sync; this
  // piggybacks on the convention this app already enforces (every button
  // needs a clear, distinct title).
  const trackedButtons = [];
  let recentByKey = null;
  if (recentScopeId) {
    panel.querySelectorAll('button').forEach((btn) => {
      if (btn.classList.contains('toolbar-dropdown-section-toggle')) return;
      btn.dataset.recentKey = (btn.title || btn.textContent || '').trim();
      trackedButtons.push({ btn, parent: btn.parentElement, next: btn.nextSibling });
    });
    recentByKey = new Map(trackedButtons.map(({ btn }) => [btn.dataset.recentKey, btn]));
  }
  const applyDescriptions = (enabled) => panel.querySelectorAll('button').forEach((btn) => updateButtonDescription(btn, enabled));
  applyDescriptions(getUiPrefs().showActionDescriptions);
  onUiPrefsChange((prefs) => applyDescriptions(prefs.showActionDescriptions));
  // Close the panel once one of its own buttons has been used, so it
  // doesn't sit open over the canvas after the action already ran — except
  // a section-collapse toggle (`.toolbar-dropdown-section-toggle`), which a
  // user very plausibly clicks several times in a row while browsing. Also
  // records this click into the "Recently Used" scope, if any — whether the
  // button was clicked in its normal spot or from the recent section itself
  // makes no difference, since buildRecentSection moves the one real
  // element rather than cloning it (see its own comment for why).
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('toolbar-dropdown-section-toggle')) return;
    if (recentScopeId && btn.dataset.recentKey) recordItemUsed(recentScopeId, btn.dataset.recentKey);
    closeOpenPanel();
  });

  /** Rebuilds the "Recently Used" section from whatever's currently
   * recorded for `recentScopeId`, called fresh each time the panel opens
   * (not kept live while it's already open) — same "reset on open" treatment
   * `searchInput` already gets just below.
   *
   * MOVES each real button into the section rather than cloning it — an
   * earlier version cloned, which put a second element with the exact same
   * title/accessible-name into the DOM the moment an action had been used
   * once. That silently broke a wide swath of this suite's *pre-existing*
   * e2e tests, all of which locate a toolbar button by its text/title with
   * no `.first()` (a totally reasonable assumption when a label is normally
   * unique) — the instant a test used the same action twice, Playwright's
   * strict-mode locator started throwing "resolved to 2 elements". Moving
   * the one real node instead means the accessible name only ever exists
   * once, so it can never drift out of sync with what that button does
   * either. `restoreTrackedPositions` puts everything back where it
   * started, in reverse of the order buttons were originally discovered
   * (last-discovered first) — required so that a button's recorded `next`
   * sibling reference is guaranteed to already be back in its real parent
   * (or was never moved) by the time this restores said button relative to
   * it; restoring in forward/original order can otherwise try to
   * `insertBefore` relative to a still-relocated sibling and throw. */
  function restoreTrackedPositions() {
    for (let i = trackedButtons.length - 1; i >= 0; i--) {
      const { btn, parent, next } = trackedButtons[i];
      parent.insertBefore(btn, next);
    }
  }

  function buildRecentSection() {
    if (!recentWrap) return;
    restoreTrackedPositions();
    clear(recentWrap);
    // Skip anything whose real button currently lives inside a pack section
    // hidden by the Basic/Advanced/Custom feature-level setting (see
    // toolbar.js#buildGatedButtonList) — a hidden ancestor doesn't stop
    // `.click()` from still firing that button's handler, so without this
    // check a Basic-mode user could run an Advanced-only action straight
    // from "Recently Used" that the dropdown itself is deliberately hiding.
    const found = getRecentItemIds(recentScopeId)
      .map((id) => recentByKey.get(id))
      .filter((btn) => btn && !btn.closest('.toolbar-dropdown-pack-section[hidden]'));
    if (!found.length) { recentWrap.hidden = true; return; }
    recentWrap.hidden = false;
    recentWrap.appendChild(el('div', { class: 'toolbar-dropdown-section-label', text: '🕐 Recently Used' }));
    for (const btn of found) recentWrap.appendChild(btn); // moves the real node, doesn't copy it
    recentWrap.appendChild(el('div', { class: 'toolbar-dropdown-separator' }));
  }

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
        buildRecentSection();
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
