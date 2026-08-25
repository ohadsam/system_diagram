// Warns when this app is open in more than one browser tab at once — every
// tab shares the same autosave slot (io/autosave.js) and localStorage-backed
// saved projects, so editing in two tabs concurrently can silently overwrite
// one tab's changes with the other's. Detection uses BroadcastChannel (same
// origin/browser only, no server involved, matching this app's fully
// client-side design) rather than e.g. a localStorage "lock" flag — a flag
// would need careful cleanup on crash/close to avoid falsely warning a
// single tab forever, whereas BroadcastChannel naturally only reaches tabs
// that are actually open right now.
const CHANNEL_NAME = 'sdb-tab-presence';

/** Returns a `dispose()` function that closes the channel — the app itself
 * never calls it (a tab's own unload handles that), but it lets a unit test
 * close out its simulated tabs instead of leaving an open BroadcastChannel
 * handle that would otherwise keep the test process alive indefinitely. */
export function initDuplicateTabWarning(showToast) {
  if (typeof BroadcastChannel === 'undefined') return () => {}; // unsupported browser — silently skip, not worth a fallback
  let warned = false; // per-tab (per call) — every real tab gets its own module instance anyway, this just keeps a unit test's simulated tabs independent too
  const channel = new BroadcastChannel(CHANNEL_NAME);
  function warnOnce() {
    if (warned) return;
    warned = true;
    showToast('This diagram builder is already open in another browser tab. Editing the same diagram in both can overwrite one tab\'s changes with the other\'s — finish or close one before continuing.', 'error', 7000);
  }
  channel.onmessage = (e) => {
    if (e.data?.type === 'hello') {
      channel.postMessage({ type: 'here' });
      warnOnce();
    } else if (e.data?.type === 'here') {
      warnOnce();
    }
  };
  channel.postMessage({ type: 'hello' });
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => channel.close());
  }
  return () => channel.close();
}
