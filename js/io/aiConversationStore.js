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
