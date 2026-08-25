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

/**
 * @param {string} label visible text on the trigger button
 * @param {string} icon a single emoji shown before the label
 * @param {string} title tooltip summarizing the group's contents
 * @param {HTMLElement[]} buttons already-built <button> elements to show in the panel
 */
export function buildToolbarDropdown(label, icon, title, buttons) {
  const root = el('div', { class: 'toolbar-dropdown' });
  const panel = el('div', { class: 'toolbar-dropdown-panel', role: 'menu', hidden: true });
  for (const b of buttons) panel.appendChild(b);
  // Close the panel once one of its own buttons has been used, so it
  // doesn't sit open over the canvas after the action already ran.
  panel.addEventListener('click', (e) => {
    if (e.target.closest('button')) closeOpenPanel();
  });

  // Fixed viewport coordinates, clamped to stay fully on-screen — see the
  // module comment above for why this is more robust than CSS `position:
  // absolute` relative to the trigger.
  function positionPanel() {
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const maxLeft = window.innerWidth - panelRect.width - EDGE_MARGIN;
    const left = Math.max(EDGE_MARGIN, Math.min(triggerRect.left, maxLeft));
    const maxTop = window.innerHeight - panelRect.height - EDGE_MARGIN;
    const top = Math.max(EDGE_MARGIN, Math.min(triggerRect.bottom + 4, maxTop));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
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
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('active');
        positionPanel();
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
