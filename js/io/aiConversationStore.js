// Persists the "🗨️ AI Conversation" transcript (core/aiConversation.js's
// turns) across sessions — same plain readJSON/writeJSON shape as
// io/usageStats.js. Deliberately global, not per-project: a conversation is
// a train of thought the user is having *about* whichever diagram is
// currently open, not project data itself, so it isn't included in JSON
// export/full backup/duplicate-project, the same "app setting, not project
// data" category io/uiPrefs.js and io/aiProviderKeys.js are already in.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'aiConversation';

const DEFAULT_STATE = { turns: [] };

export function getConversationTurns() {
  return readJSON(KEY, DEFAULT_STATE).turns;
}

export function appendConversationTurn(turn) {
  const turns = [...getConversationTurns(), turn];
  writeJSON(KEY, { turns });
  return turns;
}

export function clearConversation() {
  writeJSON(KEY, DEFAULT_STATE);
}

/** Flags an existing turn as having had its patch applied — used by
 * panel/aiChatPanel.js, where a patch arrives inline in the transcript
 * (unlike modals/aiConversationModal.js's wizard, which decides
 * apply-or-not before the turn is ever written) so the "✓ diagram updated"
 * badge can be added retroactively once the user actually clicks Apply. */
export function markPatchApplied(turnId) {
  const turns = getConversationTurns().map((t) => (t.id === turnId ? { ...t, patchApplied: true } : t));
  writeJSON(KEY, { turns });
  return turns;
}
