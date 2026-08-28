// In-memory Interview Mode session state — deliberately NOT part of the
// project JSON (core/project.js): a practice timer and challenge prompt
// describe how you're *using* the app right now, not the diagram's own
// content, so it doesn't travel with export/import/undo. Same reasoning
// already applied to Live Collaboration's connection state
// (modals/collaborationModal.js#onCollabStatusChange) — a live session,
// not diagram content — and the same pub-sub shape, so toolbar.js's badge
// can follow either one identically.
let session = null; // { promptTitle, promptText, startedAt, durationMs: number|null }
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn(session);
}

export function startInterview(prompt, durationMinutes) {
  session = {
    promptTitle: prompt.title,
    promptText: prompt.prompt,
    startedAt: Date.now(),
    durationMs: durationMinutes ? durationMinutes * 60000 : null,
  };
  notify();
}

export function endInterview() {
  session = null;
  notify();
}

export function getInterviewSession() {
  return session;
}

/** Called immediately with the current session, then again on every change — same contract as onCollabStatusChange. */
export function onInterviewChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Milliseconds left in a timed session (0 once expired), or null for an
 * untimed session / no active session. `now` is injectable for testing. */
export function getRemainingMs(now = Date.now()) {
  if (!session || !session.durationMs) return null;
  return Math.max(0, session.durationMs - (now - session.startedAt));
}

export function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
