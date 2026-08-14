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
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) dialog.close();
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
