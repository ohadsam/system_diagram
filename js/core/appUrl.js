// Pure helper for modals/cliSetupModal.js — computes the base URL to hand
// an AI CLI tool, from wherever this exact instance of the app happens to
// be running (GitHub Pages, a custom domain, localhost, a dev server).
// There is no discovery mechanism a CLI can use on its own to find this
// app's address (see docs/AI_INTEGRATION.md's header comment on why this
// 100% static app can't offer an API instead) — the address always has to
// come from whoever is running it, so reading it live off the page itself
// (rather than guessing from the repo's name, as an earlier chat answer in
// this project's own history had to) removes all the guesswork.
export function computeAppBaseUrl(href) {
  const url = new URL(href);
  const path = url.pathname;
  const lastSlash = path.lastIndexOf('/');
  return `${url.origin}${path.slice(0, lastSlash + 1)}`;
}
