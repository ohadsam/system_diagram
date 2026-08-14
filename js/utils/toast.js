// Small non-blocking notification (toast) shown in the corner of the screen.
import { el } from './dom.js';

let containerEl = null;

function ensureContainer() {
  if (containerEl) return containerEl;
  containerEl = el('div', { class: 'toast-container', 'aria-live': 'polite' });
  document.body.appendChild(containerEl);
  return containerEl;
}

/** @param {'info'|'success'|'error'} kind */
export function showToast(message, kind = 'info', duration = 3200) {
  const container = ensureContainer();
  const toast = el('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status', text: message });
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
