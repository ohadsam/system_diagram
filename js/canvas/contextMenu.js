// Generic small popup menu used for node/edge right-click and the node
// "more options" (kebab) button.
import { el, clear } from '../utils/dom.js';

let menuEl = null;
let closeHandler = null;

function ensureMenuEl() {
  if (menuEl) return menuEl;
  menuEl = el('div', { class: 'context-menu', role: 'menu', hidden: true });
  document.body.appendChild(menuEl);
  return menuEl;
}

/**
 * @param {number} x screen x
 * @param {number} y screen y
 * @param {Array<{label:string, icon?:string, danger?:boolean, disabled?:boolean, onClick?:Function}|'separator'>} items
 */
export function showContextMenu(x, y, items) {
  const menu = ensureMenuEl();
  clear(menu);
  for (const item of items) {
    if (item === 'separator') {
      menu.appendChild(el('div', { class: 'context-menu-sep' }));
      continue;
    }
    const btn = el('button', {
      class: `context-menu-item${item.danger ? ' danger' : ''}`,
      type: 'button',
      disabled: !!item.disabled,
      onClick: () => {
        hideContextMenu();
        item.onClick?.();
      },
    });
    if (item.icon) btn.appendChild(el('span', { class: 'context-menu-icon', text: item.icon }));
    btn.appendChild(el('span', { text: item.label }));
    menu.appendChild(btn);
  }
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;
  menu.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, maxY))}px`;

  closeHandler = (e) => {
    if (!menu.contains(e.target)) hideContextMenu();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', closeHandler);
    document.addEventListener('keydown', onKeydown);
  }, 0);
}

function onKeydown(e) {
  if (e.key === 'Escape') hideContextMenu();
}

export function hideContextMenu() {
  if (!menuEl) return;
  menuEl.hidden = true;
  document.removeEventListener('pointerdown', closeHandler);
  document.removeEventListener('keydown', onKeydown);
}
