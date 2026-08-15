// Thin wrapper around the native <dialog> element — gives us focus
// trapping, Escape-to-close and a backdrop for free, no framework needed.
import { el } from '../utils/dom.js';

export function openModal({ title, className = '', render, onClose, closeOnBackdrop = true }) {
  const dialog = document.createElement('dialog');
  dialog.className = `app-modal ${className}`.trim();

  const header = el('div', { class: 'modal-header' }, [
    el('h2', { text: title }),
    el('button', {
      class: 'modal-close',
      type: 'button',
      'aria-label': 'Close',
      text: '✕',
      onClick: () => dialog.close(),
    }),
  ]);
  const body = el('div', { class: 'modal-body' });
  dialog.appendChild(header);
  dialog.appendChild(body);
  document.body.appendChild(dialog);

  const api = { dialog, body, close: () => dialog.close() };

  if (closeOnBackdrop) {
    // A native <dialog>'s backdrop isn't a real element in the DOM tree, so
    // a click that lands there (rather than on any of the dialog's content)
    // targets the dialog itself — checking e.target here (instead of
    // comparing click coordinates to the dialog's rect) stays correct even
    // when content re-renders and the dialog resizes between mousedown and
    // click, which coordinate math got wrong.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
  dialog.addEventListener('close', () => {
    onClose?.();
    dialog.remove();
  });

  render(body, api);
  dialog.showModal();
  return api;
}
