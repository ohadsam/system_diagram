// Applies/persists the app's light/dark theme choice — see
// css/variables.css's dark-mode token block and uiPrefs.js's `theme` field
// ('system' | 'light' | 'dark'). A tiny inline script in index.html's
// <head> duplicates the "read the stored choice, set data-theme" logic
// synchronously, before this module (or anything else) can even load —
// purely to avoid a light-mode flash for a visitor who already chose dark.
// Keep both in sync if this logic ever changes.
import { getUiPrefs, saveUiPrefs } from './uiPrefs.js';

export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function initTheme() {
  applyTheme(getUiPrefs().theme);
}

export function setTheme(theme) {
  saveUiPrefs({ theme });
  applyTheme(theme);
}
