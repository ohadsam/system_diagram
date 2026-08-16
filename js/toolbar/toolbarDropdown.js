// A toolbar button that reveals a small panel of related action buttons on
// click — keeps the always-visible toolbar row from growing unbounded as
// features are added (the mobile toolbar overflow this once caused is
// documented in docs/AI_AGENT_GUIDE.md). Distinct from canvas/contextMenu.js
// (the right-click menu): the panel here is anchored under its trigger
// button and holds real <button> elements built the same way as any other
// toolbar button (so each keeps its own clear title/text), not a generic
// {label,onClick} item list.
import { el } from '../utils/dom.js';

let openPanel = null; // { root, close } of the currently open dropdown, if any

function closeOpenPanel() {
  if (openPanel) {
    openPanel.close();
    openPanel = null;
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
        panel.style.left = '0';
        panel.style.right = '';
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('active');
        // A trigger near the right edge of the toolbar (Tools/Help) would
        // otherwise render its panel partly off-screen — flip to right-
        // anchored (under the trigger's right edge instead of its left)
        // whenever the default left-aligned placement would overflow.
        if (panel.getBoundingClientRect().right > window.innerWidth) {
          panel.style.left = 'auto';
          panel.style.right = '0';
        }
        openPanel = {
          root,
          close: () => {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.classList.remove('active');
          },
        };
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
