// Registers sw.js (see its own header comment for the caching strategy).
// Feature-detected and registered after the page has already loaded, so a
// slow/failed registration never delays or breaks the app itself — a
// visitor without service worker support (or one where registration fails,
// e.g. a browser extension blocking it) just doesn't get the offline/
// install capability, with no other effect.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('[serviceWorker] registration failed', err);
    });
  });
}
