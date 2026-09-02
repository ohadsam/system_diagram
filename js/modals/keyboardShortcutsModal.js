// "⌨️ Keyboard Shortcuts" — a static, always-accurate reference for every
// global shortcut this app actually wires (main.js#initKeyboardShortcuts,
// plus a couple of others' own key handling), reachable by pressing "?"
// from anywhere non-typing (same guard main.js already uses for every
// other shortcut) or from the Help menu/Command Palette. Deliberately
// hand-maintained rather than introspected from the actual keydown
// handler — there's no registry to read from, so whoever adds a new
// global shortcut needs to add a row here too (see docs/AI_AGENT_GUIDE.md's
// "Add a keyboard shortcut" row).
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';

const SECTIONS = [
  {
    title: 'General',
    rows: [
      ['Ctrl/Cmd + S', 'Save a named version'],
      ['Ctrl/Cmd + K', 'Open Command Palette'],
      ['Ctrl/Cmd + Z', 'Undo'],
      ['Ctrl/Cmd + Shift + Z, or Ctrl/Cmd + Y', 'Redo'],
      ['Ctrl/Cmd + D', 'Duplicate selection'],
      ['Delete / Backspace', 'Delete selection'],
      ['Escape', 'Deselect, close panels — or exit Presenter Mode'],
      ['?', 'Show this shortcuts reference'],
    ],
  },
  {
    title: 'Canvas navigation',
    rows: [
      ['Ctrl/Cmd + "+" / "-"', 'Zoom in / out'],
      ['Ctrl/Cmd + 0', 'Reset zoom to 100%'],
      ['H', 'Hand tool (pan)'],
      ['V', 'Select tool'],
      ['Hold Space', 'Temporarily pan, whichever tool is active'],
      ['Arrow keys (Shift = 10px)', 'Nudge the selected component(s)'],
      ['C', 'Draw a connector from the selected component (keyboard-only connect)'],
    ],
  },
  {
    title: 'Diagram Animation playback',
    rows: [
      ['→ or N', 'Next step'],
      ['← or P', 'Previous step'],
      ['D', 'Freeze/unfreeze to draw on the frozen diagram'],
      ['Escape', 'Exit drawing, then exit playback'],
    ],
  },
];

export function openKeyboardShortcutsModal() {
  openModal({
    title: '⌨️ Keyboard Shortcuts',
    className: 'keyboard-shortcuts-modal',
    render: (body) => {
      for (const section of SECTIONS) {
        body.appendChild(el('h3', { text: section.title }));
        const table = el('div', { class: 'shortcuts-table' });
        for (const [keys, desc] of section.rows) {
          const row = el('div', { class: 'shortcuts-row' });
          row.appendChild(el('span', { class: 'shortcuts-keys' }, keys.split(/ (\+|,|or) /).map((part) => (
            part === '+' || part === ',' || part === 'or'
              ? el('span', { class: 'shortcuts-sep', text: part })
              : el('kbd', { text: part })
          ))));
          row.appendChild(el('span', { class: 'shortcuts-desc', text: desc }));
          table.appendChild(row);
        }
        body.appendChild(table);
      }
      body.appendChild(el('p', { class: 'modal-hint', text: 'Anything not listed here (right-click menus, drag gestures) has no dedicated shortcut — reach it via Ctrl/Cmd+K instead.' }));
    },
  });
}
